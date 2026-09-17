/**
 * Options Script - Gerencia configurações do plugin
 */

class OptionsController {
  constructor() {
    this.init();
  }

  async init() {
    this.populateOpenRouterModels();
    this.setupEventListeners();
    await this.loadSettings();
    this.updateProviderVisibility();
  }

  populateOpenRouterModels() {
    const select = document.getElementById('model-select');
    const list = document.getElementById('model-list');
    select.innerHTML = '';
    list.innerHTML = '';

    ACCESSIFY_AI_CONFIG.openRouterModels.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      select.appendChild(option);

      const item = document.createElement('div');
      item.className = 'model-item';
      item.innerHTML = `
        <div class="model-name">${model.name}${model.vision ? ' (visão)' : ''}</div>
        <div class="model-description">${model.description}</div>
      `;
      list.appendChild(item);
    });
  }

  setupEventListeners() {
    document.getElementById('settings-form').addEventListener('submit', (e) => this.handleSaveSettings(e));
    document.getElementById('test-api-btn').addEventListener('click', () => this.testAPIConnection());
    document.getElementById('toggle-password').addEventListener('click', () => this.togglePasswordVisibility());
    document.getElementById('auto-optimize-checkbox').addEventListener('change', () => this.saveAutoOptimize());
    document.getElementById('show-notifications-checkbox').addEventListener('change', () => this.saveNotifications());
    document.getElementById('provider-local').addEventListener('change', () => this.updateProviderVisibility());
    document.getElementById('provider-openrouter').addEventListener('change', () => this.updateProviderVisibility());
  }

  getSelectedProvider() {
    return document.getElementById('provider-local').checked
      ? ACCESSIFY_AI_CONFIG.providers.local
      : ACCESSIFY_AI_CONFIG.providers.openrouter;
  }

  updateProviderVisibility() {
    const isLocal = this.getSelectedProvider() === ACCESSIFY_AI_CONFIG.providers.local;
    document.getElementById('local-settings').hidden = !isLocal;
    document.getElementById('openrouter-settings').hidden = isLocal;
    document.getElementById('api-key').required = !isLocal;
  }

  async loadSettings() {
    const settings = await chrome.storage.sync.get([
      'apiKey',
      'selectedModel',
      'autoOptimize',
      'showNotifications',
      'provider',
      'localBaseUrl',
      'localModel'
    ]);

    const provider = settings.provider || (settings.apiKey ? 'openrouter' : ACCESSIFY_AI_CONFIG.defaults.provider);
    document.getElementById('provider-local').checked = provider === 'local';
    document.getElementById('provider-openrouter').checked = provider === 'openrouter';

    if (settings.apiKey) {
      document.getElementById('api-key').value = settings.apiKey;
    }

    const knownModel = ACCESSIFY_AI_CONFIG.openRouterModels.some((model) => model.id === settings.selectedModel);
    document.getElementById('model-select').value = knownModel
      ? settings.selectedModel
      : ACCESSIFY_AI_CONFIG.defaults.selectedModel;
    document.getElementById('local-base-url').value = settings.localBaseUrl || ACCESSIFY_AI_CONFIG.defaults.localBaseUrl;
    document.getElementById('local-model').value = settings.localModel || ACCESSIFY_AI_CONFIG.defaults.localModel;

    if (settings.autoOptimize) {
      document.getElementById('auto-optimize-checkbox').checked = true;
    }

    if (settings.showNotifications !== false) {
      document.getElementById('show-notifications-checkbox').checked = true;
    }
  }

  collectSettings() {
    return {
      provider: this.getSelectedProvider(),
      apiKey: document.getElementById('api-key').value.trim(),
      selectedModel: document.getElementById('model-select').value,
      localBaseUrl: document.getElementById('local-base-url').value.trim() || ACCESSIFY_AI_CONFIG.defaults.localBaseUrl,
      localModel: document.getElementById('local-model').value.trim() || ACCESSIFY_AI_CONFIG.defaults.localModel
    };
  }

  async handleSaveSettings(e) {
    e.preventDefault();

    const settings = this.collectSettings();

    if (settings.provider === 'openrouter' && !settings.apiKey) {
      this.showMessage('Por favor, insira uma chave de API válida', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set(settings);

      chrome.runtime.sendMessage(
        { action: 'saveSettings', ...settings },
        (response) => {
          if (response?.success) {
            this.showMessage('✓ Configurações salvas com sucesso!', 'success');
          } else {
            this.showMessage(`Erro ao salvar: ${response?.error || 'sem resposta'}`, 'error');
          }
        }
      );
    } catch (error) {
      this.showMessage(`Erro ao salvar: ${error.message}`, 'error');
    }
  }

  async testAPIConnection() {
    const settings = this.collectSettings();

    if (settings.provider === 'openrouter' && !settings.apiKey) {
      this.showMessage('Por favor, insira uma chave de API', 'error');
      return;
    }

    const btn = document.getElementById('test-api-btn');
    btn.disabled = true;
    btn.textContent = '⟳ Testando...';

    try {
      await chrome.storage.sync.set(settings);

      chrome.runtime.sendMessage(
        { action: 'testConnection' },
        (response) => {
          if (chrome.runtime.lastError) {
            this.showMessage(`✗ Erro ao conectar: ${chrome.runtime.lastError.message}`, 'error');
          } else if (!response) {
            this.showMessage('✗ Erro ao conectar: sem resposta do background script', 'error');
          } else if (response.success) {
            const label = settings.provider === 'local'
              ? `Ollama (${settings.localModel})`
              : settings.selectedModel;
            this.showMessage('✓ Conexão bem-sucedida! Modelo: ' + label, 'success');
          } else {
            this.showMessage(`✗ Erro ao conectar: ${response.error}`, 'error');
          }
          btn.disabled = false;
          btn.textContent = '🧪 Testar Conexão';
        }
      );
    } catch (error) {
      console.error('Erro ao testar API:', error);
      this.showMessage(`✗ Erro ao conectar: ${error.message}`, 'error');
      btn.disabled = false;
      btn.textContent = '🧪 Testar Conexão';
    }
  }

  togglePasswordVisibility() {
    const input = document.getElementById('api-key');
    const btn = document.getElementById('toggle-password');

    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = '<span aria-hidden="true">🙈</span>';
      btn.setAttribute('aria-label', 'Ocultar chave de API');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      input.type = 'password';
      btn.innerHTML = '<span aria-hidden="true">👁️</span>';
      btn.setAttribute('aria-label', 'Mostrar chave de API');
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  async saveAutoOptimize() {
    const autoOptimize = document.getElementById('auto-optimize-checkbox').checked;
    await chrome.storage.sync.set({ autoOptimize });
  }

  async saveNotifications() {
    const showNotifications = document.getElementById('show-notifications-checkbox').checked;
    await chrome.storage.sync.set({ showNotifications });
  }

  showMessage(message, type) {
    const statusDiv = document.getElementById('status-message');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;

    setTimeout(() => {
      statusDiv.className = 'status-message';
    }, 5000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
