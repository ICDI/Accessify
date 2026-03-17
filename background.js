/**
 * Background Service Worker
 * Gerencia a integração com OpenRouter e processamento de IA
 */

class AccessibilityOptimizer {
  constructor() {
    this.apiKey = null;
    this.selectedModel = 'openai/gpt-5-nano';
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.analysisJobStorageKey = 'analysisJob';
    this.analysisCommandName = 'trigger-accessibility-analysis';
    this.toggleAutoOptimizeCommandName = 'toggle-auto-optimize';
    this.iconPaths = {
      16: 'icons/icon-16.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png'
    };
    this.enabledIconCache = new Map();
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
      chrome.storage.sync.get(['apiKey', 'selectedModel'], (result) => {
        this.apiKey = result.apiKey || null;
        this.selectedModel = result.selectedModel || 'openai/gpt-5-nano';
        console.log('Settings loaded:', { 
          apiKeyConfigured: !!this.apiKey, 
          model: this.selectedModel 
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

  async getAnalysisJob() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.analysisJobStorageKey], (result) => {
        resolve(result[this.analysisJobStorageKey] || this.getDefaultAnalysisJob());
      });
    });
  }

  async setAnalysisJob(job) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.analysisJobStorageKey]: job }, () => resolve(job));
    });
  }

  async updateAnalysisJob(patch) {
    const currentJob = await this.getAnalysisJob();
    const updatedJob = { ...currentJob, ...patch };
    await this.setAnalysisJob(updatedJob);
    return updatedJob;
  }

  async isRunCurrent(runId) {
    const currentJob = await this.getAnalysisJob();
    return currentJob.runId === runId;
  }

  async updateAnalysisJobForRun(runId, patch) {
    if (!(await this.isRunCurrent(runId))) {
      return null;
    }

    return this.updateAnalysisJob(patch);
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

  async ensureContentScript(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }

  async sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, async (response) => {
        if (!chrome.runtime.lastError) {
          resolve(response || { success: false, error: 'Sem resposta do content script' });
          return;
        }

        const runtimeError = chrome.runtime.lastError.message || '';

        if (runtimeError.includes('Receiving end does not exist')) {
          try {
            await this.ensureContentScript(tabId);
            chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
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

  async startAnalysisJob(tabId, windowId, options = {}) {
    const runId = this.generateRunId();
    const startedAt = new Date().toISOString();
    const autoTriggered = !!options.autoTriggered;
    let steps = this.createAnalysisSteps();
    steps = this.markStepStatus(steps, 0, 'active');

    await this.setAnalysisJob({
      ...this.getDefaultAnalysisJob(),
      runId,
      status: 'running',
      progress: 10,
      progressText: 'Analisando página...',
      steps,
      targetTabId: tabId,
      windowId,
      startedAt,
      durationMs: 0,
      autoTriggered,
      optimizationsApplied: false,
      appliedChanges: 0,
      applyError: null,
      pageUrl: options.pageUrl || null
    });

    try {
      const analysisResult = await this.sendMessageToTab(tabId, { action: 'analyzeAccessibility' });
      if (!(await this.isRunCurrent(runId))) {
        return await this.getAnalysisJob();
      }

      if (!analysisResult?.success) {
        throw new Error(analysisResult?.error || 'Erro ao analisar página');
      }

      steps = this.markStepStatus(steps, 0, 'completed');
      const requiresImageProcessing = analysisResult.summary.requiresLLM > 0;
      if (requiresImageProcessing) {
        steps = this.markStepStatus(steps, 1, 'active');
      }

      await this.updateAnalysisJobForRun(runId, {
        analysisResult,
        progress: requiresImageProcessing ? 40 : 60,
        progressText: requiresImageProcessing ? 'Processando imagens...' : 'Gerando recomendações...',
        steps
      });

      let imageAltResults = [];
      if (requiresImageProcessing) {
        const images = await this.sendMessageToTab(tabId, { action: 'extractImages' });
        if (!(await this.isRunCurrent(runId))) {
          return await this.getAnalysisJob();
        }

        if (Array.isArray(images) && images.length > 0) {
          const imageResults = await this.processImages(images);
          if (!(await this.isRunCurrent(runId))) {
            return await this.getAnalysisJob();
          }

          imageAltResults = imageResults.filter((result) => result.success && result.alt);
        }

        steps = this.markStepStatus(steps, 1, 'completed');
      } else {
        steps = this.markStepStatus(steps, 1, 'completed');
      }

      steps = this.markStepStatus(steps, 2, 'active');
      await this.updateAnalysisJobForRun(runId, {
        imageAltResults,
        progress: 75,
        progressText: 'Gerando recomendações...',
        steps
      });

      const optimizations = await this.analyzePageForOptimizations(
        analysisResult.pageContent,
        analysisResult.summary.issues
      );
      if (!(await this.isRunCurrent(runId))) {
        return await this.getAnalysisJob();
      }

      steps = this.markStepStatus(steps, 2, 'completed');
      steps = this.markStepStatus(steps, 3, 'completed');

      const completedAt = new Date().toISOString();
      await this.updateAnalysisJobForRun(runId, {
        status: 'completed',
        progress: 100,
        progressText: 'Análise concluída.',
        steps,
        optimizations,
        completedAt,
        durationMs: this.getDurationMs(startedAt, completedAt),
        error: null
      });

      return await this.getAnalysisJob();
    } catch (error) {
      if (await this.isRunCurrent(runId)) {
        const completedAt = new Date().toISOString();
        await this.updateAnalysisJob({
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

  async resetAnalysisJob() {
    await this.setAnalysisJob(this.getDefaultAnalysisJob());
  }

  buildOptimizationsForApplication(optimizations, imageAltResults = []) {
    const imageAlts = imageAltResults
      .filter((result) => result?.success && typeof result.alt === 'string')
      .map(({ index, alt }) => ({ index, alt }));

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
    if (!tab?.id || !tab?.windowId || !tab?.active || !this.isSupportedTab(tab)) {
      return;
    }

    await this.refreshSettings();

    const autoOptimizeEnabled = await this.getAutoOptimizeSetting();
    if (!autoOptimizeEnabled || !this.isConfigured()) {
      return;
    }

    const currentJob = await this.getAnalysisJob();
    if (currentJob.status === 'running' && currentJob.targetTabId === tab.id && currentJob.pageUrl === tab.url) {
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

    let currentTab = null;
    try {
      currentTab = await chrome.tabs.get(tab.id);
    } catch (error) {
      return job;
    }

    if (!currentTab || currentTab.url !== initialUrl) {
      return job;
    }

    await this.updateAnalysisJobForRun(job.runId, {
      status: 'running',
      progress: 90,
      progressText: 'Aplicando otimizações automaticamente...',
      durationMs: this.getDurationMs(job.startedAt)
    });

    const optimizations = this.buildOptimizationsForApplication(job.optimizations, job.imageAltResults);
    const applyResult = await this.sendMessageToTab(tab.id, {
      action: 'applyOptimizations',
      optimizations
    });

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

    await this.updateAnalysisJobForRun(job.runId, updatePatch);

    return {
      ...job,
      ...updatePatch
    };
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
  async saveSettings(apiKey, selectedModel) {
    this.apiKey = apiKey;
    this.selectedModel = selectedModel;
    return new Promise((resolve) => {
      chrome.storage.sync.set({ apiKey, selectedModel }, () => {
        console.log('Settings saved:', { model: this.selectedModel });
        resolve();
      });
    });
  }

  /**
   * Valida se API key está configurada
   */
  isConfigured() {
    return this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Normaliza o conteúdo retornado pelo modelo para texto.
   */
  extractMessageText(message) {
    if (!message) {
      return '';
    }

    if (typeof message.content === 'string') {
      return message.content;
    }

    if (Array.isArray(message.content)) {
      return message.content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }

          if (part?.type === 'text' && typeof part.text === 'string') {
            return part.text;
          }

          return '';
        })
        .join('')
        .trim();
    }

    return '';
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
   * Testa conexão com OpenRouter
   */
  async testConnection() {
    await this.refreshSettings();

    console.log('Testing connection to OpenRouter...');
    console.log('API Key configured:', this.isConfigured());
    console.log('Selected model:', this.selectedModel);

    if (!this.isConfigured()) {
      throw new Error('API key não configurada');
    }

    try {
      const requestBody = {
        model: this.selectedModel,
        messages: [
          {
            role: 'user',
            content: 'Responda com "OK" se você conseguir ler esta mensagem.'
          }
        ],
        max_tokens: 16000,
        temperature: 0.7
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://accessify-extension.local',
          'X-Title': 'Accessify'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', {
        contentType: response.headers.get('content-type'),
        status: response.status,
        statusText: response.statusText
      });

      // Ler o corpo da resposta como texto primeiro
      const responseText = await response.text();
      console.log('Response body (raw):', responseText);

      if (!response.ok) {
        console.error('Error response status:', response.status);
        
        try {
          const errorData = JSON.parse(responseText);
          console.error('Error data:', errorData);
          throw new Error(`API Error (${response.status}): ${errorData.error?.message || errorData.message || 'Erro desconhecido'}`);
        } catch (parseError) {
          if (parseError.message.includes('API Error')) {
            throw parseError;
          }
          throw new Error(`API Error (${response.status}): ${responseText || 'Erro desconhecido'}`);
        }
      }

      // Tentar parsear como JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error(`Resposta inválida: não é JSON válido. Resposta: ${responseText}`);
      }

      console.log('Success response:', data);
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Resposta inválida: estrutura inesperada');
      }

      return data;
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      throw error;
    }
  }

  /**
   * Gera alt text para imagens usando IA
   */
  async generateImageAltText(imageUrl) {
    await this.refreshSettings();

    if (!this.isConfigured()) {
      throw new Error('API key não configurada. Acesse as opções do plugin.');
    }

    try {
      const requestBody = {
        model: this.selectedModel,
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em acessibilidade web. Gere um texto alternativo conciso e descritivo para a imagem fornecida. O texto deve ter entre 10 e 100 caracteres, descrever apenas o que é visível e evitar detalhes supérfluos. Responda APENAS com o texto alternativo, sem explicações adicionais.'
          },
          {
            role: 'user',
            content: `Gere um alt text para esta imagem: ${imageUrl}`
          }
        ],
        max_tokens: 16000,
        temperature: 0.7
      };

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://accessify-extension.local',
          'X-Title': 'Accessify'
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();

      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(`Erro da API: ${errorData.error?.message || 'Erro desconhecido'}`);
        } catch (parseError) {
          throw new Error(`Erro da API (${response.status}): ${responseText}`);
        }
      }

      const data = JSON.parse(responseText);
      const altText = this.normalizeAltText(this.extractMessageText(data.choices?.[0]?.message));

      if (!altText) {
        throw new Error('Resposta inválida da IA: alt text vazio');
      }

      return altText;
    } catch (error) {
      console.error('Erro ao gerar alt text:', error);
      throw error;
    }
  }

  /**
   * Analisa página e gera recomendações de otimização
   */
  async analyzePageForOptimizations(pageContent, issues) {
    await this.refreshSettings();

    if (!this.isConfigured()) {
      throw new Error('API key não configurada. Acesse as opções do plugin.');
    }

    try {
      // Preparar resumo dos problemas
      const issuesSummary = this.prepareIssuesSummary(issues);

      const requestBody = {
        model: this.selectedModel,
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em WCAG 2.1 e acessibilidade web. Sua tarefa é analisar uma página web e fornecer recomendações específicas para melhorar a acessibilidade para usuários cegos ou de baixa visão.

Responda em formato JSON com a seguinte estrutura:
{
  "optimizations": [
    {
      "type": "tipo_da_otimizacao",
      "priority": "alta|média|baixa",
      "description": "descrição da otimização",
      "implementation": "como implementar",
      "wcagCriterion": "número do critério WCAG"
    }
  ],
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

Foque em:
1. Melhorar contraste de cores
2. Adicionar ARIA labels apropriados
3. Melhorar estrutura semântica
4. Garantir navegação por teclado
5. Adicionar indicadores de foco visíveis
6. Corrigir links vazios com texto visível ou aria-label apropriado
7. Corrigir referências ARIA quebradas removendo ou substituindo aria-labelledby e aria-describedby inválidos
8. Corrigir campos de formulário sem label usando preferencialmente title não vazio, ou aria-labelledby válido quando houver referência apropriada
9. Remover title redundante quando ele repetir exatamente o texto visível ou o alt da imagem
10. Remover text-align: justify de blocos longos de texto, preferindo alinhamento à esquerda
11. Quando o alt da imagem repetir texto adjacente, preferir alt vazio preservando o texto visível próximo
12. Aumentar textos muito pequenos para pelo menos 14px quando font_size estiver abaixo disso
13. Para elementos com aria-hidden, torná-los perceptíveis removendo aria-hidden e outros atributos de ocultação equivalentes quando presentes
14. Ao revelar texto que estava oculto, definir explicitamente color e background-color com contraste suficiente entre si
15. Usar apenas seletores que apareçam nos problemas encontrados

Para problemas de contraste baixo, escolha uma ou mais destas possibilidades e explique a decisão em "reason" ou "implementation":
- alterar a cor do texto para uma cor com contraste suficiente
- alterar a cor de fundo para uma cor com contraste suficiente
- adicionar fundo sólido ao texto quando houver imagem de fundo, gradiente ou transparência
- quando o texto for claro e o contraste estiver insuficiente, prefira adicionar fundo sólido escuro antes de substituir a cor do texto
- aumentar peso e/ou tamanho tipográfico apenas quando isso resolver o critério corretamente
- quando font_size for menor que 18px e o contraste for insuficiente, elevar a fonte para pelo menos 18px
- ajustar borda, outline ou estado de foco quando o contraste ruim estiver em elementos interativos

Para cada problema de contraste, proponha correções CSS concretas e mínimas, preservando o visual da página quando possível. Se houver dados de foreground_color, background_color, contrast_ratio e minimum_contrast, use-os para decidir a correção mais adequada.`
          },
          {
            role: 'user',
            content: `Analise esta página e forneça recomendações de otimização:

Título: ${pageContent.title}
URL: ${pageContent.url}
Idioma: ${pageContent.language}

Problemas encontrados:
${issuesSummary}

Forneça as recomendações em JSON válido.`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 32000,
        temperature: 0.7
      };

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://accessify-extension.local',
          'X-Title': 'Accessify'
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();

      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(`Erro da API: ${errorData.error?.message || 'Erro desconhecido'}`);
        } catch (parseError) {
          throw new Error(`Erro da API (${response.status}): ${responseText}`);
        }
      }

      const data = JSON.parse(responseText);
      const content = this.extractMessageText(data.choices?.[0]?.message);

      if (!content) {
        throw new Error('Resposta inválida da IA - conteúdo vazio');
      }

      // Extrair JSON da resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Resposta inválida da IA - não contém JSON válido');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Erro ao analisar página:', error);
      throw error;
    }
  }

  /**
   * Prepara resumo dos problemas para enviar à IA
   */
  prepareIssuesSummary(issues) {
    const grouped = {};
    issues.forEach(issue => {
      if (!grouped[issue.type]) {
        grouped[issue.type] = [];
      }
      grouped[issue.type].push(issue);
    });

    let summary = '';
    Object.keys(grouped).forEach(type => {
      summary += `\n${type}:\n`;
      grouped[type].slice(0, 3).forEach(issue => {
        summary += `  - ${issue.message}\n`;
        if (issue.selector) {
          summary += `    seletor: ${issue.selector}\n`;
        }
        if (issue.ariaLabelledBy) {
          summary += `    aria-labelledby: ${issue.ariaLabelledBy}\n`;
        }
        if (issue.ariaDescribedBy) {
          summary += `    aria-describedby: ${issue.ariaDescribedBy}\n`;
        }
        if (issue.element_html) {
          summary += `    html: ${issue.element_html}\n`;
        }
        if (issue.placeholder) {
          summary += `    placeholder: ${issue.placeholder}\n`;
        }
        if (issue.title_attribute) {
          summary += `    title_attribute: ${issue.title_attribute}\n`;
        }
        if (issue.element_text) {
          summary += `    element_text: ${issue.element_text}\n`;
        }
        if (issue.alt_text) {
          summary += `    alt_text: ${issue.alt_text}\n`;
        }
        if (issue.adjacent_text) {
          summary += `    adjacent_text: ${issue.adjacent_text}\n`;
        }
        if (issue.name) {
          summary += `    name: ${issue.name}\n`;
        }
        if (issue.id) {
          summary += `    id: ${issue.id}\n`;
        }
        if (issue.input_type) {
          summary += `    input_type: ${issue.input_type}\n`;
        }
        if (issue.character_count) {
          summary += `    character_count: ${issue.character_count}\n`;
        }
        if (issue.text_align) {
          summary += `    text_align: ${issue.text_align}\n`;
        }
        if (issue.text_content) {
          summary += `    text_content: ${issue.text_content}\n`;
        }
        if (issue.foreground_color) {
          summary += `    foreground_color: ${issue.foreground_color}\n`;
        }
        if (issue.background_color) {
          summary += `    background_color: ${issue.background_color}\n`;
        }
        if (issue.contrast_ratio) {
          summary += `    contrast_ratio: ${issue.contrast_ratio}\n`;
        }
        if (issue.minimum_contrast) {
          summary += `    minimum_contrast: ${issue.minimum_contrast}\n`;
        }
        if (issue.font_size) {
          summary += `    font_size: ${issue.font_size}\n`;
        }
        if (issue.font_weight) {
          summary += `    font_weight: ${issue.font_weight}\n`;
        }
        if (typeof issue.is_large_text === 'boolean') {
          summary += `    is_large_text: ${issue.is_large_text}\n`;
        }
        if (issue.background_image && issue.background_image !== 'none') {
          summary += `    background_image: ${issue.background_image}\n`;
        }
      });
      if (grouped[type].length > 3) {
        summary += `  ... e mais ${grouped[type].length - 3}\n`;
      }
    });

    return summary;
  }

  /**
   * Processa múltiplas imagens para gerar alt texts
   */
  async processImages(images) {
    const results = [];

    for (const image of images) {
      try {
        const altText = await this.generateImageAltText(image.src);
        results.push({
          index: image.index,
          src: image.src,
          alt: altText,
          success: true
        });

        // Pequeno delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({
          index: image.index,
          src: image.src,
          alt: image.currentAlt || 'Imagem',
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}

// Criar instância global
const optimizer = new AccessibilityOptimizer();

chrome.runtime.onInstalled.addListener(() => {
  optimizer.initializeSidePanel();
  optimizer.getAutoOptimizeSetting()
    .then((enabled) => optimizer.updateActionIcon(enabled))
    .catch((error) => console.error('Erro ao atualizar ícone da extensão na instalação:', error));
});

chrome.runtime.onStartup.addListener(() => {
  optimizer.initializeSidePanel();
  optimizer.getAutoOptimizeSetting()
    .then((enabled) => optimizer.updateActionIcon(enabled))
    .catch((error) => console.error('Erro ao atualizar ícone da extensão na inicialização:', error));
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

// Escutar mensagens do popup e content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    optimizer.loadSettings()
      .then(() => {
        sendResponse({
          apiKey: optimizer.apiKey ? '***' : '',
          selectedModel: optimizer.selectedModel,
          isConfigured: optimizer.isConfigured()
        });
      })
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'saveSettings') {
    optimizer.saveSettings(request.apiKey, request.selectedModel)
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
    optimizer.getAnalysisJob()
      .then((job) => sendResponse({ success: true, job }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'resetAnalysisJob') {
    optimizer.resetAnalysisJob()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  sendResponse({ success: false, error: `Ação não suportada: ${request.action}` });
  return false;
});

console.log('Accessify - Background Service Worker Loaded');
