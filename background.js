/**
 * Background Service Worker
 * Gerencia a integração com Ollama local e OpenRouter
 */

importScripts('ai-config.js', 'panel-fixes.js');

/**
 * Para o log estruturado (C10): que tipos de problema do WCAGEvaluator cada regra de
 * correção de applyDeterministicFixes() atende, quando a chave da regra não é o próprio
 * tipo de problema. Serve para cruzar deterministicFixes com issuesFound.
 */
const ACCESSIFY_FIX_RULE_ISSUE_TYPES = {
  'page-title': ['no-page-title', 'page-title-too-short'],
  'no-h1': ['no-h1', 'no-headings'],
  'empty-links-and-buttons': ['link-no-text', 'empty-button'],
  'image-missing-alt': ['image-missing-alt', 'linked-image-missing-alt', 'spacer-image-missing-alt'],
  'graphic-fallbacks': ['input-image-missing-alt', 'area-missing-alt'],
  'form-field-no-visible-label': ['form-field-no-visible-label', 'form-field-no-label'],
  'accessify-styles': [
    'focus-outline-removed', 'color-only-link', 'justified-text', 'small-text', 'low-color-contrast',
    'low-non-text-contrast', 'infinite-animation-no-reduced-motion', 'underlined-non-link-text'
  ]
};

class AccessibilityOptimizer {
  constructor() {
    this.apiKey = null;
    this.provider = ACCESSIFY_AI_CONFIG.defaults.provider;
    this.selectedModel = ACCESSIFY_AI_CONFIG.defaults.selectedModel;
    this.localBaseUrl = ACCESSIFY_AI_CONFIG.defaults.localBaseUrl;
    this.localModel = ACCESSIFY_AI_CONFIG.defaults.localModel;
    this.openRouterBaseURL = ACCESSIFY_AI_CONFIG.defaults.openRouterBaseUrl;
    this.analysisJobStorageKey = 'analysisJob';
    this.analysisCommandName = 'trigger-accessibility-analysis';
    this.toggleAutoOptimizeCommandName = 'toggle-auto-optimize';
    this.iconPaths = {
      16: 'icons/icon-16.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png'
    };
    this.enabledIconCache = new Map();
    this.runLogQueues = new Map();
    this.runLogWriteErrors = new Map();
    // Gancho de automação (C11): overrides que valem só durante um run, um run por vez
    this.automationOverrides = null;
    this.automationQueue = Promise.resolve();
    this.loadSettings();
    this.initializeSidePanel();
  }

  async initializeSidePanel() {
    if (!chrome.sidePanel?.setPanelBehavior) {
      return;
    }

    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      console.warn('Não foi possível configurar o side panel:', error);
    }
  }

  /**
   * Garante que a instância reflita o estado atual do storage.
   */
  async refreshSettings() {
    await this.loadSettings();
  }

  /**
   * Carrega configurações do storage
   */
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['apiKey', 'selectedModel', 'provider', 'localBaseUrl', 'localModel'], (result) => {
        this.apiKey = result.apiKey || null;
        this.provider = result.provider || (result.apiKey ? ACCESSIFY_AI_CONFIG.providers.openrouter : ACCESSIFY_AI_CONFIG.defaults.provider);
        this.selectedModel = result.selectedModel || ACCESSIFY_AI_CONFIG.defaults.selectedModel;
        this.localBaseUrl = result.localBaseUrl || ACCESSIFY_AI_CONFIG.defaults.localBaseUrl;
        this.localModel = result.localModel || ACCESSIFY_AI_CONFIG.defaults.localModel;
        // Durante um run do gancho de automação, provedor e modelo vêm da configuração do
        // run, não das opções salvas (refreshSettings roda a cada chamada ao LLM)
        if (this.automationOverrides) {
          this.provider = this.automationOverrides.provider;
          this.localModel = this.automationOverrides.model || this.localModel;
        }
        console.log('Settings loaded:', {
          provider: this.provider,
          apiKeyConfigured: !!this.apiKey,
          model: this.getActiveModel()
        });
        resolve();
      });
    });
  }

  getDefaultAnalysisJob() {
    return {
      runId: null,
      status: 'idle',
      progress: 0,
      progressText: 'Pronto para iniciar análise.',
      steps: [],
      targetTabId: null,
      windowId: null,
      analysisResult: null,
      imageAltResults: [],
      optimizations: null,
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      autoTriggered: false,
      optimizationsApplied: false,
      appliedChanges: 0,
      applyError: null,
      pageUrl: null
    };
  }

  getDurationMs(startedAt, completedAt = new Date().toISOString()) {
    const startedAtMs = Date.parse(startedAt);
    const completedAtMs = Date.parse(completedAt);

    if (!Number.isFinite(startedAtMs) || !Number.isFinite(completedAtMs)) {
      return null;
    }

    return Math.max(0, completedAtMs - startedAtMs);
  }

  generateRunId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * O estado da análise é isolado por aba (cada aba tem sua própria chave no
   * storage), para que abrir uma aba diferente nunca mostre o resultado de outra.
   */
  jobStorageKeyForTab(tabId) {
    if (!Number.isFinite(tabId)) {
      throw new Error('tabId é obrigatório para acessar o estado da análise');
    }

    return `${this.analysisJobStorageKey}:${tabId}`;
  }

  async getAnalysisJob(tabId) {
    const key = this.jobStorageKeyForTab(tabId);
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || this.getDefaultAnalysisJob());
      });
    });
  }

  async setAnalysisJob(tabId, job) {
    const key = this.jobStorageKeyForTab(tabId);
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: job }, () => resolve(job));
    });
  }

  async removeAnalysisJob(tabId) {
    const key = this.jobStorageKeyForTab(tabId);
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => resolve());
    });
  }

  async updateAnalysisJob(tabId, patch) {
    const currentJob = await this.getAnalysisJob(tabId);
    const updatedJob = { ...currentJob, ...patch };
    await this.setAnalysisJob(tabId, updatedJob);
    return updatedJob;
  }

  /**
   * Log estruturado da execução (C10), numa chave própria por aba e ligado ao job
   * pelo runId. Fica fora do job porque o job é zerado a cada carregamento da aba.
   */
  runLogStorageKeyForTab(tabId) {
    if (!Number.isFinite(tabId)) {
      throw new Error('tabId é obrigatório para acessar o log estruturado');
    }

    return `analysisRunLog:${tabId}`;
  }

  async readRunLog(tabId) {
    const key = this.runLogStorageKeyForTab(tabId);
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[key] || null);
      });
    });
  }

  async writeRunLog(tabId, runLog) {
    const key = this.runLogStorageKeyForTab(tabId);
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: runLog }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(runLog);
      });
    });
  }

  async removeRunLog(tabId) {
    const key = this.runLogStorageKeyForTab(tabId);
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => resolve());
    });
  }

  /**
   * Toda leitura e escrita do log passa por uma fila por aba: o resultado da aplicação
   * chega do content script em paralelo às atualizações do background, e duas
   * leituras-escritas concorrentes perderiam uma das partes. A entrada da fila sai do
   * Map quando a última tarefa termina.
   */
  enqueueRunLogTask(tabId, task) {
    const previous = this.runLogQueues.get(tabId) || Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    this.runLogQueues.set(tabId, next);
    next.catch(() => {}).finally(() => {
      if (this.runLogQueues.get(tabId) === next) {
        this.runLogQueues.delete(tabId);
      }
    });
    return next;
  }

  /**
   * Grava no log sem segurar o fluxo da análise: a fila garante a ordem das escritas, e
   * uma falha do log nunca interrompe o que a extensão faz (fica registrada à parte e é
   * devolvida por getRunLog).
   */
  logRun(tabId, task) {
    this.enqueueRunLogTask(tabId, task).catch((error) => {
      console.error('Falha ao gravar o log estruturado da aba:', error);
      this.runLogWriteErrors.set(tabId, error.message);
    });
  }

  startRunLog(tabId, runLog) {
    this.runLogWriteErrors.delete(tabId);
    this.logRun(tabId, () => this.writeRunLog(tabId, runLog));
  }

  logRunUpdate(tabId, runId, mutate) {
    this.logRun(tabId, () => this.applyRunLogMutation(tabId, runId, mutate));
  }

  async applyRunLogMutation(tabId, runId, mutate) {
    const runLog = await this.readRunLog(tabId);
    if (!runLog || (runId && runLog.runId !== runId)) {
      return null;
    }

    mutate(runLog);
    return this.writeRunLog(tabId, runLog);
  }

  async updateRunLog(tabId, runId, mutate) {
    return this.enqueueRunLogTask(tabId, () => this.applyRunLogMutation(tabId, runId, mutate));
  }

  createRunLog({ runId, tabId, pageUrl, startedAt }) {
    return {
      runId,
      version: chrome.runtime.getManifest().version,
      url: pageUrl,
      tabId,
      timestamp: startedAt,
      provider: this.provider,
      model: this.getActiveModel(),
      modelId: null,
      temperature: null,
      issuesTotal: null,
      issuesFound: [],
      deterministicFixes: [],
      aiFixes: [],
      fixRuleIssueTypes: ACCESSIFY_FIX_RULE_ISSUE_TYPES,
      rounds: [],
      roundsRun: 0,
      altTexts: [],
      llmCalls: [],
      genericLabels: 0,
      genericLabelsByKind: {},
      remainingIssues: null,
      remainingByType: {},
      apply: null,
      applies: [],
      totals: { tokensIn: 0, tokensOut: 0, latencyMs: 0 },
      errors: []
    };
  }

  summarizeIssues(issues) {
    const grouped = new Map();

    (issues || []).forEach((issue) => {
      if (!grouped.has(issue.type)) {
        grouped.set(issue.type, { type: issue.type, count: 0, severity: issue.severity || null, selectors: [] });
      }

      const entry = grouped.get(issue.type);
      entry.count += 1;
      if (issue.selector && entry.selectors.length < 10) {
        entry.selectors.push(issue.selector);
      }
    });

    return Array.from(grouped.values()).sort((left, right) => left.type.localeCompare(right.type));
  }

  recordLlmCall(runLog, stage, meta, selector = null, error = null) {
    // Só entra quem chegou a tentar a requisição (isConfigured passou)
    if (!meta?.attempted) {
      return;
    }

    runLog.llmCalls.push({
      stage,
      selector,
      model: meta.model || null,
      modelId: meta.modelId || null,
      temperature: Number.isFinite(meta.temperature) ? meta.temperature : null,
      maxTokens: meta.maxTokens || null,
      latencyMs: Number.isFinite(meta.latencyMs) ? meta.latencyMs : null,
      tokensIn: Number.isFinite(meta.tokensIn) ? meta.tokensIn : null,
      tokensOut: Number.isFinite(meta.tokensOut) ? meta.tokensOut : null,
      finishReason: meta.finishReason || null,
      contentChars: Number.isFinite(meta.contentChars) ? meta.contentChars : null,
      reasoningChars: Number.isFinite(meta.reasoningChars) ? meta.reasoningChars : null,
      httpStatus: meta.httpStatus || null,
      networkError: meta.networkError || null,
      vision: meta.vision === true,
      visionSource: meta.visionSource || null,
      visionError: meta.visionError || null,
      reasoningEffort: meta.reasoningEffort || null,
      error
    });

    runLog.modelId = meta.modelId || runLog.modelId;
    if (Number.isFinite(meta.temperature)) {
      runLog.temperature = meta.temperature;
    }
    runLog.totals = this.computeRunLogTotals(runLog);
  }

  recordImageResults(runLog, imageResults) {
    imageResults.forEach((result) => {
      const llm = result.llm || null;
      const selector = result.selector || null;
      // Resultado com success:false é descartado antes de aplicar: o alt final dessa
      // imagem vem da heurística do content.js, então o texto daqui não descreve o DOM.
      const eligible = !!(result.success && result.alt);

      runLog.altTexts.push({
        selector,
        index: result.index,
        source: result.source || null,
        alt: eligible ? result.alt : null,
        discardedAlt: eligible ? null : (typeof result.alt === 'string' ? result.alt : null),
        chars: eligible ? result.alt.length : 0,
        eligible,
        applied: false,
        finalAlt: null,
        fallbackHeuristic: result.source !== 'llm',
        // O Ollama devolveu o texto só em message.reasoning e extractMessageText o usou
        // como alt text (o raciocínio do modelo virou a descrição da imagem).
        reasoningAsAlt: !!(result.success && llm && llm.contentChars === 0 && llm.reasoningChars > 0),
        latencyMs: Number.isFinite(llm?.latencyMs) ? llm.latencyMs : null,
        tokensIn: Number.isFinite(llm?.tokensIn) ? llm.tokensIn : null,
        tokensOut: Number.isFinite(llm?.tokensOut) ? llm.tokensOut : null,
        vision: llm?.vision === true,
        visionSource: llm?.visionSource || null,
        visionError: llm?.visionError || null,
        error: result.error || null
      });

      if (llm) {
        this.recordLlmCall(runLog, 'alt-text', llm, selector, result.error || null);
      }

      if (result.error) {
        runLog.errors.push({ stage: 'alt-text', message: result.error, selector });
      }

      // Condição de visão sem imagem: o alt saiu só do texto, e isso precisa aparecer
      if (llm?.visionError) {
        runLog.errors.push({ stage: 'visao', message: llm.visionError, selector });
      }
    });
  }

  /**
   * Registra o resultado de uma aplicação (painel, otimização automática ou gancho).
   * Os campos de topo descrevem a aplicação mais recente; `applies` guarda o histórico.
   * Devolve { recorded, reason } para quem enviou.
   */
  async recordApplyResult(tabId, tabUrl, result) {
    const withoutHash = (url) => (typeof url === 'string' ? url.split('#')[0] : url);
    let outcome = { recorded: false, reason: 'sem-log' };

    await this.updateRunLog(tabId, result?.runId || null, (runLog) => {
      const recordedAt = new Date().toISOString();

      // Uma aplicação numa página diferente da analisada não entra nas métricas, mas
      // fica registrada como erro para não sumir em silêncio
      if (tabUrl && runLog.url && withoutHash(tabUrl) !== withoutHash(runLog.url)) {
        runLog.errors.push({ stage: 'aplicacao', message: 'Aplicação ignorada: URL diferente da analisada.', tabUrl, recordedAt });
        outcome = { recorded: false, reason: 'url-divergente' };
        return;
      }

      const status = result?.success ? 'aplicado' : (result?.nothingToApply ? 'nada-a-aplicar' : 'falha');
      const error = result?.success ? null : (result?.error || null);
      const appliedCount = Number.isFinite(result?.appliedCount) ? result.appliedCount : 0;

      runLog.apply = {
        status,
        appliedCount,
        partial: !!result?.partial,
        error,
        overrodeDeterministicAlt: result?.overrodeDeterministicAlt || 0,
        recordedAt
      };
      runLog.applies.push({ status, appliedCount, partial: !!result?.partial, error, recordedAt });
      runLog.deterministicFixes = result?.deterministicFixes || [];
      runLog.aiFixes = result?.aiFixes || [];
      runLog.rounds = result?.rounds || [];
      runLog.roundsRun = result?.roundsRun || 0;
      runLog.remainingIssues = Number.isFinite(result?.remainingIssues) ? result.remainingIssues : null;
      runLog.remainingByType = result?.remainingByType || {};
      runLog.genericLabels = result?.genericLabels?.total || 0;
      runLog.genericLabelsByKind = result?.genericLabels?.byKind || {};

      // Marca nos alts do background os que de fato chegaram ao DOM (o último vence)
      const finalAltByIndex = new Map((result?.appliedImageAlts || []).map(({ index, alt }) => [index, alt]));
      runLog.altTexts.forEach((altText) => {
        altText.applied = finalAltByIndex.has(altText.index) && finalAltByIndex.get(altText.index) === altText.alt;
        altText.finalAlt = finalAltByIndex.has(altText.index) ? finalAltByIndex.get(altText.index) : null;
      });

      const alreadyRecorded = runLog.errors.some((entry) => entry.stage === 'aplicacao' && entry.message === error);
      if (status === 'falha' && !alreadyRecorded) {
        runLog.errors.push({ stage: 'aplicacao', message: error, recordedAt });
      }
      outcome = { recorded: true, reason: null };
    });

    return outcome;
  }

  computeRunLogTotals(runLog) {
    const totals = { tokensIn: 0, tokensOut: 0, latencyMs: 0 };

    (runLog.llmCalls || []).forEach((call) => {
      totals.tokensIn += call.tokensIn || 0;
      totals.tokensOut += call.tokensOut || 0;
      totals.latencyMs += call.latencyMs || 0;
    });

    return totals;
  }

  /**
   * Log estruturado da última execução na aba (C10). Lê pela mesma fila das escritas,
   * então já inclui tudo o que foi enfileirado antes do pedido.
   */
  async getRunLog(tabId) {
    return this.enqueueRunLogTask(tabId, async () => {
      const runLog = await this.readRunLog(tabId);
      if (!runLog) {
        return null;
      }

      const writeError = this.runLogWriteErrors.get(tabId);
      return {
        ...runLog,
        totals: this.computeRunLogTotals(runLog),
        ...(writeError ? { storageError: writeError } : {})
      };
    });
  }

  /**
   * Logs de abas que não existem mais (sessão anterior, extensão recarregada) não são
   * alcançáveis por getRunLog: some com eles na inicialização.
   */
  async removeOrphanRunLogs() {
    const tabs = await chrome.tabs.query({});
    const openTabIds = new Set(tabs.map((tab) => String(tab.id)));
    const everything = await chrome.storage.local.get(null);
    const orphanKeys = Object.keys(everything)
      .filter((key) => key.startsWith('analysisRunLog:') && !openTabIds.has(key.slice('analysisRunLog:'.length)));

    if (orphanKeys.length > 0) {
      await chrome.storage.local.remove(orphanKeys);
    }
  }

  async isRunCurrent(tabId, runId) {
    const currentJob = await this.getAnalysisJob(tabId);
    return currentJob.runId === runId;
  }

  async updateAnalysisJobForRun(tabId, runId, patch) {
    if (!(await this.isRunCurrent(tabId, runId))) {
      return null;
    }

    return this.updateAnalysisJob(tabId, patch);
  }

  createAnalysisSteps() {
    return [
      { title: 'Analisando estrutura WCAG', description: 'Verificando conformidade com diretrizes WCAG 2.1', status: 'pending' },
      { title: 'Processando imagens', description: 'Gerando textos alternativos com IA', status: 'pending' },
      { title: 'Gerando recomendações', description: 'Analisando com IA para otimizações', status: 'pending' },
      { title: 'Preparando interface', description: 'Consolidando resultados para aplicação', status: 'pending' }
    ];
  }

  markStepStatus(steps, index, status) {
    return steps.map((step, currentIndex) => {
      if (currentIndex === index) {
        return { ...step, status };
      }

      return step;
    });
  }

  async ensureContentScript(tabId, documentId = null) {
    await chrome.scripting.executeScript({
      target: documentId ? { tabId, documentIds: [documentId] } : { tabId },
      files: ['wcag-evaluator.js', 'content.js']
    });
  }

  /**
   * `documentId` (só o gancho de automação usa) prende a mensagem a um documento: se a
   * aba navegou ou recarregou, a chamada falha em vez de chegar ao documento novo.
   */
  async sendMessageToTab(tabId, message, documentId = null) {
    const send = (callback) => (documentId
      ? chrome.tabs.sendMessage(tabId, message, { documentId }, callback)
      : chrome.tabs.sendMessage(tabId, message, callback));

    return new Promise((resolve, reject) => {
      send(async (response) => {
        if (!chrome.runtime.lastError) {
          resolve(response || { success: false, error: 'Sem resposta do content script' });
          return;
        }

        const runtimeError = chrome.runtime.lastError.message || '';

        if (runtimeError.includes('Receiving end does not exist')) {
          try {
            await this.ensureContentScript(tabId, documentId);
            send((retryResponse) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }

              resolve(retryResponse || { success: false, error: 'Sem resposta do content script' });
            });
          } catch (error) {
            reject(error);
          }
          return;
        }

        reject(new Error(runtimeError));
      });
    });
  }

  /**
   * O Accessify nunca manda nada para o servidor - as correções ficam só no DOM da
   * aba. Se a página não foi recarregada desde a última aplicação, essas marcas
   * (atributos data-accessify-*, aria-label injetados, a folha de estilo própria)
   * continuam lá, então uma nova análise naturalmente encontra bem menos problemas.
   * Isso não é um bug, mas engana quem quer comparar "antes x depois" sem recarregar
   * a página manualmente - por isso detectamos esse resíduo aqui.
   */
  async hasExistingAccessifyChanges(tabId, { documentId = null, throwOnError = false } = {}) {
    try {
      const results = await chrome.scripting.executeScript({
        target: documentId ? { tabId, documentIds: [documentId] } : { tabId },
        // #accessify-result é o resultado do gancho de automação, não uma correção
        func: () => !!document.querySelector(
          '[data-accessibility="true"], [data-accessify-skip], [data-accessify-sr-h1], [id^="accessify-"]:not(#accessify-result), [class*="accessify-"]'
        )
      });
      return !!results?.[0]?.result;
    } catch (error) {
      if (throwOnError) {
        throw new Error(`Não foi possível checar marcas anteriores do Accessify: ${error.message}`);
      }
      console.warn('Não foi possível checar mudanças anteriores do Accessify na aba:', error);
      return false;
    }
  }

  async reloadTabAndWait(tabId, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        settled = true;
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
      };

      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete' && !settled) {
          cleanup();
          resolve();
        }
      };

      const timeoutId = setTimeout(() => {
        if (!settled) {
          cleanup();
          reject(new Error('Tempo esgotado esperando a página recarregar.'));
        }
      }, timeoutMs);

      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.reload(tabId, {}, () => {
        if (chrome.runtime.lastError && !settled) {
          cleanup();
          reject(new Error(chrome.runtime.lastError.message));
        }
      });
    });
  }

  async startAnalysisJob(tabId, windowId, options = {}) {
    // Uma análise manual (painel, atalho, otimização automática) espera os runs do gancho
    // de automação terminarem, para nunca herdar os overrides de modelo/temperatura deles
    if (!options.automation && this.automationOverrides) {
      await this.automationQueue.catch(() => {});
    }

    const runId = this.generateRunId();
    const startedAt = new Date().toISOString();
    const autoTriggered = !!options.autoTriggered;
    const documentId = options.documentId || null;
    let steps = this.createAnalysisSteps();
    steps = this.markStepStatus(steps, 0, 'active');

    let currentTabInfo = null;
    try {
      currentTabInfo = await chrome.tabs.get(tabId);
    } catch (error) {
      // Aba pode ter sido fechada entre o clique e aqui; segue com o que temos
    }
    const pageUrl = options.pageUrl || currentTabInfo?.url || null;

    await this.setAnalysisJob(tabId, {
      ...this.getDefaultAnalysisJob(),
      runId,
      status: 'running',
      progress: 5,
      progressText: 'Preparando análise...',
      steps,
      targetTabId: tabId,
      windowId,
      startedAt,
      durationMs: 0,
      autoTriggered,
      optimizationsApplied: false,
      appliedChanges: 0,
      applyError: null,
      pageUrl
    });
    this.startRunLog(tabId, {
      ...this.createRunLog({ runId, tabId, pageUrl, startedAt }),
      automation: options.automation || null
    });
    let stage = 'preparacao';

    try {
      // O gancho de automação pede `priorChanges: 'fail'`: checa as marcas também e, se
      // houver, falha em vez de recarregar a página por conta própria
      const failOnPriorChanges = options.priorChanges === 'fail';
      const hasPriorChanges = (failOnPriorChanges || !autoTriggered)
        && await this.hasExistingAccessifyChanges(tabId, { documentId, throwOnError: failOnPriorChanges });
      if (hasPriorChanges && failOnPriorChanges) {
        throw new Error('A página já tem marcas do Accessify de uma execução anterior; abra uma aba limpa.');
      }
      if (hasPriorChanges) {
        stage = 'recarga';
        await this.updateAnalysisJobForRun(tabId, runId, {
          progress: 8,
          progressText: 'Recarregando a página para analisar o estado original (sem correções de uma execução anterior)...'
        });

        await this.reloadTabAndWait(tabId);
        // Um redirect no reload muda a URL que de fato será analisada
        chrome.tabs.get(tabId)
          .then((reloadedTab) => this.logRunUpdate(tabId, runId, (runLog) => {
            runLog.url = reloadedTab?.url || runLog.url;
          }))
          .catch(() => {});

        if (!(await this.isRunCurrent(tabId, runId))) {
          return await this.getAnalysisJob(tabId);
        }
      }

      await this.updateAnalysisJobForRun(tabId, runId, {
        progress: 10,
        progressText: 'Analisando página...'
      });

      await this.refreshSettings();
      this.logRunUpdate(tabId, runId, (runLog) => {
        runLog.provider = this.provider;
        runLog.model = this.getActiveModel();
      });
      stage = 'analise';

      const analysisResult = await this.sendMessageToTab(tabId, { action: 'analyzeAccessibility' }, documentId);
      if (!(await this.isRunCurrent(tabId, runId))) {
        return await this.getAnalysisJob(tabId);
      }

      if (!analysisResult?.success) {
        throw new Error(analysisResult?.error || 'Erro ao analisar página');
      }

      this.logRunUpdate(tabId, runId, (runLog) => {
        runLog.issuesTotal = Number.isFinite(analysisResult.summary?.total) ? analysisResult.summary.total : null;
        runLog.issuesFound = this.summarizeIssues(analysisResult.issues);
      });
      stage = 'imagens';
      steps = this.markStepStatus(steps, 0, 'completed');

      const extractedImages = await this.sendMessageToTab(tabId, {
        action: 'extractImages',
        includeDataUrl: (!this.isLocalProvider() && openRouterModelSupportsVision(this.selectedModel)) || this.isLocalVisionEnabled(),
        opaqueBackground: this.isLocalVisionEnabled(),
        maxImages: this.isLocalProvider()
          ? ACCESSIFY_AI_CONFIG.localLimits.maxImages
          : 8
      }, documentId);
      if (!(await this.isRunCurrent(tabId, runId))) {
        return await this.getAnalysisJob(tabId);
      }

      // Visão local: quando o canvas foi bloqueado (CORS), o recorte sai da própria aba
      const images = (Array.isArray(extractedImages) ? extractedImages : []).map((image) => (
        this.isLocalVisionEnabled() ? { ...image, captureTarget: { tabId, windowId, documentId } } : image
      ));
      const requiresImageProcessing = images.length > 0;
      if (requiresImageProcessing) {
        steps = this.markStepStatus(steps, 1, 'active');
      }

      console.log('Accessify AI scope:', {
        provider: this.provider,
        issueCount: analysisResult.summary?.total,
        imagesQueued: images.length,
        localLimits: this.isLocalProvider() ? ACCESSIFY_AI_CONFIG.localLimits : null
      });

      await this.updateAnalysisJobForRun(tabId, runId, {
        analysisResult,
        progress: requiresImageProcessing ? 40 : 60,
        progressText: requiresImageProcessing ? 'Processando imagens...' : 'Gerando recomendações...',
        steps
      });

      let imageAltResults = [];
      if (requiresImageProcessing) {
        const imageResults = await this.processImages(images);
        this.logRunUpdate(tabId, runId, (runLog) => this.recordImageResults(runLog, imageResults));
        if (!(await this.isRunCurrent(tabId, runId))) {
          return await this.getAnalysisJob(tabId);
        }

        imageAltResults = imageResults.filter((result) => result.success && result.alt);
      }

      steps = this.markStepStatus(steps, 1, 'completed');

      steps = this.markStepStatus(steps, 2, 'active');
      await this.updateAnalysisJobForRun(tabId, runId, {
        imageAltResults,
        progress: 75,
        progressText: 'Gerando recomendações...',
        steps
      });

      stage = 'recomendacoes';
      let optimizations = this.getEmptyOptimizations();
      const recommendationMeta = {};
      let recommendationError = null;
      try {
        optimizations = await this.analyzePageForOptimizations(
          analysisResult.pageContent,
          analysisResult.summary.issues,
          recommendationMeta
        );
      } catch (optimizationError) {
        recommendationError = optimizationError;
        console.warn('IA de recomendações falhou; seguindo com correções determinísticas:', optimizationError);
        await this.updateAnalysisJobForRun(tabId, runId, {
          progressText: 'IA não retornou JSON válido. Seguindo com correções automáticas...'
        });
      }

      // No modo local nenhum problema vai à IA de recomendações (meta fica sem attempted)
      if (recommendationMeta.attempted || recommendationError) {
        this.logRunUpdate(tabId, runId, (runLog) => {
          if (recommendationMeta.attempted) {
            this.recordLlmCall(runLog, 'recomendacoes', recommendationMeta, null, recommendationError?.message || null);
          }
          if (recommendationError) {
            runLog.errors.push({ stage: 'recomendacoes', message: recommendationError.message });
          }
        });
      }
      if (!(await this.isRunCurrent(tabId, runId))) {
        return await this.getAnalysisJob(tabId);
      }

      steps = this.markStepStatus(steps, 2, 'completed');
      steps = this.markStepStatus(steps, 3, 'completed');

      const completedAt = new Date().toISOString();
      await this.updateAnalysisJobForRun(tabId, runId, {
        status: 'completed',
        progress: 100,
        progressText: 'Análise concluída.',
        steps,
        optimizations,
        completedAt,
        durationMs: this.getDurationMs(startedAt, completedAt),
        error: null
      });

      return await this.getAnalysisJob(tabId);
    } catch (error) {
      this.logRunUpdate(tabId, runId, (runLog) => {
        runLog.errors.push({ stage, message: error.message });
      });

      if (await this.isRunCurrent(tabId, runId)) {
        const completedAt = new Date().toISOString();
        await this.updateAnalysisJob(tabId, {
          status: 'error',
          progressText: `Erro: ${error.message}`,
          error: error.message,
          completedAt,
          durationMs: this.getDurationMs(startedAt, completedAt)
        });
      }

      throw error;
    }
  }

  async resetAnalysisJob(tabId) {
    await this.setAnalysisJob(tabId, this.getDefaultAnalysisJob());
  }

  buildOptimizationsForApplication(optimizations, imageAltResults = []) {
    // `origin` só alimenta o log estruturado (C10): quem aplica ignora o campo.
    const imageAlts = imageAltResults
      .filter((result) => result?.success && typeof result.alt === 'string')
      .map(({ index, alt, source }) => ({ index, alt, origin: source || 'llm' }));

    return {
      ...optimizations,
      imageAlts: [...(optimizations?.imageAlts || []), ...imageAlts]
    };
  }

  async getAutoOptimizeSetting() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['autoOptimize'], (result) => resolve(result.autoOptimize === true));
    });
  }

  async setAutoOptimizeSetting(enabled) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ autoOptimize: enabled }, () => resolve(enabled));
    });
  }

  async loadIconImageData(path, size) {
    const response = await fetch(chrome.runtime.getURL(path));
    const iconBlob = await response.blob();
    const bitmap = await createImageBitmap(iconBlob);
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d');

    context.drawImage(bitmap, 0, 0, size, size);
    return context.getImageData(0, 0, size, size);
  }

  async getEnabledIconImageData(size) {
    if (this.enabledIconCache.has(size)) {
      return this.enabledIconCache.get(size);
    }

    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d');
    const baseImage = await this.loadIconImageData(this.iconPaths[size], size);

    context.putImageData(baseImage, 0, 0);

    const badgeRadius = Math.max(3, Math.round(size * 0.18));
    const badgeCenter = size - badgeRadius - Math.max(1, Math.round(size * 0.08));
    const outlineWidth = Math.max(1, Math.round(size * 0.06));

    context.beginPath();
    context.arc(badgeCenter, badgeCenter, badgeRadius, 0, Math.PI * 2);
    context.fillStyle = '#18a957';
    context.fill();
    context.lineWidth = outlineWidth;
    context.strokeStyle = '#ffffff';
    context.stroke();

    const imageData = context.getImageData(0, 0, size, size);
    this.enabledIconCache.set(size, imageData);
    return imageData;
  }

  async updateActionIcon(autoOptimizeEnabled) {
    if (!chrome.action?.setIcon) {
      return;
    }

    if (!autoOptimizeEnabled) {
      await chrome.action.setIcon({ path: this.iconPaths });
      return;
    }

    const imageData = {};
    for (const size of Object.keys(this.iconPaths).map(Number)) {
      imageData[size] = await this.getEnabledIconImageData(size);
    }

    await chrome.action.setIcon({ imageData });
  }

  async toggleAutoOptimizeSetting() {
    const currentValue = await this.getAutoOptimizeSetting();
    const nextValue = !currentValue;
    await this.setAutoOptimizeSetting(nextValue);
    await this.updateActionIcon(nextValue);
    return nextValue;
  }

  async handleTabCompleted(tab) {
    if (!tab?.id || !tab?.windowId || !this.isSupportedTab(tab)) {
      return;
    }

    // A aba navegou para uma URL diferente da que gerou o job salvo: o resultado
    // antigo não pertence mais a essa página, então some com ele (mesmo sem
    // auto-otimizar) para não exibir uma análise desatualizada quando o popup abrir.
    // Qualquer carregamento completo (nova URL OU um F5 na mesma URL, inclusive o
    // reload que o próprio startAnalysisJob dispara para "limpar o cache") significa
    // que o DOM está fresco de novo. Um resultado "completed"/"error" de antes não
    // descreve mais essa página. Nunca mexe num job "running": é assim que evitamos
    // apagar o job do nosso próprio reload controlado no meio de uma análise.
    const existingJob = await this.getAnalysisJob(tab.id);
    if (existingJob.status === 'completed' || existingJob.status === 'error') {
      await this.resetAnalysisJob(tab.id);
    }

    if (!tab.active) {
      return;
    }

    await this.refreshSettings();

    const autoOptimizeEnabled = await this.getAutoOptimizeSetting();
    if (!autoOptimizeEnabled || !this.isConfigured()) {
      return;
    }

    const currentJob = await this.getAnalysisJob(tab.id);
    if (currentJob.status === 'running' && currentJob.pageUrl === tab.url) {
      return;
    }

    this.runAutoOptimization(tab)
      .catch((error) => console.error('Erro ao executar otimização automática:', error));
  }

  async runAutoOptimization(tab) {
    const initialUrl = tab.url;
    const job = await this.startAnalysisJob(tab.id, tab.windowId, {
      autoTriggered: true,
      pageUrl: initialUrl
    });

    if (!job || job.status !== 'completed' || !job.analysisResult) {
      return job;
    }

    const logSkippedApply = (reason) => this.logRunUpdate(tab.id, job.runId, (runLog) => {
      runLog.apply = runLog.apply || { status: 'pulado', reason, recordedAt: new Date().toISOString() };
    });

    let currentTab = null;
    try {
      currentTab = await chrome.tabs.get(tab.id);
    } catch (error) {
      logSkippedApply('aba-indisponivel');
      return job;
    }

    if (!currentTab || currentTab.url !== initialUrl) {
      logSkippedApply('url-mudou');
      return job;
    }

    const optimizations = this.buildOptimizationsForApplication(job.optimizations, job.imageAltResults);
    const { updatePatch } = await this.applyJobOptimizations(tab, job, optimizations);

    return {
      ...job,
      ...updatePatch
    };
  }

  /**
   * Envia o payload de um job concluído para o content script aplicar e atualiza o job.
   * Usado pela otimização automática (payload de buildOptimizationsForApplication) e pelo
   * gancho de automação (payload do painel, AccessifyPanelFixes).
   */
  async applyJobOptimizations(tab, job, optimizations, documentId = null) {
    await this.updateAnalysisJobForRun(tab.id, job.runId, {
      status: 'running',
      progress: 90,
      progressText: 'Aplicando otimizações automaticamente...',
      durationMs: this.getDurationMs(job.startedAt)
    });

    let applyResult;
    try {
      applyResult = await this.sendMessageToTab(tab.id, {
        action: 'applyOptimizations',
        optimizations,
        runId: job.runId
      }, documentId);
    } catch (error) {
      this.logRunUpdate(tab.id, job.runId, (runLog) => {
        runLog.errors.push({ stage: 'aplicacao', message: error.message });
      });
      throw error;
    }

    // Sem resposta do content script ele não chegou a reportar nada ao log
    if (!applyResult?.success && !Number.isFinite(applyResult?.appliedCount)) {
      this.logRunUpdate(tab.id, job.runId, (runLog) => {
        if (!runLog.apply) {
          runLog.apply = { status: 'falha', appliedCount: 0, error: applyResult?.error || null, recordedAt: new Date().toISOString() };
          runLog.errors.push({ stage: 'aplicacao', message: applyResult?.error || 'Falha ao aplicar otimizações automaticamente.' });
        }
      });
    }

    const completedAt = new Date().toISOString();

    const updatePatch = applyResult?.success
      ? {
          status: 'completed',
          optimizationsApplied: true,
          appliedChanges: applyResult.appliedCount || 0,
          applyError: null,
          progress: 100,
          progressText: 'Análise concluída e otimizações aplicadas automaticamente.',
          completedAt,
          durationMs: this.getDurationMs(job.startedAt, completedAt)
        }
      : {
          status: 'completed',
          optimizationsApplied: false,
          appliedChanges: 0,
          applyError: applyResult?.error || 'Falha ao aplicar otimizações automaticamente.',
          progress: 100,
          progressText: 'Análise concluída. Falha ao aplicar otimizações automaticamente.',
          completedAt,
          durationMs: this.getDurationMs(job.startedAt, completedAt)
        };

    await this.updateAnalysisJobForRun(tab.id, job.runId, updatePatch);

    return { updatePatch, applyResult };
  }

  /**
   * Configuração aceita pelo gancho de automação (C11), por lista branca. Qualquer campo
   * fora dela invalida o run. Devolve { config } normalizada ou { error }.
   */
  validateAutomationConfig(raw) {
    const allowed = new Set(['provider', 'model', 'temperature', 'apply', 'runId', 'vision', 'reasoning', 'timeoutMs']);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { error: 'Configuração ausente ou inválida.' };
    }

    const unknown = Object.keys(raw).filter((key) => !allowed.has(key));
    if (unknown.length > 0) {
      return { error: `Campos não aceitos na configuração: ${unknown.join(', ')}.` };
    }

    const provider = raw.provider === undefined ? ACCESSIFY_AI_CONFIG.providers.local : raw.provider;
    if (provider !== ACCESSIFY_AI_CONFIG.providers.local) {
      return { error: 'O gancho de automação só aceita provider "local".' };
    }

    if (typeof raw.model !== 'string' || !/^[\w.:/-]{1,100}$/.test(raw.model)) {
      return { error: 'model precisa ser o nome de um modelo do Ollama (ex.: qwen3:8b).' };
    }

    if (raw.temperature !== undefined && !(typeof raw.temperature === 'number' && raw.temperature >= 0 && raw.temperature <= 2)) {
      return { error: 'temperature precisa ser um número entre 0 e 2.' };
    }

    for (const flag of ['apply', 'vision']) {
      if (raw[flag] !== undefined && typeof raw[flag] !== 'boolean') {
        return { error: `${flag} precisa ser booleano.` };
      }
    }

    if (raw.runId !== undefined && !(typeof raw.runId === 'string' && /^[\w.:-]{1,200}$/.test(raw.runId))) {
      return { error: 'runId aceita até 200 caracteres entre letras, números, ".", ":", "_" e "-".' };
    }

    if (raw.reasoning !== undefined && !['original', 'none'].includes(raw.reasoning)) {
      return { error: 'reasoning precisa ser "original" ou "none".' };
    }

    if (raw.timeoutMs !== undefined && !(Number.isInteger(raw.timeoutMs) && raw.timeoutMs >= 10000 && raw.timeoutMs <= 290000)) {
      return { error: 'timeoutMs precisa ser um inteiro entre 10000 e 290000.' };
    }

    return {
      config: {
        provider,
        model: raw.model,
        temperature: raw.temperature === undefined ? null : raw.temperature,
        apply: raw.apply !== false,
        runId: raw.runId || null,
        vision: raw.vision === true,
        reasoning: raw.reasoning || 'original',
        timeoutMs: raw.timeoutMs || 170000
      }
    };
  }

  /**
   * Runs de automação um de cada vez: os overrides de modelo/temperatura valem para a
   * instância inteira enquanto o run durar.
   */
  enqueueAutomation(task) {
    const next = this.automationQueue.catch(() => {}).then(task);
    this.automationQueue = next;
    return next;
  }

  async handleAutomationRun(sender, rawConfig) {
    const failure = (stage, message, extra = {}) => ({
      status: 'falha',
      runId: typeof rawConfig?.runId === 'string' ? rawConfig.runId : null,
      errors: [{ stage, message }],
      ...extra
    });

    if (!Number.isFinite(sender.tab?.id)) {
      return failure('automacao', 'O gancho de automação só aceita pedidos vindos de uma aba.');
    }

    const self = await chrome.management.getSelf();
    if (self.installType !== 'development') {
      return failure('automacao', 'O gancho de automação só funciona com a extensão descompactada (modo desenvolvedor).');
    }

    // Opt-in que só o harness grava (pelo service worker): sem ele, uma página qualquer
    // não consegue disparar runs na extensão descompactada do dia a dia
    const { automationHookEnabled } = await chrome.storage.local.get(['automationHookEnabled']);
    if (automationHookEnabled !== true) {
      return failure('automacao', 'O gancho de automação está desligado (automationHookEnabled).');
    }

    const { config, error } = this.validateAutomationConfig(rawConfig);
    if (error) {
      return failure('config', error);
    }

    const enqueuedAtMs = Date.now();
    const target = { tab: sender.tab, documentId: sender.documentId || null };
    return this.enqueueAutomation(async () => {
      const queueWaitMs = Date.now() - enqueuedAtMs;
      // Quem pediu pode ter ido embora (aba fechada) ou esperado mais que o prazo inteiro
      const tabStillOpen = await chrome.tabs.get(target.tab.id).then(() => true, () => false);
      if (!tabStillOpen) {
        return failure('automacao', 'A aba foi fechada antes de o run sair da fila.', { queueWaitMs });
      }
      if (queueWaitMs >= config.timeoutMs) {
        return failure('tempo', `O run esperou ${queueWaitMs} ms na fila, mais que o prazo de ${config.timeoutMs} ms.`, { queueWaitMs });
      }
      return this.runAutomation(target.tab, config, { documentId: target.documentId, queueWaitMs });
    });
  }

  /**
   * Run do gancho de automação: mesmo fluxo da análise e do "Aplicar" do painel (o payload
   * vem de AccessifyPanelFixes), com overrides de modelo, temperatura, raciocínio e visão
   * que valem só durante este run. Nunca recarrega a página: com marcas do Accessify no
   * DOM, o run falha. O prazo conta a partir daqui (fora da fila) e é conferido de novo
   * antes de aplicar; as chamadas ao LLM são abortadas quando ele acaba.
   */
  async runAutomation(tab, config, { documentId = null, queueWaitMs = 0 } = {}) {
    const startedAtMs = Date.now();
    const deadline = startedAtMs + config.timeoutMs - 5000;
    const condition = { ...config };
    const withoutHash = (url) => (typeof url === 'string' ? url.split('#')[0] : url);
    let job = null;
    let applyResult = null;

    this.automationOverrides = {
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      reasoning: config.reasoning,
      vision: config.vision,
      deadline
    };

    try {
      await this.refreshSettings();
      await this.assertLocalModelAvailable(config.model);

      job = await this.startAnalysisJob(tab.id, tab.windowId, {
        pageUrl: tab.url,
        priorChanges: 'fail',
        automation: condition,
        documentId
      });

      if (!job || job.status !== 'completed' || !job.analysisResult) {
        throw new Error(job?.error || 'A análise não terminou.');
      }

      if (config.apply) {
        if (Date.now() > deadline) {
          throw new Error(`Prazo de ${config.timeoutMs} ms esgotado antes da aplicação; nada foi aplicado.`);
        }

        const currentTab = await chrome.tabs.get(tab.id);
        if (withoutHash(currentTab.url) !== withoutHash(tab.url)) {
          throw new Error('A aba navegou durante a análise.');
        }

        const optimizations = new AccessifyPanelFixes(job.analysisResult)
          .combineOptimizations(job.optimizations, job.imageAltResults || []);
        ({ applyResult } = await this.applyJobOptimizations(tab, job, optimizations, documentId));
      }

      const runLog = await this.getRunLog(tab.id);
      const applied = !config.apply || !!applyResult?.success || !!applyResult?.nothingToApply;
      // O run aplicou, mas alguma chamada ao LLM falhou (o alt caiu na heurística)
      // (ou, na condição de visão, um alt saiu sem a imagem)
      const llmFailed = (runLog?.llmCalls || []).some((call) => call.error || call.networkError || (call.httpStatus && call.httpStatus >= 400))
        || (runLog?.altTexts || []).some((altText) => altText.source === 'erro')
        || (config.vision && (runLog?.altTexts || []).some((altText) => altText.source === 'llm' && !altText.vision));

      return {
        status: !applied ? 'falha' : (llmFailed ? 'parcial' : 'ok'),
        runId: config.runId,
        condition,
        jobRunId: job.runId,
        applied: config.apply ? !!applyResult?.success : false,
        appliedChanges: applyResult?.appliedCount || 0,
        nothingToApply: !!applyResult?.nothingToApply,
        queueWaitMs,
        durationMs: Date.now() - startedAtMs,
        runLog,
        errors: runLog?.errors || []
      };
    } catch (error) {
      const runLog = await this.getRunLog(tab.id).catch(() => null);
      const timedOut = Date.now() > deadline || /Prazo/.test(error.message);
      return {
        status: 'falha',
        runId: config.runId,
        condition,
        jobRunId: job?.runId || null,
        queueWaitMs,
        durationMs: Date.now() - startedAtMs,
        runLog,
        errors: [...(runLog?.errors || []), { stage: timedOut ? 'tempo' : 'automacao', message: error.message }]
      };
    } finally {
      this.automationOverrides = null;
      await this.refreshSettings();
    }
  }

  /**
   * O modelo pedido pelo run precisa existir no Ollama: sem isso, todas as chamadas de
   * alt text falhariam e o run cairia na heurística parecendo um sucesso.
   */
  async assertLocalModelAvailable(model) {
    const response = await fetch(`${this.getActiveBaseURL()}/models`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error(`Ollama respondeu ${response.status} ao listar os modelos.`);
    }

    const modelIds = ((await response.json()).data || []).map((item) => item.id);
    if (!modelIds.includes(model)) {
      throw new Error(`O modelo "${model}" não está no Ollama (ollama pull ${model}).`);
    }
  }

  async getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tabs[0] || null;
  }

  isSupportedTab(tab) {
    return /^https?:\/\//.test(tab?.url || '');
  }

  async openSidePanel(windowId) {
    if (!chrome.sidePanel?.open || !windowId) {
      return;
    }

    try {
      await chrome.sidePanel.open({ windowId });
    } catch (error) {
      console.warn('Não foi possível abrir o side panel:', error);
    }
  }

  async triggerAnalysisFromShortcut() {
    const tab = await this.getActiveTab();

    if (!tab?.id || !tab?.windowId) {
      return { success: false, error: 'Nenhuma aba ativa encontrada.' };
    }

    await this.openSidePanel(tab.windowId);

    if (!this.isSupportedTab(tab)) {
      return { success: false, error: 'A aba ativa precisa usar HTTP ou HTTPS para executar a análise.' };
    }

    this.startAnalysisJob(tab.id, tab.windowId)
      .catch((error) => console.error('Erro ao executar análise pelo atalho:', error));

    return { success: true };
  }

  async handleCommand(command) {
    if (command === this.analysisCommandName) {
      return this.triggerAnalysisFromShortcut();
    }

    if (command === this.toggleAutoOptimizeCommandName) {
      const autoOptimizeEnabled = await this.toggleAutoOptimizeSetting();
      return { success: true, autoOptimizeEnabled };
    }

    return { success: false, error: `Comando não suportado: ${command}` };
  }

  /**
   * Salva configurações
   */
  async saveSettings(settings = {}) {
    this.apiKey = settings.apiKey !== undefined ? settings.apiKey : this.apiKey;
    this.selectedModel = settings.selectedModel || this.selectedModel;
    this.provider = settings.provider || this.provider;
    this.localBaseUrl = settings.localBaseUrl || this.localBaseUrl;
    this.localModel = settings.localModel || this.localModel;

    return new Promise((resolve) => {
      chrome.storage.sync.set({
        apiKey: this.apiKey,
        selectedModel: this.selectedModel,
        provider: this.provider,
        localBaseUrl: this.localBaseUrl,
        localModel: this.localModel
      }, () => {
        console.log('Settings saved:', { provider: this.provider, model: this.getActiveModel() });
        resolve();
      });
    });
  }

  isLocalProvider() {
    return this.provider === ACCESSIFY_AI_CONFIG.providers.local;
  }

  /**
   * Alt text com visão no Ollama: só no gancho de automação com `vision: true`
   * (condição v1.1.0-vision do estudo). O uso manual continua só com texto.
   */
  isLocalVisionEnabled() {
    return this.isLocalProvider() && this.automationOverrides?.vision === true;
  }

  getActiveModel() {
    return this.isLocalProvider() ? this.localModel : this.selectedModel;
  }

  getActiveBaseURL() {
    const rawUrl = this.isLocalProvider() ? this.localBaseUrl : this.openRouterBaseURL;
    return (rawUrl || '').replace(/\/+$/, '');
  }

  isConfigured() {
    if (this.isLocalProvider()) {
      return !!(this.localBaseUrl && this.localModel);
    }

    return !!(this.apiKey && this.apiKey.length > 0);
  }

  /**
   * Normaliza o conteúdo retornado pelo modelo para texto.
   */
  extractMessageText(message) {
    if (!message) {
      return '';
    }

    let content = '';

    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = message.content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }

          if (part?.type === 'text' && typeof part.text === 'string') {
            return part.text;
          }

          return '';
        })
        .join('');
    }

    if (!content && typeof message.reasoning === 'string') {
      content = message.reasoning;
    }

    return this.stripThinking(content).trim();
  }

  stripThinking(text) {
    if (typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\/?think>/gi, '')
      .trim();
  }

  getEmptyOptimizations() {
    return {
      optimizations: [],
      structureChanges: [],
      ariaLabels: [],
      textChanges: [],
      styles: '',
      imageAlts: []
    };
  }

  extractJsonObject(text) {
    const normalized = this.stripThinking(text);
    const jsonMatch = normalized.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta inválida da IA - não contém JSON válido');
    }

    try {
      return this.normalizeOptimizations(JSON.parse(jsonMatch[0]));
    } catch (parseError) {
      const repaired = this.repairJsonObject(jsonMatch[0]);
      if (repaired) {
        console.warn('JSON da IA foi reparado após resposta malformada:', parseError.message);
        return this.normalizeOptimizations(repaired);
      }

      throw parseError;
    }
  }

  repairJsonObject(raw) {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return null;
    }

    let candidate = raw
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(candidate);
    } catch (error) {
      // continua para fechar JSON truncado
    }

    const quoteCount = (candidate.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 === 1) {
      candidate += '"';
    }

    const openBrackets = (candidate.match(/\[/g) || []).length;
    const closeBrackets = (candidate.match(/\]/g) || []).length;
    const openBraces = (candidate.match(/\{/g) || []).length;
    const closeBraces = (candidate.match(/\}/g) || []).length;
    candidate += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
    candidate += '}'.repeat(Math.max(0, openBraces - closeBraces));
    candidate = candidate.replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(candidate);
    } catch (error) {
      return null;
    }
  }

  normalizeOptimizations(parsed) {
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Resposta inválida da IA - JSON inesperado');
    }

    const normalized = {
      optimizations: Array.isArray(parsed.optimizations) ? parsed.optimizations : [],
      structureChanges: Array.isArray(parsed.structureChanges) ? parsed.structureChanges : [],
      ariaLabels: Array.isArray(parsed.ariaLabels) ? parsed.ariaLabels : [],
      textChanges: Array.isArray(parsed.textChanges) ? parsed.textChanges : [],
      styles: typeof parsed.styles === 'string' ? parsed.styles : '',
      imageAlts: Array.isArray(parsed.imageAlts) ? parsed.imageAlts : []
    };

    if (normalized.optimizations.length === 0) {
      normalized.optimizations = this.deriveOptimizationsList(normalized);
    }

    return normalized;
  }

  deriveOptimizationsList(parsed) {
    const items = [];

    (parsed.structureChanges || []).forEach((change) => {
      items.push({
        type: 'structure',
        priority: 'alta',
        description: change.reason || 'Ajuste estrutural de acessibilidade',
        implementation: change.selector || '',
        wcagCriterion: ''
      });
    });

    (parsed.textChanges || []).forEach((change) => {
      items.push({
        type: 'text',
        priority: 'média',
        description: change.reason || 'Ajuste de texto acessível',
        implementation: change.selector || '',
        wcagCriterion: ''
      });
    });

    (parsed.ariaLabels || []).forEach((change) => {
      items.push({
        type: 'aria',
        priority: 'média',
        description: `aria-label: ${change.label || ''}`.trim(),
        implementation: change.selector || '',
        wcagCriterion: '4.1.2'
      });
    });

    if (parsed.styles) {
      items.push({
        type: 'styles',
        priority: 'média',
        description: 'CSS de contraste, foco ou legibilidade',
        implementation: 'style[data-accessibility]',
        wcagCriterion: '1.4.3'
      });
    }

    return items;
  }

  buildChatHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (!this.isLocalProvider()) {
      headers.Authorization = `Bearer ${this.apiKey}`;
      headers['HTTP-Referer'] = 'https://accessify-extension.local';
      headers['X-Title'] = 'Accessify';
    }

    return headers;
  }

  /**
   * `meta`, quando informado, recebe as medições da chamada para o log estruturado
   * (C10): latência, tokens, finish_reason e o tamanho de content e de reasoning.
   */
  async chatCompletion({ messages, maxTokens, temperature = 0.3, json = false, meta = null }) {
    await this.refreshSettings();

    if (!this.isConfigured()) {
      throw new Error(this.isLocalProvider()
        ? 'Ollama local não está configurado. Acesse as opções do plugin.'
        : 'API key não configurada. Acesse as opções do plugin.');
    }

    // No gancho de automação a temperatura do run substitui o literal de cada chamador
    const overrides = this.automationOverrides;
    const effectiveTemperature = Number.isFinite(overrides?.temperature) ? overrides.temperature : temperature;

    const requestBody = {
      model: this.getActiveModel(),
      messages,
      max_tokens: maxTokens,
      temperature: effectiveTemperature
    };

    if (this.isLocalProvider()) {
      requestBody.think = false;
      requestBody.chat_template_kwargs = { enable_thinking: false };
      requestBody.options = {
        temperature: effectiveTemperature,
        num_predict: maxTokens,
        num_ctx: ACCESSIFY_AI_CONFIG.localLimits.numCtx
      };
      // O /v1 do Ollama ignora think/chat_template_kwargs; o que desliga o raciocínio é
      // reasoning_effort. Só na condição v1.1.0-fix do estudo (gancho com reasoning 'none').
      if (overrides?.reasoning === 'none') {
        requestBody.reasoning_effort = 'none';
      }
    } else if (json) {
      requestBody.response_format = { type: 'json_object' };
    }

    if (meta) {
      meta.attempted = true;
      meta.model = requestBody.model;
      meta.temperature = requestBody.temperature;
      meta.maxTokens = maxTokens;
      meta.reasoningEffort = requestBody.reasoning_effort || null;
    }

    // No gancho de automação a chamada respeita o prazo do run (o uso manual não tem prazo)
    const deadline = overrides?.deadline || null;
    if (deadline && Date.now() >= deadline) {
      throw new Error('Prazo do run de automação esgotado antes da chamada ao LLM.');
    }

    const requestStartedAt = Date.now();
    let response;
    let responseText;
    try {
      response = await fetch(`${this.getActiveBaseURL()}/chat/completions`, {
        method: 'POST',
        headers: this.buildChatHeaders(),
        body: JSON.stringify(requestBody),
        ...(deadline ? { signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())) } : {})
      });

      responseText = await response.text();
    } catch (networkError) {
      const timedOut = networkError?.name === 'TimeoutError';
      if (meta) {
        meta.latencyMs = Date.now() - requestStartedAt;
        meta.httpStatus = null;
        meta.networkError = timedOut ? 'timeout (prazo do run de automação)' : networkError.message;
      }
      if (timedOut) {
        throw new Error('Prazo do run de automação esgotado durante a chamada ao LLM.');
      }
      throw networkError;
    }

    if (meta) {
      meta.latencyMs = Date.now() - requestStartedAt;
      meta.httpStatus = response.status;
    }

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(`Erro da API (${response.status}): ${errorData.error?.message || errorData.message || responseText}`);
      } catch (parseError) {
        if (parseError.message.includes('Erro da API')) {
          throw parseError;
        }
        throw new Error(`Erro da API (${response.status}): ${responseText || 'Erro desconhecido'}`);
      }
    }

    const data = JSON.parse(responseText);

    if (meta) {
      const message = data.choices?.[0]?.message || {};
      meta.modelId = data.model || null;
      meta.systemFingerprint = data.system_fingerprint || null;
      meta.tokensIn = data.usage?.prompt_tokens ?? null;
      meta.tokensOut = data.usage?.completion_tokens ?? null;
      meta.finishReason = data.choices?.[0]?.finish_reason || null;
      meta.contentChars = typeof message.content === 'string' ? message.content.length : 0;
      meta.reasoningChars = typeof message.reasoning === 'string' ? message.reasoning.length : 0;
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Resposta inválida: estrutura inesperada');
    }

    return data;
  }

  /**
   * Limita e normaliza alt text para manter a descrição sucinta.
   */
  normalizeAltText(altText) {
    if (typeof altText !== 'string') {
      return '';
    }

    const normalized = altText.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 100) {
      return normalized;
    }

    const truncated = normalized.slice(0, 100);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 60 ? truncated.slice(0, lastSpace) : truncated).trim();
  }

  /**
   * Testa conexão com Ollama ou OpenRouter
   */
  async testConnection() {
    await this.refreshSettings();

    if (!this.isConfigured()) {
      throw new Error(this.isLocalProvider() ? 'Ollama local não está configurado' : 'API key não configurada');
    }

    if (this.isLocalProvider()) {
      const modelsResponse = await fetch(`${this.getActiveBaseURL()}/models`, {
        headers: this.buildChatHeaders()
      });

      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        const modelIds = (modelsData.data || []).map((item) => item.id);
        if (modelIds.length > 0 && !modelIds.includes(this.localModel)) {
          throw new Error(`Ollama respondeu, mas o modelo "${this.localModel}" não foi encontrado. Execute: ollama pull ${this.localModel}`);
        }
      }
    }

    return this.chatCompletion({
      messages: [
        {
          role: 'user',
          content: 'Responda com "OK" se você conseguir ler esta mensagem.'
        }
      ],
      maxTokens: ACCESSIFY_AI_CONFIG.tokens.test,
      temperature: 0
    });
  }

  buildImageContextPrompt(image) {
    const parts = [
      'Gere um alt text curto (10 a 100 caracteres) para esta imagem.',
      'Descreva só o que é visível ou o que o contexto da página indica com segurança.',
      'Não invente detalhes. Responda APENAS com o texto alternativo.'
    ];

    if (image.fileName) {
      parts.push(`Nome do arquivo: ${image.fileName}`);
    }
    if (image.title) {
      parts.push(`Title: ${image.title}`);
    }
    if (image.figcaption) {
      parts.push(`Figcaption: ${image.figcaption}`);
    }
    if (image.adjacentText) {
      parts.push(`Texto adjacente: ${image.adjacentText}`);
    }
    if (image.parentAriaLabel) {
      parts.push(`Nome do elemento pai: ${image.parentAriaLabel}`);
    }
    if (image.width && image.height) {
      parts.push(`Dimensões: ${image.width}x${image.height}`);
    }

    return parts.join('\n');
  }

  /**
   * Gera alt text para imagens usando IA
   */
  async generateImageAltText(image, meta = null) {
    const imageData = typeof image === 'string' ? { src: image } : (image || {});

    // Visão local (condição v1.1.0-vision): o Ollama só aceita imagem em base64. Os bytes
    // vêm do canvas da página ou, quando o canvas foi bloqueado (CORS), de um recorte da
    // captura da aba. Nunca de um fetch pelo service worker: ele iria à rede ao vivo (fora
    // do snapshot do estudo) e deixaria uma página ler imagens de outras origens.
    let localVisionDataUrl = null;
    let visionSource = null;
    let visionError = null;
    if (this.isLocalVisionEnabled()) {
      if (imageData.dataUrl) {
        localVisionDataUrl = imageData.dataUrl;
        visionSource = 'canvas';
      } else if (imageData.captureTarget) {
        try {
          localVisionDataUrl = await this.captureImageFromTab(imageData.captureTarget, imageData.index);
          visionSource = 'captura-da-aba';
        } catch (error) {
          visionError = error.message;
        }
      } else {
        visionError = 'Sem bytes da imagem para a visão.';
      }
    }

    const useVision = (!this.isLocalProvider()
      && openRouterModelSupportsVision(this.selectedModel)
      && !!(imageData.dataUrl || imageData.src))
      || !!localVisionDataUrl;

    if (meta) {
      meta.vision = useVision;
      meta.visionSource = visionSource;
      meta.visionError = visionError;
    }

    const userContent = useVision
      ? [
          { type: 'text', text: this.buildImageContextPrompt(imageData) },
          { type: 'image_url', image_url: { url: localVisionDataUrl || imageData.dataUrl || imageData.src } }
        ]
      : this.buildImageContextPrompt(imageData);

    const data = await this.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em acessibilidade web. Gere um texto alternativo conciso e descritivo. O texto deve ter entre 10 e 100 caracteres. Responda APENAS com o texto alternativo, sem explicações adicionais.'
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      maxTokens: this.isLocalProvider()
        ? ACCESSIFY_AI_CONFIG.tokens.localAltText
        : ACCESSIFY_AI_CONFIG.tokens.altText,
      temperature: 0.3,
      meta
    });

    const altText = this.normalizeAltText(this.extractMessageText(data.choices?.[0]?.message));
    if (!altText) {
      throw new Error('Resposta inválida da IA: alt text vazio');
    }

    return altText;
  }

  /**
   * Recorta uma imagem da captura da aba (os pixels que a página de fato mostra) e
   * devolve um data URL JPEG de no máximo 768 px, o mesmo formato do canvas do content
   * script. captureVisibleTab é coberto pela permissão <all_urls> que a extensão já tem.
   */
  async captureImageFromTab({ tabId, windowId, documentId }, index) {
    await chrome.tabs.update(tabId, { active: true });
    const rect = await this.sendMessageToTab(tabId, { action: 'prepareImageCapture', index }, documentId);
    if (!rect?.success) {
      throw new Error(rect?.error || 'Não foi possível posicionar a imagem para a captura.');
    }

    const screenshot = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    const bitmap = await createImageBitmap(await (await fetch(screenshot)).blob());
    try {
      const dpr = rect.devicePixelRatio || 1;
      const sx = Math.max(0, Math.round(rect.x * dpr));
      const sy = Math.max(0, Math.round(rect.y * dpr));
      const sw = Math.min(bitmap.width - sx, Math.round(rect.width * dpr));
      const sh = Math.min(bitmap.height - sy, Math.round(rect.height * dpr));
      if (sw <= 0 || sh <= 0) {
        throw new Error('A imagem ficou fora da área capturada.');
      }

      const maxSize = 768;
      const scale = Math.min(1, maxSize / Math.max(sw, sh));
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(sw * scale)), Math.max(1, Math.round(sh * scale)));
      canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
      const bytes = new Uint8Array(await jpeg.arrayBuffer());

      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }

      return `data:image/jpeg;base64,${btoa(binary)}`;
    } finally {
      bitmap.close();
    }
  }

  /**
   * Analisa página e gera recomendações de otimização
   */
  async analyzePageForOptimizations(pageContent, issues, meta = null) {
    const selectedIssues = this.selectIssuesForLlm(issues);
    if (selectedIssues.length === 0) {
      console.log('Nenhum problema essencial para a IA; pulando recomendações.');
      return this.getEmptyOptimizations();
    }

    console.log('Accessify issues enviadas à IA:', selectedIssues.map((issue) => issue.type));

    const issuesSummary = this.prepareIssuesSummary(selectedIssues);
    const htmlExcerptLength = this.isLocalProvider()
      ? ACCESSIFY_AI_CONFIG.localLimits.htmlExcerpt
      : 1500;
    const htmlExcerpt = typeof pageContent?.html === 'string' && htmlExcerptLength > 0
      ? pageContent.html.slice(0, htmlExcerptLength)
      : '';

    const data = await this.chatCompletion({
      messages: this.buildOptimizationMessages(pageContent, issuesSummary, htmlExcerpt),
      maxTokens: this.isLocalProvider()
        ? ACCESSIFY_AI_CONFIG.tokens.localOptimizations
        : ACCESSIFY_AI_CONFIG.tokens.optimizations,
      temperature: this.isLocalProvider() ? 0.1 : 0.3,
      json: true,
      meta
    });

    const content = this.extractMessageText(data.choices?.[0]?.message);
    if (!content) {
      throw new Error('Resposta inválida da IA - conteúdo vazio');
    }

    return this.extractJsonObject(content);
  }

  buildOptimizationMessages(pageContent, issuesSummary, htmlExcerpt) {
    if (this.isLocalProvider()) {
      return [
        {
          role: 'system',
          content: `Você corrige acessibilidade WCAG 2.1 A/AA para cegos e baixa visão.
Responda SOMENTE um JSON válido, sem markdown e sem comentários:
{"structureChanges":[{"selector":"css","newTag":"h1","attributes":{},"reason":"..."}],"ariaLabels":[],"textChanges":[{"selector":"css","text":"...","reason":"..."}],"styles":""}
Regras:
- No máximo 5 itens no total.
- Use só os seletores enviados.
- Se faltar H1, transforme o título principal visível em h1.
- Links genéricos: troque o texto visível por um texto que descreva o destino.
- Não invente seletores. Não descreva imagens.`
        },
        {
          role: 'user',
          content: `Título: ${pageContent.title}
URL: ${pageContent.url}

Problemas essenciais:
${issuesSummary}

JSON:`
        }
      ];
    }

    return [
      {
        role: 'system',
        content: `Você é um especialista em WCAG 2.1 e acessibilidade web. Sua tarefa é analisar uma página web e fornecer recomendações específicas para melhorar a acessibilidade para usuários cegos ou de baixa visão.

Responda em formato JSON com a seguinte estrutura:
{
  "structureChanges": [
    {
      "selector": "seletor CSS",
      "newTag": "nova tag HTML ou null",
      "attributes": {"atributo": "valor ou null para remover"},
      "reason": "motivo da mudança"
    }
  ],
  "ariaLabels": [
    {
      "selector": "seletor CSS",
      "label": "texto do aria-label",
      "role": "role ARIA ou null"
    }
  ],
  "textChanges": [
    {
      "selector": "seletor CSS",
      "text": "novo texto visível",
      "reason": "motivo da mudança"
    }
  ],
  "styles": "CSS adicional para melhorar acessibilidade"
}

Foque só no essencial:
1. Estrutura de headings (H1 ausente ou salto de nível)
2. Links genéricos ("clique aqui") com texto descritivo
3. Contraste baixo com CSS mínimo
4. Usar apenas seletores que apareçam nos problemas encontrados
5. Não repetir correções já cobertas por regras fixas (tabela, iframe, skip link, SVG, label, zoom)`
      },
      {
        role: 'user',
        content: `Analise esta página e forneça recomendações de otimização:

Título: ${pageContent.title}
URL: ${pageContent.url}
Idioma: ${pageContent.language}

Problemas encontrados:
${issuesSummary}
${htmlExcerpt ? `\nTrecho HTML:\n${htmlExcerpt}\n` : ''}
Forneça as recomendações em JSON válido.`
      }
    ];
  }

  selectIssuesForLlm(issues) {
    const skipTypes = new Set(ACCESSIFY_AI_CONFIG.llmSkipIssueTypes || []);
    const essentialTypes = this.isLocalProvider()
      ? new Set(ACCESSIFY_AI_CONFIG.localLimits.essentialIssueTypes)
      : null;

    return (issues || []).filter((issue) => {
      if (!issue || skipTypes.has(issue.type)) {
        return false;
      }

      if (essentialTypes && !essentialTypes.has(issue.type)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Prepara resumo dos problemas para enviar à IA
   */
  prepareIssuesSummary(issues) {
    const grouped = {};
    const maxPerType = this.isLocalProvider()
      ? ACCESSIFY_AI_CONFIG.localLimits.maxIssuesPerType
      : 2;

    issues.forEach((issue) => {
      if (!grouped[issue.type]) {
        grouped[issue.type] = [];
      }
      grouped[issue.type].push(issue);
    });

    let summary = '';
    Object.keys(grouped).forEach((type) => {
      summary += `\n${type}:\n`;
      grouped[type].slice(0, maxPerType).forEach((issue) => {
        summary += `  - ${issue.message}\n`;
        if (issue.selector) {
          summary += `    seletor: ${issue.selector}\n`;
        }
        if (issue.href) {
          summary += `    href: ${issue.href}\n`;
        }
        if (issue.text_content) {
          summary += `    texto: ${issue.text_content.slice(0, 80)}\n`;
        }
        if (issue.foreground_color && issue.background_color) {
          summary += `    cores: ${issue.foreground_color} / ${issue.background_color} (${issue.contrast_ratio?.toFixed?.(2) || issue.contrast_ratio})\n`;
        }
      });
      if (grouped[type].length > maxPerType) {
        summary += `  ... e mais ${grouped[type].length - maxPerType}\n`;
      }
    });

    return summary;
  }

  /**
   * Processa múltiplas imagens para gerar alt texts
   */
  async processImages(images) {
    const results = [];
    let llmCalls = 0;
    const maxLlmCalls = this.isLocalProvider()
      ? ACCESSIFY_AI_CONFIG.localLimits.maxImageLlmCalls
      : images.length;

    // `source`, `selector` e `llm` só alimentam o log estruturado (C10); quem aplica os
    // alts continua lendo apenas index/alt/success.
    for (const image of images) {
      const selector = image.selector || null;
      const heuristicAlt = this.buildHeuristicImageAlt(image);
      if (heuristicAlt && this.isLocalProvider()) {
        results.push({
          index: image.index,
          src: image.src,
          alt: heuristicAlt,
          success: true,
          source: 'heuristic',
          selector
        });
        continue;
      }

      if (llmCalls >= maxLlmCalls) {
        results.push({
          index: image.index,
          src: image.src,
          alt: heuristicAlt || this.humanizeFileName(image.fileName) || 'Imagem',
          success: true,
          source: 'limite',
          selector
        });
        continue;
      }

      const llm = {};
      try {
        llmCalls += 1;
        const altText = await this.generateImageAltText(image, llm);
        results.push({
          index: image.index,
          src: image.src,
          alt: altText,
          success: true,
          source: 'llm',
          selector,
          llm
        });

        await new Promise((resolve) => setTimeout(resolve, this.isLocalProvider() ? 150 : 500));
      } catch (error) {
        results.push({
          index: image.index,
          src: image.src,
          alt: heuristicAlt || image.currentAlt || this.humanizeFileName(image.fileName) || 'Imagem',
          success: false,
          error: error.message,
          source: 'erro',
          selector,
          llm
        });
      }
    }

    return results;
  }

  buildHeuristicImageAlt(image) {
    const candidates = [
      image?.figcaption,
      image?.title,
      image?.parentAriaLabel,
      image?.adjacentText
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeAltText(candidate);
      if (normalized.length >= 8) {
        return normalized;
      }
    }

    return '';
  }

  humanizeFileName(fileName) {
    if (typeof fileName !== 'string' || fileName.trim().length === 0) {
      return '';
    }

    const base = fileName
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (base.length < 6 || /^\d+$/.test(base.replace(/\s/g, ''))) {
      return '';
    }

    if (/^[a-f0-9\s]{8,}$/i.test(base)) {
      return '';
    }

    return this.normalizeAltText(base);
  }
}

// Criar instância global
const optimizer = new AccessibilityOptimizer();

chrome.runtime.onInstalled.addListener(() => {
  optimizer.initializeSidePanel();
  optimizer.getAutoOptimizeSetting()
    .then((enabled) => optimizer.updateActionIcon(enabled))
    .catch((error) => console.error('Erro ao atualizar ícone da extensão na instalação:', error));
  optimizer.removeOrphanRunLogs()
    .catch((error) => console.error('Erro ao limpar logs estruturados órfãos:', error));
});

chrome.runtime.onStartup.addListener(() => {
  optimizer.initializeSidePanel();
  optimizer.getAutoOptimizeSetting()
    .then((enabled) => optimizer.updateActionIcon(enabled))
    .catch((error) => console.error('Erro ao atualizar ícone da extensão na inicialização:', error));
  optimizer.removeOrphanRunLogs()
    .catch((error) => console.error('Erro ao limpar logs estruturados órfãos:', error));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || !changes.autoOptimize) {
    return;
  }

  optimizer.updateActionIcon(changes.autoOptimize.newValue === true)
    .catch((error) => console.error('Erro ao sincronizar ícone da extensão:', error));
});

chrome.commands.onCommand.addListener((command) => {
  optimizer.handleCommand(command)
    .catch((error) => console.error('Erro ao executar comando da extensão:', error));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') {
    return;
  }

  optimizer.handleTabCompleted(tab)
    .catch((error) => console.error('Erro ao tratar carregamento da aba:', error));
});

// Evita acumular estado de análise de abas que não existem mais no storage.
chrome.tabs.onRemoved.addListener((tabId) => {
  optimizer.removeAnalysisJob(tabId)
    .catch((error) => console.error('Erro ao limpar estado da análise da aba fechada:', error));
  // Pela fila: uma escrita do log já em andamento não pode recriar a chave depois
  optimizer.enqueueRunLogTask(tabId, () => optimizer.removeRunLog(tabId))
    .then(() => optimizer.runLogWriteErrors.delete(tabId))
    .catch((error) => console.error('Erro ao limpar o log estruturado da aba fechada:', error));
});

// Escutar mensagens do popup e content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    optimizer.loadSettings()
      .then(() => {
        sendResponse({
          apiKey: optimizer.apiKey ? '***' : '',
          selectedModel: optimizer.selectedModel,
          provider: optimizer.provider,
          localBaseUrl: optimizer.localBaseUrl,
          localModel: optimizer.localModel,
          isConfigured: optimizer.isConfigured(),
          displayName: getModelDisplayName(optimizer.selectedModel, optimizer.provider, optimizer.localModel)
        });
      })
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'saveSettings') {
    optimizer.saveSettings({
      apiKey: request.apiKey,
      selectedModel: request.selectedModel,
      provider: request.provider,
      localBaseUrl: request.localBaseUrl,
      localModel: request.localModel
    })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'testConnection') {
    optimizer.testConnection()
      .then(result => {
        console.log('Test connection successful');
        sendResponse({ success: true, message: 'Conexão bem-sucedida!' });
      })
      .catch(error => {
        console.error('Test connection failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'generateImageAltText') {
    optimizer.generateImageAltText(request.imageUrl)
      .then(altText => sendResponse({ success: true, altText }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'analyzePageForOptimizations') {
    optimizer.analyzePageForOptimizations(request.pageContent, request.issues)
      .then(optimizations => sendResponse({ success: true, optimizations }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'processImages') {
    optimizer.processImages(request.images)
      .then(results => sendResponse({ success: true, results }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'startAnalysisJob') {
    optimizer.startAnalysisJob(request.tabId, request.windowId)
      .catch((error) => console.error('Erro ao executar analysis job:', error));
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'triggerShortcutAnalysis') {
    optimizer.triggerAnalysisFromShortcut()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getAnalysisJob') {
    if (!Number.isFinite(request.tabId)) {
      sendResponse({ success: false, error: 'tabId é obrigatório para consultar o estado da análise' });
      return false;
    }
    optimizer.getAnalysisJob(request.tabId)
      .then((job) => sendResponse({ success: true, job }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'automationRun') {
    optimizer.handleAutomationRun(sender, request.config)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({
        status: 'falha',
        runId: typeof request.config?.runId === 'string' ? request.config.runId : null,
        errors: [{ stage: 'automacao', message: error.message }]
      }));
    return true;
  }

  if (request.action === 'getRunLog') {
    const tabId = Number.isFinite(request.tabId) ? request.tabId : sender.tab?.id;
    if (!Number.isFinite(tabId)) {
      sendResponse({ success: false, error: 'tabId é obrigatório para consultar o log estruturado' });
      return false;
    }
    optimizer.getRunLog(tabId)
      .then((runLog) => sendResponse({ success: true, runLog }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'recordApplyResult') {
    if (!Number.isFinite(sender.tab?.id)) {
      sendResponse({ success: false, error: 'recordApplyResult só é aceito vindo de uma aba' });
      return false;
    }
    optimizer.recordApplyResult(sender.tab.id, sender.tab.url, request.result)
      .then((outcome) => sendResponse({ success: true, ...outcome }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'resetAnalysisJob') {
    if (!Number.isFinite(request.tabId)) {
      sendResponse({ success: false, error: 'tabId é obrigatório para reiniciar o estado da análise' });
      return false;
    }
    optimizer.resetAnalysisJob(request.tabId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  sendResponse({ success: false, error: `Ação não suportada: ${request.action}` });
  return false;
});

console.log('Accessify - Background Service Worker Loaded');
