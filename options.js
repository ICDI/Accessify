/**
 * Options Script - Gerencia configurações do plugin
 */

class OptionsController {
  constructor() {
    this.init();
  }

  /**
   * Inicializa o controlador
   */
  async init() {
    this.setupEventListeners();
    await this.loadSettings();
  }

  /**
   * Configura event listeners
   */
  setupEventListeners() {
    const form = document.getElementById('settings-form');
    form.addEventListener('submit', (e) => this.handleSaveSettings(e));

    document.getElementById('test-api-btn').addEventListener('click', () => this.testAPIConnection());
    document.getElementById('toggle-password').addEventListener('click', () => this.togglePasswordVisibility());
    document.getElementById('auto-optimize-checkbox').addEventListener('change', () => this.saveAutoOptimize());
    document.getElementById('show-notifications-checkbox').addEventListener('change', () => this.saveNotifications());
  }

  /**
   * Carrega configurações salvas
   */
  async loadSettings() {
    const settings = await chrome.storage.sync.get(['apiKey', 'selectedModel', 'autoOptimize', 'showNotifications']);

    if (settings.apiKey) {
      document.getElementById('api-key').value = settings.apiKey;
    }

    if (settings.selectedModel) {
      document.getElementById('model-select').value = settings.selectedModel;
    }

    if (settings.autoOptimize) {
      document.getElementById('auto-optimize-checkbox').checked = true;
    }

    if (settings.showNotifications !== false) {
      document.getElementById('show-notifications-checkbox').checked = true;
    }
  }

  /**
   * Salva configurações
   */
  async handleSaveSettings(e) {
    e.preventDefault();

    const apiKey = document.getElementById('api-key').value.trim();
    const selectedModel = document.getElementById('model-select').value;

    if (!apiKey) {
      this.showMessage('Por favor, insira uma chave de API válida', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ apiKey, selectedModel });
      
      // Notificar background script
      chrome.runtime.sendMessage(
        { action: 'saveSettings', apiKey, selectedModel },
        (response) => {
          if (response.success) {
            this.showMessage('✓ Configurações salvas com sucesso!', 'success');
          }
        }
      );
    } catch (error) {
      this.showMessage(`Erro ao salvar: ${error.message}`, 'error');
    }
  }

  /**
   * Testa conexão com API
   */
  async testAPIConnection() {
    const apiKey = document.getElementById('api-key').value.trim();
    const model = document.getElementById('model-select').value;

    if (!apiKey) {
      this.showMessage('Por favor, insira uma chave de API', 'error');
      return;
    }

    const btn = document.getElementById('test-api-btn');
    btn.disabled = true;
    btn.textContent = '⟳ Testando...';

    try {
      // Primeiro, salvar as configurações
      await chrome.storage.sync.set({ apiKey, selectedModel: model });

      // Depois, testar a conexão via background script
      chrome.runtime.sendMessage(
        { action: 'testConnection' },
        (response) => {
          if (chrome.runtime.lastError) {
            this.showMessage(`✗ Erro ao conectar: ${chrome.runtime.lastError.message}`, 'error');
            btn.disabled = false;
            btn.textContent = '🧪 Testar Conexão';
            return;
          }

          if (!response) {
            this.showMessage('✗ Erro ao conectar: sem resposta do background script', 'error');
            btn.disabled = false;
            btn.textContent = '🧪 Testar Conexão';
            return;
          }

          if (response.success) {
            this.showMessage('✓ Conexão com API bem-sucedida! Modelo: ' + model, 'success');
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

  /**
   * Alterna visibilidade da senha
   */
  togglePasswordVisibility() {
    const input = document.getElementById('api-key');
    const btn = document.getElementById('toggle-password');

    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  }

  /**
   * Salva configuração de otimização automática
   */
  async saveAutoOptimize() {
    const autoOptimize = document.getElementById('auto-optimize-checkbox').checked;
    await chrome.storage.sync.set({ autoOptimize });
  }

  /**
   * Salva configuração de notificações
   */
  async saveNotifications() {
    const showNotifications = document.getElementById('show-notifications-checkbox').checked;
    await chrome.storage.sync.set({ showNotifications });
  }

  /**
   * Mostra mensagem de status
   */
  showMessage(message, type) {
    const statusDiv = document.getElementById('status-message');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;

    // Limpar mensagem após 5 segundos
    setTimeout(() => {
      statusDiv.className = 'status-message';
    }, 5000);
  }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
