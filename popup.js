/**
 * Popup Script - Interface principal do plugin
 */

class PopupController {
  constructor() {
    this.currentTab = null;
    this.analysisResult = null;
    this.optimizations = null;
    this.imageAltResults = [];
    this.steps = [];
    this.jobState = null;
    this.pollingId = null;
    this.reportCollapsed = false;
    this.init();
  }

  /**
   * Inicializa o popup
   */
  async init() {
    this.currentTab = await this.getCurrentTab();
    this.setupEventListeners();
    this.setupStorageListeners();
    this.checkConfiguration();
    this.loadAutoOptimizeSettings();
    await this.loadPanelState();
    await this.refreshJobState();
    this.startPolling();
  }

  /**
   * Obtém a aba atual
   */
  async getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  /**
   * Configura event listeners
   */
  setupEventListeners() {
    document.getElementById('analyze-btn').addEventListener('click', () => this.startAnalysis());
    document.getElementById('apply-optimizations-btn').addEventListener('click', () => this.applyOptimizations());
    document.getElementById('new-analysis-btn').addEventListener('click', () => this.resetUI());
    document.getElementById('restart-analysis-btn').addEventListener('click', () => this.restartAnalysis());
    document.getElementById('settings-link').addEventListener('click', () => this.openSettings());
    document.getElementById('auto-optimize-toggle').addEventListener('click', () => this.toggleAutoOptimize());
    document.getElementById('collapse-toggle').addEventListener('click', () => this.toggleCollapsed());
    document.getElementById('report-toggle').addEventListener('click', () => this.toggleReportCollapsed());
  }

  setupStorageListeners() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') {
        return;
      }

      if (changes.selectedModel || changes.apiKey) {
        this.checkConfiguration();
      }

      if (changes.autoOptimize) {
        this.loadAutoOptimizeSettings();
      }
    });
  }

  async loadPanelState() {
    const settings = await chrome.storage.local.get(['sidePanelCollapsed', 'reportCollapsed']);
    document.body.classList.toggle('panel-collapsed', !!settings.sidePanelCollapsed);
    this.reportCollapsed = !!settings.reportCollapsed;
    this.updateCollapseButtonLabel();
    this.updateReportToggle();
  }

  async toggleCollapsed() {
    const collapsed = document.body.classList.toggle('panel-collapsed');
    await chrome.storage.local.set({ sidePanelCollapsed: collapsed });
    this.updateCollapseButtonLabel();
  }

  updateCollapseButtonLabel() {
    const button = document.getElementById('collapse-toggle');
    if (!button) {
      return;
    }

    const collapsed = document.body.classList.contains('panel-collapsed');
    button.textContent = collapsed ? '▸' : '◂';
    button.title = collapsed ? 'Expandir painel' : 'Colapsar painel';
    button.setAttribute('aria-label', collapsed ? 'Expandir painel' : 'Colapsar painel');
  }

  async toggleReportCollapsed() {
    this.reportCollapsed = !this.reportCollapsed;
    await chrome.storage.local.set({ reportCollapsed: this.reportCollapsed });
    this.updateReportToggle();
  }

  updateReportToggle() {
    const toggle = document.getElementById('report-toggle');
    const body = document.getElementById('report-body');

    if (!toggle || !body) {
      return;
    }

    body.style.display = this.reportCollapsed ? 'none' : 'block';
    toggle.textContent = this.reportCollapsed ? 'Expandir' : 'Ocultar';
  }

  startPolling() {
    if (this.pollingId) {
      clearInterval(this.pollingId);
    }

    this.pollingId = setInterval(() => {
      this.refreshJobState().catch((error) => console.error('Erro ao atualizar estado do job:', error));
    }, 1000);
  }

  async refreshJobState() {
    this.currentTab = await this.getCurrentTab();

    const response = await this.sendMessageToBackground({ action: 'getAnalysisJob' });
    if (!response?.success) {
      return;
    }

    this.jobState = response.job;
    this.renderJobState();
  }

  renderJobState() {
    const job = this.jobState;
    if (!job || job.status === 'idle') {
      this.updateProcessingTime(null);
      if (this.analysisResult || this.optimizations || this.imageAltResults.length > 0) {
        document.getElementById('main-section').style.display = 'block';
        document.getElementById('progress-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
      }
      return;
    }

    if (job.status === 'running') {
      this.analysisResult = job.analysisResult;
      this.imageAltResults = job.imageAltResults || [];
      this.showProgressSection();
      this.steps = job.steps || [];
      this.updateStepsDisplay();
      this.updateProgress(job.progressText || 'Processando...', job.progress || 0);
      this.updateProcessingTime(job);
      return;
    }

    if (job.status === 'completed' && job.analysisResult) {
      this.analysisResult = job.analysisResult;
      this.imageAltResults = job.imageAltResults || [];
      this.optimizations = this.combineOptimizations(job.optimizations, this.imageAltResults);
      this.steps = job.steps || [];
      this.updateProcessingTime(job);
      this.showResults(job.analysisResult.summary);
      return;
    }

    if (job.status === 'error') {
      this.updateProcessingTime(job);
      this.showError(`Erro: ${job.error || 'Falha desconhecida'}`);
    }
  }

  async sendMessageToBackground(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const runtimeError = chrome.runtime.lastError.message || '';

          if (runtimeError.includes('message channel closed before a response was received')) {
            resolve({ success: false, error: 'O processo em segundo plano foi reiniciado antes de responder. Tente novamente.' });
            return;
          }

          resolve({ success: false, error: runtimeError });
          return;
        }

        resolve(response || { success: false, error: 'Sem resposta do background script.' });
      });
    });
  }

  getModelDisplayName(modelId) {
    const modelNames = {
      'openai/gpt-5-nano': 'OpenAI GPT-5 Nano',
      'moonshotai/kimi-k2.5': 'MoonshotAI Kimi K2.5',
      'qwen/qwen3.5-flash-02-23': 'Qwen 3.5 Flash',
      'google/gemini-3.1-flash-lite-preview': 'Google Gemini 3.1 Flash Lite',
      'x-ai/grok-4.1-fast': 'X.AI Grok 4.1 Fast'
    };

    return modelNames[modelId] || modelId || 'Modelo não definido';
  }

  /**
   * Verifica configuração da API
   */
  async checkConfiguration() {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      const statusInfo = document.getElementById('status-info');
      const analyzeBtn = document.getElementById('analyze-btn');

      if (response.isConfigured) {
        statusInfo.innerHTML = `✓ Modelo configurado: <strong>${this.getModelDisplayName(response.selectedModel)}</strong>`;
        statusInfo.className = 'info-box';
        analyzeBtn.disabled = false;
      } else {
        statusInfo.innerHTML = `⚠️ API não configurada. Clique em "Configurações" para adicionar sua chave de API do OpenRouter.`;
        statusInfo.className = 'info-box warning';
        analyzeBtn.disabled = true;
      }

      document.getElementById('status-text').textContent = response.isConfigured ? 'Pronto' : 'Configuração necessária';
    });
  }

  /**
   * Carrega configuração de otimização automática
   */
  async loadAutoOptimizeSettings() {
    const settings = await chrome.storage.sync.get(['autoOptimize']);
    const toggle = document.getElementById('auto-optimize-toggle');

    toggle.classList.toggle('active', settings.autoOptimize === true);
  }

  /**
   * Alterna otimização automática
   */
  async toggleAutoOptimize() {
    const toggle = document.getElementById('auto-optimize-toggle');
    const isActive = toggle.classList.toggle('active');
    
    await chrome.storage.sync.set({ autoOptimize: isActive });
  }

  /**
   * Inicia análise da página
   */
  async startAnalysis() {
    this.currentTab = await this.getCurrentTab();

    if (!this.isSupportedPage(this.currentTab)) {
      this.showError('Erro: abra uma página web HTTP ou HTTPS antes de analisar acessibilidade.');
      return;
    }

    this.showProgressSection();
    this.updateProgress('Analisando página...', 10);
    this.steps = [];

    try {
      const response = await this.sendMessageToBackground({
        action: 'startAnalysisJob',
        tabId: this.currentTab.id,
        windowId: this.currentTab.windowId
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Erro ao iniciar análise');
      }

      await this.refreshJobState();
    } catch (error) {
      console.error('Erro na análise:', error);
      this.showError(`Erro: ${error.message}`);
    }
  }

  async restartAnalysis() {
    await this.sendMessageToBackground({ action: 'resetAnalysisJob' });
    this.analysisResult = null;
    this.optimizations = null;
    this.imageAltResults = [];
    this.jobState = null;
    await this.startAnalysis();
  }

  /**
   * Extrai imagens da página
   */
  async sendMessageToContent(message, tabId = this.getTargetTabId()) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (!chrome.runtime.lastError) {
          resolve(response || { success: false, error: 'Sem resposta do content script' });
          return;
        }

        const runtimeError = chrome.runtime.lastError.message;

        if (runtimeError.includes('message channel closed before a response was received')) {
          reject(new Error('A conexão com o processo em segundo plano foi encerrada antes da resposta.'));
          return;
        }

        if (runtimeError.includes('Receiving end does not exist')) {
          this.ensureContentScript()
            .then(() => {
              chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(this.formatContentScriptError(chrome.runtime.lastError.message)));
                  return;
                }

                resolve(retryResponse || { success: false, error: 'Sem resposta do content script' });
              });
            })
            .catch((error) => reject(error));
          return;
        }

        reject(new Error(this.formatContentScriptError(runtimeError)));
      });
    });
  }

  /**
   * Verifica se a aba atual aceita análise.
   */
  isSupportedPage() {
    const tab = arguments[0] || this.currentTab;

    if (!tab?.url) {
      return false;
    }

    return /^https?:\/\//.test(tab.url);
  }

  getTargetTabId() {
    return this.jobState?.targetTabId || this.currentTab?.id;
  }

  /**
   * Injeta o content script na aba quando ele ainda não foi carregado.
   */
  async ensureContentScript() {
    const tabId = this.getTargetTabId();

    if (!tabId) {
      throw new Error('Aba ativa não encontrada.');
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }

  /**
   * Traduz erros de mensageria para mensagens acionáveis.
   */
  formatContentScriptError(errorMessage) {
    if (errorMessage.includes('Cannot access a chrome:// URL')) {
      return 'esta página é protegida pelo navegador e não pode ser analisada.';
    }

    if (errorMessage.includes('Cannot access contents of the page')) {
      return 'o navegador não permitiu acessar o conteúdo desta página.';
    }

    if (errorMessage.includes('The extensions gallery cannot be scripted')) {
      return 'a Chrome Web Store não pode ser analisada por extensões.';
    }

    if (errorMessage.includes('Missing host permission for the tab')) {
      return 'faltou permissão para acessar esta aba.';
    }

    return errorMessage;
  }

  /**
   * Adiciona etapa ao display
   */
  addStep(title, description, status = 'pending') {
    this.steps.push({ title, description, status });
    this.updateStepsDisplay();
  }

  /**
   * Marca etapa como completa
   */
  completeStep(index) {
    if (this.steps[index]) {
      this.steps[index].status = 'completed';
      this.updateStepsDisplay();
    }
  }

  /**
   * Atualiza display das etapas
   */
  updateStepsDisplay() {
    const container = document.getElementById('steps-container');
    container.innerHTML = '';

    this.steps.forEach((step, index) => {
      const stepDiv = document.createElement('div');
      stepDiv.className = `step-item ${step.status}`;
      
      const statusIcon = step.status === 'completed' ? '✓' : step.status === 'active' ? '⟳' : '○';
      
      stepDiv.innerHTML = `
        <div class="step-title">${statusIcon} ${step.title}</div>
        <div class="step-description">${step.description}</div>
      `;

      container.appendChild(stepDiv);
    });
  }

  /**
   * Atualiza barra de progresso
   */
  updateProgress(text, percentage) {
    document.getElementById('progress-text').textContent = text;
    document.getElementById('progress-fill').style.width = percentage + '%';
  }

  getJobDurationMs(job = this.jobState) {
    if (!job?.startedAt) {
      return null;
    }

    if (job.status === 'running') {
      const startedAtMs = Date.parse(job.startedAt);

      if (!Number.isFinite(startedAtMs)) {
        return null;
      }

      return Math.max(0, Date.now() - startedAtMs);
    }

    if (typeof job.durationMs === 'number' && job.durationMs >= 0) {
      return job.durationMs;
    }

    const startedAtMs = Date.parse(job.startedAt);
    const completedAtMs = Date.parse(job.completedAt || new Date().toISOString());

    if (!Number.isFinite(startedAtMs) || !Number.isFinite(completedAtMs)) {
      return null;
    }

    return Math.max(0, completedAtMs - startedAtMs);
  }

  formatDuration(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return '--';
    }

    if (durationMs < 1000) {
      return `${durationMs} ms`;
    }

    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
      return `${seconds}s`;
    }

    return `${minutes} min ${String(seconds).padStart(2, '0')}s`;
  }

  updateProcessingTime(job = this.jobState) {
    const processingTime = document.getElementById('processing-time');

    if (!processingTime) {
      return;
    }

    const durationMs = this.getJobDurationMs(job);

    if (durationMs === null) {
      processingTime.style.display = 'none';
      processingTime.textContent = 'Tempo de processamento: --';
      return;
    }

    processingTime.style.display = 'block';
    processingTime.textContent = `Tempo de processamento: ${this.formatDuration(durationMs)}`;
  }

  /**
   * Mostra seção de progresso
   */
  showProgressSection() {
    document.getElementById('main-section').style.display = 'none';
    document.getElementById('progress-section').style.display = 'block';
    document.getElementById('results-section').style.display = 'none';
    this.steps = [];
  }

  /**
   * Mostra resultados
   */
  showResults(summary) {
    document.getElementById('progress-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';

    const autoOptimizationSummary = this.getAutoOptimizationSummary();
    const durationLabel = this.formatDuration(this.getJobDurationMs());

    const summaryDiv = document.getElementById('results-summary');
    summaryDiv.innerHTML = `
      <div class="summary-item">
        <span class="summary-label">Total de problemas:</span>
        <span class="summary-value">${summary.total}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Críticos:</span>
        <span class="summary-value" style="color: #f44336;">${summary.critical}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Avisos:</span>
        <span class="summary-value" style="color: #ff9800;">${summary.warnings}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Otimizações recomendadas:</span>
        <span class="summary-value">${this.optimizations?.optimizations?.length || 0}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Tempo de processamento:</span>
        <span class="summary-value">${durationLabel}</span>
      </div>
      ${autoOptimizationSummary}
    `;

    this.updateResultsActions();
  }

  getAutoOptimizationSummary() {
    const job = this.jobState;

    if (!job?.autoTriggered) {
      return '';
    }

    if (job.optimizationsApplied) {
      return `
        <div class="summary-item">
          <span class="summary-label">Aplicação automática:</span>
          <span class="summary-value" style="color: #2e7d32;">${job.appliedChanges || 0} alterações aplicadas</span>
        </div>
      `;
    }

    if (job.applyError) {
      return `
        <div class="summary-item">
          <span class="summary-label">Aplicação automática:</span>
          <span class="summary-value" style="color: #c62828;">Falhou</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Detalhe:</span>
          <span class="summary-value">${job.applyError}</span>
        </div>
      `;
    }

    return '';
  }

  updateResultsActions() {
    const applyButton = document.getElementById('apply-optimizations-btn');

    if (!applyButton) {
      return;
    }

    const autoApplied = !!this.jobState?.autoTriggered && !!this.jobState?.optimizationsApplied;

    applyButton.disabled = autoApplied;
    applyButton.innerHTML = autoApplied
      ? '<span class="section-icon">✓</span> Otimizações já aplicadas automaticamente'
      : '<span class="section-icon">✨</span> Aplicar Otimizações';
  }

  renderReport({ status, summaryLines, steps }) {
    const reportSection = document.getElementById('report-section');
    const reportStatus = document.getElementById('report-status');
    const reportSummary = document.getElementById('report-summary');
    const reportSteps = document.getElementById('report-steps');

    reportSection.style.display = 'block';
    reportStatus.className = `report-status ${status}`;
    reportStatus.textContent = this.getReportStatusText(status);
    reportSummary.innerHTML = summaryLines.map((line) => `<div>${line}</div>`).join('');
    reportSteps.innerHTML = '';

    steps.forEach((step) => {
      const stepDiv = document.createElement('div');
      stepDiv.className = `step-item ${step.status}`;
      const statusIcon = step.status === 'completed' ? '✓' : step.status === 'active' ? '⟳' : step.status === 'error' ? '✗' : '○';
      stepDiv.innerHTML = `
        <div class="step-title">${statusIcon} ${step.title}</div>
        <div class="step-description">${step.description}</div>
      `;
      reportSteps.appendChild(stepDiv);
    });

    this.updateReportToggle();
  }

  getReportStatusText(status) {
    if (status === 'processing') {
      return 'Aplicando otimizações...';
    }

    if (status === 'success') {
      return 'Otimizações aplicadas com sucesso';
    }

    if (status === 'error') {
      return 'Falha ao aplicar otimizações';
    }

    return 'Relatório';
  }

  async analyzeCurrentPage() {
    const analysisResult = await this.sendMessageToContent({ action: 'analyzeAccessibility' });

    if (!analysisResult?.success) {
      throw new Error(analysisResult?.error || 'Erro ao reanalisar a página');
    }

    return analysisResult;
  }

  /**
   * Aplica otimizações à página
   */
  async applyOptimizations() {
    if (!this.optimizations) {
      alert('Nenhuma otimização disponível');
      return;
    }

    const optimizationStartedAt = Date.now();
    const analysisDurationMs = this.getJobDurationMs() || 0;

    try {
      const steps = [
        { title: 'Aplicando primeira rodada', description: 'Executando correções geradas para a página atual', status: 'active' },
        { title: 'Consolidando resultado final', description: 'Atualizando o relatório com o estado final da página', status: 'pending' }
      ];

      this.renderReport({
        status: 'processing',
        summaryLines: [
          `Página analisada: ${this.analysisResult?.pageContent?.title || 'Página atual'}`,
          `Problemas encontrados: ${this.analysisResult?.summary?.total || 0}`,
          'Aplicando correções na página atual...'
        ],
        steps
      });

      const firstPassResult = await this.sendMessageToContent({
        action: 'applyOptimizations',
        optimizations: this.optimizations
      });

      if (!firstPassResult.success) {
        steps[0].status = 'error';
        const totalProcessDurationMs = analysisDurationMs + Math.max(0, Date.now() - optimizationStartedAt);
        this.renderReport({
          status: 'error',
          summaryLines: [
            `Erro: ${firstPassResult.error}`,
            `Tempo total do processo: ${this.formatDuration(totalProcessDurationMs)}`
          ],
          steps
        });
        return;
      }

      steps[0].status = 'completed';
      steps[1].status = 'active';
      this.renderReport({
        status: 'processing',
        summaryLines: [
          `Primeira rodada aplicada: ${firstPassResult.appliedCount || 0} alterações`,
          'Atualizando o relatório final da página...'
        ],
        steps
      });

      const finalAnalysis = await this.analyzeCurrentPage();
      this.analysisResult = finalAnalysis;
      steps[1].status = 'completed';
      const optimizationDurationMs = Math.max(0, Date.now() - optimizationStartedAt);
      const totalProcessDurationMs = analysisDurationMs + optimizationDurationMs;

      document.getElementById('results-section').style.display = 'none';
      document.getElementById('main-section').style.display = 'block';
      this.renderReport({
        status: 'success',
        summaryLines: [
          `Primeira rodada: ${firstPassResult.appliedCount || 0} alterações`,
          `Problemas restantes após a rotina: ${finalAnalysis.summary?.total || 0}`,
          `Tempo total do processo: ${this.formatDuration(totalProcessDurationMs)}`
        ],
        steps
      });
    } catch (error) {
      console.error('Erro ao aplicar otimizações:', error);
      const totalProcessDurationMs = analysisDurationMs + Math.max(0, Date.now() - optimizationStartedAt);
      this.renderReport({
        status: 'error',
        summaryLines: [
          `Erro: ${error.message}`,
          `Tempo total do processo: ${this.formatDuration(totalProcessDurationMs)}`
        ],
        steps: [
          { title: 'Aplicação interrompida', description: error.message, status: 'error' }
        ]
      });
    }
  }

  /**
   * Mostra erro
   */
  showError(message) {
    document.getElementById('progress-section').style.display = 'none';
    document.getElementById('main-section').style.display = 'block';
    this.updateProcessingTime(this.jobState);
    this.updateResultsActions();

    const statusInfo = document.getElementById('status-info');
    statusInfo.className = 'info-box error';
    statusInfo.innerHTML = `❌ ${message}`;
  }

  /**
   * Reseta UI
   */
  resetUI() {
    document.getElementById('main-section').style.display = 'block';
    document.getElementById('progress-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    this.updateProcessingTime(null);
    this.steps = [];
    this.analysisResult = null;
    this.optimizations = null;
    this.imageAltResults = [];
    this.jobState = null;
    document.getElementById('report-section').style.display = 'none';
    this.updateResultsActions();
    this.sendMessageToBackground({ action: 'resetAnalysisJob' });
  }

  /**
   * Combina recomendações da IA com alt texts gerados para aplicação.
   */
  combineOptimizations(optimizations, imageAltResults) {
    const imageAlts = imageAltResults.map(({ index, alt }) => ({ index, alt }));
    const textChanges = [...(optimizations?.textChanges || [])];
    const ariaLabels = [...(optimizations?.ariaLabels || [])];
    const structureChanges = [...(optimizations?.structureChanges || [])];

    this.buildDefaultSpacerImageFixes().forEach((fix) => {
      const hasImageAlt = imageAlts.some((imageAlt) => imageAlt.index === fix.index);
      if (!hasImageAlt) {
        imageAlts.push(fix);
      }
    });

    this.buildDefaultEmptyLinkFixes().forEach((fix) => {
      const hasTextChange = textChanges.some((change) => change.selector === fix.selector);
      if (!hasTextChange) {
        textChanges.push({
          selector: fix.selector,
          text: fix.text,
          reason: 'Fallback automático para link vazio'
        });
      }

      const hasAriaLabel = ariaLabels.some((label) => label.selector === fix.selector);
      if (!hasAriaLabel) {
        ariaLabels.push({
          selector: fix.selector,
          label: fix.text,
          role: null
        });
      }
    });

    this.buildDefaultEmptyButtonFixes().forEach((fix) => {
      if (fix.text) {
        const hasTextChange = textChanges.some((change) => change.selector === fix.selector);
        if (!hasTextChange) {
          textChanges.push({
            selector: fix.selector,
            text: fix.text,
            reason: 'Fallback automático para botão vazio'
          });
        }
      }

      if (fix.attributes) {
        const hasStructureChange = structureChanges.some((change) => change.selector === fix.selector);
        if (!hasStructureChange) {
          structureChanges.push({
            selector: fix.selector,
            newTag: null,
            attributes: fix.attributes,
            reason: 'Fallback automático para botão vazio'
          });
        }
      }

      const hasAriaLabel = ariaLabels.some((label) => label.selector === fix.selector);
      if (!hasAriaLabel) {
        ariaLabels.push({
          selector: fix.selector,
          label: fix.label,
          role: null
        });
      }
    });

    this.buildDefaultRedundantTitleFixes().forEach((fix) => {
      const hasStructureChange = structureChanges.some((change) => {
        return change.selector === fix.selector
          && change.attributes
          && Object.prototype.hasOwnProperty.call(change.attributes, 'title');
      });

      if (!hasStructureChange) {
        structureChanges.push({
          selector: fix.selector,
          newTag: null,
          attributes: { title: null },
          reason: 'Fallback automático para title redundante'
        });
      }
    });

    this.buildDefaultRedundantImageAltFixes().forEach((fix) => {
      const existingIndex = imageAlts.findIndex((imageAlt) => imageAlt.index === fix.index);
      if (existingIndex >= 0) {
        imageAlts.splice(existingIndex, 1, fix);
      } else {
        imageAlts.push(fix);
      }
    });

    this.buildDefaultMissingFormLabelFixes().forEach((fix) => {
      const hasStructureChange = structureChanges.some((change) => change.selector === fix.selector);
      if (!hasStructureChange) {
        structureChanges.push({
          selector: fix.selector,
          newTag: null,
          attributes: fix.attributes,
          reason: 'Fallback automático para campo sem label'
        });
      }

      const hasAriaLabel = ariaLabels.some((label) => label.selector === fix.selector);
      if (!hasAriaLabel) {
        ariaLabels.push({
          selector: fix.selector,
          label: fix.label,
          role: null
        });
      }
    });

    this.buildDefaultAriaHiddenFixes().forEach((fix) => {
      const hasStructureChange = structureChanges.some((change) => {
        return change.selector === fix.selector
          && change.attributes
          && Object.prototype.hasOwnProperty.call(change.attributes, 'aria-hidden');
      });

      if (!hasStructureChange) {
        structureChanges.push({
          selector: fix.selector,
          newTag: null,
          attributes: fix.attributes,
          reason: 'Fallback automático para conteúdo aria-hidden'
        });
      }
    });

    const fallbackStyles = [
      this.buildDefaultJustifiedTextStyles(),
      this.buildDefaultSmallTextStyles(),
      this.buildDefaultAriaHiddenStyles(),
      this.buildDefaultLowContrastTextStyles()
    ]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .join('\n');

    const styles = [optimizations?.styles, fallbackStyles]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .join('\n');

    return {
      ...optimizations,
      imageAlts: [...(optimizations?.imageAlts || []), ...imageAlts],
      structureChanges,
      textChanges,
      ariaLabels,
      styles
    };
  }

  /**
   * Gera correções padrão para links vazios.
   */
  buildDefaultEmptyLinkFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'link-no-text' && issue.selector)
      .map((issue, index) => ({
        selector: issue.selector,
        text: `Abrir link ${index + 1}`
      }));
  }

  /**
   * Gera correções padrão para imagens espaçadoras.
   */
  buildDefaultSpacerImageFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'spacer-image-missing-alt' && Number.isInteger(issue.index))
      .map((issue) => ({
        index: issue.index,
        alt: ''
      }));
  }

  /**
   * Gera correções padrão para botões vazios.
   */
  buildDefaultEmptyButtonFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'empty-button' && issue.selector)
      .map((issue, index) => {
        const label = `Acionar botão ${index + 1}`;

        if (issue.tagName === 'input') {
          return {
            selector: issue.selector,
            label,
            attributes: { value: label }
          };
        }

        return {
          selector: issue.selector,
          label,
          text: label
        };
      });
  }

  buildDefaultRedundantTitleFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'redundant-title-text' && issue.selector)
      .map((issue) => ({ selector: issue.selector }));
  }

  buildDefaultRedundantImageAltFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'redundant-image-alt' && Number.isInteger(issue.index))
      .map((issue) => ({
        index: issue.index,
        alt: ''
      }));
  }

  buildDefaultJustifiedTextStyles() {
    const issues = this.analysisResult?.summary?.issues || [];
    const selectors = issues
      .filter((issue) => issue.type === 'justified-text' && issue.selector)
      .map((issue) => issue.selector);

    if (selectors.length === 0) {
      return '';
    }

    return [...new Set(selectors)]
      .map((selector) => `${selector} { text-align: left !important; }`)
      .join('\n');
  }

  buildDefaultSmallTextStyles() {
    const issues = this.analysisResult?.summary?.issues || [];
    const selectors = issues
      .filter((issue) => issue.type === 'small-text' && issue.selector)
      .map((issue) => issue.selector);

    if (selectors.length === 0) {
      return '';
    }

    return [...new Set(selectors)]
      .map((selector) => `${selector} { font-size: 14px !important; line-height: 1.5 !important; }`)
      .join('\n');
  }

  buildDefaultAriaHiddenFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'aria-hidden-content' && issue.selector)
      .map((issue) => ({
        selector: issue.selector,
        attributes: {
          'aria-hidden': null,
          hidden: null,
          inert: null
        }
      }));
  }

  buildDefaultAriaHiddenStyles() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'aria-hidden-content' && issue.selector)
      .map((issue) => this.buildAriaHiddenContrastRule(issue))
      .filter(Boolean)
      .join('\n');
  }

  buildAriaHiddenContrastRule(issue) {
    return `${issue.selector} { visibility: visible !important; opacity: 1 !important; color: rgb(0, 0, 0) !important; background-color: rgb(255, 255, 255) !important; font-size: 14px !important; line-height: 1.5 !important; padding: 0.12em 0.25em !important; box-decoration-break: clone; -webkit-box-decoration-break: clone; }`;
  }

  buildDefaultLowContrastTextStyles() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'low-color-contrast' && issue.selector)
      .map((issue) => this.buildLowContrastRule(issue))
      .filter(Boolean)
      .join('\n');
  }

  buildLowContrastRule(issue) {
    const declarations = [];
    const currentFontSize = this.parsePixelValue(issue.font_size);
    const currentForeground = this.parseCssColor(issue.foreground_color);

    if (Number.isFinite(currentFontSize) && currentFontSize < 18) {
      declarations.push('font-size: 18px !important;');
      declarations.push('line-height: 1.5 !important;');
    }

    const fallbackBackground = this.getBetterContrastBackground(issue.foreground_color, issue.minimum_contrast);
    if (currentForeground && this.isLightColor(currentForeground) && fallbackBackground) {
      declarations.push(`background-color: ${fallbackBackground} !important;`);
      declarations.push('padding: 0.12em 0.25em !important;');
      declarations.push('box-decoration-break: clone;');
      declarations.push('-webkit-box-decoration-break: clone;');
    }

    const fallbackColor = this.getBetterContrastColor(issue.background_color, issue.foreground_color, issue.minimum_contrast);
    if (fallbackColor && !(currentForeground && this.isLightColor(currentForeground) && fallbackBackground)) {
      declarations.push(`color: ${fallbackColor} !important;`);
    }

    if (declarations.length === 0) {
      return '';
    }

    return `${issue.selector} { ${declarations.join(' ')} }`;
  }

  parsePixelValue(value) {
    if (typeof value !== 'string') {
      return Number.NaN;
    }

    const match = value.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : Number.NaN;
  }

  getBetterContrastColor(backgroundColor, foregroundColor, minimumContrast) {
    const background = this.parseCssColor(backgroundColor);
    if (!background) {
      return '';
    }

    const threshold = Number.isFinite(minimumContrast) ? minimumContrast : 4.5;
    const candidates = [
      { css: 'rgb(0, 0, 0)', rgb: { r: 0, g: 0, b: 0 } },
      { css: 'rgb(255, 255, 255)', rgb: { r: 255, g: 255, b: 255 } }
    ];

    const current = this.parseCssColor(foregroundColor);
    if (current) {
      const currentContrast = this.calculateContrastRatio(current, background);
      if (currentContrast >= threshold) {
        return '';
      }
    }

    const bestCandidate = candidates
      .map((candidate) => ({
        ...candidate,
        contrast: this.calculateContrastRatio(candidate.rgb, background)
      }))
      .sort((left, right) => right.contrast - left.contrast)[0];

    return bestCandidate && bestCandidate.contrast >= threshold ? bestCandidate.css : (bestCandidate?.css || '');
  }

  getBetterContrastBackground(foregroundColor, minimumContrast) {
    const foreground = this.parseCssColor(foregroundColor);
    if (!foreground) {
      return '';
    }

    const threshold = Number.isFinite(minimumContrast) ? minimumContrast : 4.5;
    const candidates = [
      { css: 'rgb(0, 0, 0)', rgb: { r: 0, g: 0, b: 0 } },
      { css: 'rgb(24, 24, 24)', rgb: { r: 24, g: 24, b: 24 } },
      { css: 'rgb(32, 32, 32)', rgb: { r: 32, g: 32, b: 32 } }
    ];

    const bestCandidate = candidates
      .map((candidate) => ({
        ...candidate,
        contrast: this.calculateContrastRatio(foreground, candidate.rgb)
      }))
      .sort((left, right) => right.contrast - left.contrast)[0];

    return bestCandidate && bestCandidate.contrast >= threshold ? bestCandidate.css : '';
  }

  parseCssColor(color) {
    if (typeof color !== 'string' || color.trim().length === 0) {
      return null;
    }

    const normalized = color.trim().toLowerCase();

    if (normalized.startsWith('rgb')) {
      const values = normalized.match(/[\d.]+/g);
      if (!values || values.length < 3) {
        return null;
      }

      return {
        r: parseFloat(values[0]),
        g: parseFloat(values[1]),
        b: parseFloat(values[2])
      };
    }

    if (normalized.startsWith('#')) {
      return this.parseHexColor(normalized);
    }

    return null;
  }

  parseHexColor(color) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }

    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }

    return null;
  }

  calculateContrastRatio(colorA, colorB) {
    const luminanceA = this.getRelativeLuminance(colorA);
    const luminanceB = this.getRelativeLuminance(colorB);
    const lighter = Math.max(luminanceA, luminanceB);
    const darker = Math.min(luminanceA, luminanceB);

    return (lighter + 0.05) / (darker + 0.05);
  }

  getRelativeLuminance(rgb) {
    const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  isLightColor(rgb) {
    return this.getRelativeLuminance(rgb) >= 0.5;
  }

  /**
   * Gera correções padrão para campos sem label.
   */
  buildDefaultMissingFormLabelFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'form-field-no-label' && issue.selector)
      .map((issue, index) => {
        const label = this.deriveFormFieldLabel(issue, index);

        return {
          selector: issue.selector,
          label,
          attributes: { title: label }
        };
      });
  }

  deriveFormFieldLabel(issue, index) {
    const candidates = [issue.placeholder, issue.name, issue.id]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .map((value) => this.humanizeFieldText(value));

    if (candidates.length > 0) {
      return candidates[0];
    }

    if (issue.input_type === 'email') {
      return 'E-mail';
    }

    if (issue.input_type === 'password') {
      return 'Senha';
    }

    if (issue.tagName === 'textarea') {
      return `Campo de texto ${index + 1}`;
    }

    if (issue.tagName === 'select') {
      return `Selecione uma opção ${index + 1}`;
    }

    return `Campo do formulário ${index + 1}`;
  }

  humanizeFieldText(value) {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^./, (char) => char.toUpperCase());
  }

  /**
   * Abre página de configurações
   */
  openSettings() {
    chrome.runtime.openOptionsPage();
  }
}

// Inicializar quando o popup carregar
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
