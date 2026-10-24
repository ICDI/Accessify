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
    this.dismissedErrorKey = null;
    this.init();
  }

  /**
   * Inicializa o popup
   */
  async init() {
    this.currentTab = await this.getCurrentTab();
    this.setupEventListeners();
    this.setupStorageListeners();
    this.setupTabListeners();
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
    document.getElementById('auto-optimize-toggle').addEventListener('keydown', (e) => this.handleTogglePress(e));
    document.getElementById('collapse-toggle').addEventListener('click', () => this.toggleCollapsed());
    document.getElementById('report-toggle').addEventListener('click', () => this.toggleReportCollapsed());
  }

  /**
   * Permite acionar o switch customizado (div role="switch") via teclado.
   */
  handleTogglePress(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.toggleAutoOptimize();
    }
  }

  /**
   * O side panel não recarrega sozinho ao trocar de aba (é uma única instância por
   * janela). Sem isso, o usuário só veria o estado da nova aba no próximo tick do
   * polling (até 1s de atraso). Aqui refletimos a troca imediatamente.
   */
  setupTabListeners() {
    if (!chrome.tabs?.onActivated) {
      return;
    }

    chrome.tabs.onActivated.addListener(() => {
      this.refreshJobState().catch((error) => console.error('Erro ao atualizar estado ao trocar de aba:', error));
    });
  }

  setupStorageListeners() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') {
        return;
      }

      if (changes.selectedModel || changes.apiKey || changes.provider || changes.localModel) {
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
    button.setAttribute('aria-expanded', String(!collapsed));
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
    toggle.setAttribute('aria-expanded', String(!this.reportCollapsed));
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

    if (!this.currentTab?.id) {
      return;
    }

    const response = await this.sendMessageToBackground({ action: 'getAnalysisJob', tabId: this.currentTab.id });
    if (!response?.success) {
      return;
    }

    this.jobState = response.job;
    this.renderJobState();
  }

  renderJobState() {
    const job = this.jobState;
    if (!job || job.status === 'idle') {
      // O job pode estar "idle" tanto por reset explícito quanto por termos trocado
      // para uma aba diferente (cada aba tem seu próprio job). Nos dois casos, o
      // estado em memória da aba anterior precisa ser descartado - senão "Aplicar
      // Otimizações" nesta aba poderia reaplicar dados de outra aba/página.
      this.updateProcessingTime(null);
      this.dismissedErrorKey = null;
      this.analysisResult = null;
      this.optimizations = null;
      this.imageAltResults = [];
      this.steps = [];
      document.getElementById('main-section').style.display = 'block';
      document.getElementById('progress-section').style.display = 'none';
      document.getElementById('results-section').style.display = 'none';
      document.getElementById('report-section').style.display = 'none';
      this.clearReport();
      return;
    }

    if (job.status === 'running') {
      this.dismissedErrorKey = null;
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
      this.dismissedErrorKey = null;
      this.analysisResult = job.analysisResult;
      this.imageAltResults = job.imageAltResults || [];
      this.optimizations = this.combineOptimizations(job.optimizations, this.imageAltResults);
      this.steps = job.steps || [];
      this.updateProcessingTime(job);
      this.showResults(job.analysisResult.summary);
      return;
    }

    if (job.status === 'error') {
      const errorKey = `${job.runId || ''}:${job.error || ''}`;
      if (this.dismissedErrorKey && errorKey === this.dismissedErrorKey) {
        return;
      }

      this.dismissedErrorKey = null;
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

  getModelDisplayName(modelId, provider, localModel) {
    return globalThis.getModelDisplayName(modelId, provider, localModel);
  }

  /**
   * Verifica configuração da API
   */
  async checkConfiguration() {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      const statusInfo = document.getElementById('status-info');
      const analyzeBtn = document.getElementById('analyze-btn');

      if (!response) {
        return;
      }

      if (response.isConfigured) {
        const label = response.displayName || this.getModelDisplayName(response.selectedModel, response.provider, response.localModel);
        statusInfo.innerHTML = `✓ Modelo configurado: <strong>${label}</strong>`;
        statusInfo.className = 'info-box';
        analyzeBtn.disabled = false;
      } else if (response.provider === 'local') {
        statusInfo.innerHTML = `⚠️ Ollama local não configurado. Clique em "Configurações" para definir a URL e o modelo.`;
        statusInfo.className = 'info-box warning';
        analyzeBtn.disabled = true;
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
    const isActive = settings.autoOptimize === true;

    toggle.classList.toggle('active', isActive);
    toggle.setAttribute('aria-checked', String(isActive));
  }

  /**
   * Alterna otimização automática
   */
  async toggleAutoOptimize() {
    const toggle = document.getElementById('auto-optimize-toggle');
    const isActive = toggle.classList.toggle('active');
    toggle.setAttribute('aria-checked', String(isActive));

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

    this.dismissCurrentError();
    this.restoreStatusInfo();
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
    this.currentTab = await this.getCurrentTab();
    await this.sendMessageToBackground({ action: 'resetAnalysisJob', tabId: this.currentTab?.id });
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
      stepDiv.setAttribute('role', 'listitem');

      const statusIcon = step.status === 'completed' ? '✓' : step.status === 'active' ? '⟳' : '○';

      stepDiv.innerHTML = `
        <div class="step-title"><span aria-hidden="true">${statusIcon}</span> ${step.title}</div>
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
    document.querySelector('.progress-bar').setAttribute('aria-valuenow', String(percentage));
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
    this.restoreStatusInfo();
    document.getElementById('main-section').style.display = 'none';
    document.getElementById('progress-section').style.display = 'block';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('report-section').style.display = 'none';
    this.clearReport();
    this.steps = [];
  }

  /**
   * Limpa o conteúdo do "Relatório da Execução" (da aplicação de otimizações anterior).
   * Chamado sempre que uma nova análise começa, para não deixar um relatório antigo
   * visível/desatualizado enquanto a página é reanalisada.
   */
  clearReport() {
    const reportStatus = document.getElementById('report-status');
    const reportSummary = document.getElementById('report-summary');
    const reportSteps = document.getElementById('report-steps');

    reportStatus.className = 'report-status';
    reportStatus.textContent = '';
    reportSummary.innerHTML = '';
    reportSteps.innerHTML = '';
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
      ? '<span class="section-icon" aria-hidden="true">✓</span> Otimizações já aplicadas automaticamente'
      : '<span class="section-icon" aria-hidden="true">✨</span> Aplicar Otimizações';
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
      stepDiv.setAttribute('role', 'listitem');
      const statusIcon = step.status === 'completed' ? '✓' : step.status === 'active' ? '⟳' : step.status === 'error' ? '✗' : '○';
      stepDiv.innerHTML = `
        <div class="step-title"><span aria-hidden="true">${statusIcon}</span> ${step.title}</div>
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
        { title: 'Aplicando correções', description: 'Corrigindo e reavaliando a página até não sobrar nada novo (ou até o limite de rodadas)', status: 'active' },
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

      // A convergência (aplicar, reavaliar o que sobrou, aplicar de novo se preciso)
      // acontece dentro do content.js num único envio de mensagem - não precisamos
      // mais orquestrar rodadas manuais daqui nem depender de outro clique do usuário.
      const applyResult = await this.sendMessageToContent({
        action: 'applyOptimizations',
        optimizations: this.optimizations,
        runId: this.jobState?.runId || null
      });

      if (!applyResult.success) {
        steps[0].status = 'error';
        const totalProcessDurationMs = analysisDurationMs + Math.max(0, Date.now() - optimizationStartedAt);
        this.renderReport({
          status: 'error',
          summaryLines: [
            `Erro: ${applyResult.error}`,
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
          `${applyResult.appliedCount || 0} alterações em ${applyResult.roundsRun || 1} rodada(s)`,
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
          `${applyResult.appliedCount || 0} alterações aplicadas em ${applyResult.roundsRun || 1} rodada(s) automáticas`,
          `Problemas restantes: ${finalAnalysis.summary?.total || 0}`,
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
   * Evita que o polling reexiba o erro antigo após um novo clique em analisar.
   */
  dismissCurrentError() {
    const job = this.jobState;
    if (job?.status === 'error') {
      this.dismissedErrorKey = `${job.runId || ''}:${job.error || ''}`;
    }
  }

  /**
   * Remove a caixa vermelha e volta o status de configuração.
   */
  restoreStatusInfo() {
    const statusInfo = document.getElementById('status-info');
    if (statusInfo?.classList.contains('error')) {
      statusInfo.className = 'info-box';
      statusInfo.textContent = 'Carregando status...';
      this.checkConfiguration();
    }
  }

  /**
   * Reseta UI
   */
  resetUI() {
    this.dismissedErrorKey = null;
    this.restoreStatusInfo();
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
    this.clearReport();
    this.updateResultsActions();
    this.sendMessageToBackground({ action: 'resetAnalysisJob', tabId: this.currentTab?.id });
  }

  /**
   * Combina recomendações da IA com alt texts gerados para aplicação (ver panel-fixes.js).
   */
  combineOptimizations(optimizations, imageAltResults) {
    return new AccessifyPanelFixes(this.analysisResult).combineOptimizations(optimizations, imageAltResults);
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
