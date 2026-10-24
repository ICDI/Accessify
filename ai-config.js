/**
 * Configuração compartilhada de provedores e modelos de IA.
 * Carregado no service worker via importScripts e nas páginas da extensão via <script>.
 */

const ACCESSIFY_AI_CONFIG = {
  providers: {
    local: 'local',
    openrouter: 'openrouter'
  },
  defaults: {
    provider: 'local',
    localBaseUrl: 'http://127.0.0.1:11434/v1',
    localModel: 'qwen3:8b',
    selectedModel: 'deepseek/deepseek-v4-flash',
    openRouterBaseUrl: 'https://openrouter.ai/api/v1'
  },
  tokens: {
    test: 32,
    altText: 256,
    optimizations: 4096,
    localAltText: 64,
    localOptimizations: 768
  },
  localLimits: {
    maxImages: 2,
    maxImageLlmCalls: 2,
    maxIssuesPerType: 1,
    htmlExcerpt: 0,
    numCtx: 2048,
    essentialIssueTypes: []
  },
  llmSkipIssueTypes: [
    'svg-missing-name',
    'form-field-no-label',
    'form-field-no-visible-label',
    'spacer-image-missing-alt',
    'iframe-missing-title',
    'table-missing-headers',
    'duplicate-id',
    'clickable-non-semantic',
    'no-bypass-blocks',
    'zoom-restricted',
    'missing-autocomplete',
    'color-only-link',
    'justified-text',
    'small-text',
    'redundant-title-text',
    'redundant-image-alt',
    'no-language-declared',
    'image-alt-too-short',
    'image-alt-too-long',
    'label-in-name-mismatch',
    'low-non-text-contrast',
    'low-color-contrast',
    'image-missing-alt',
    'linked-image-missing-alt',
    'input-image-missing-alt',
    'area-missing-alt',
    'link-generic-text',
    'link-no-text',
    'empty-button',
    'no-h1',
    'no-headings',
    'heading-structure-invalid',
    'heading-level-skip',
    'empty-heading',
    'broken-aria-reference',
    'aria-hidden-content',
    'no-page-title',
    'page-title-too-short',
    'excessive-positive-tabindex',
    'focus-outline-removed',
    'no-page-regions',
    'excessive-div-roles',
    'css-order-mismatch',
    'multiple-h1',
    'autoplay-media-no-control',
    'new-tab-link-no-warning',
    'duplicate-landmark-no-label',
    'infinite-animation-no-reduced-motion',
    'captcha-detected',
    'form-error-not-announced',
    'meta-refresh-redirect',
    'broken-same-page-link',
    'underlined-non-link-text'
  ],
  openRouterModels: [
    {
      id: 'deepseek/deepseek-v4-flash',
      name: 'DeepSeek V4 Flash',
      description: 'Melhor custo para recomendações JSON de acessibilidade. Default do OpenRouter.',
      vision: false
    },
    {
      id: 'openai/gpt-5-nano',
      name: 'OpenAI GPT-5 Nano',
      description: 'Rápido, barato e preciso para seguir instruções de remediação.',
      vision: true
    },
    {
      id: 'qwen/qwen3.5-flash-02-23',
      name: 'Qwen 3.5 Flash',
      description: 'Mesma família do modelo local, rápido e econômico.',
      vision: false
    },
    {
      id: 'google/gemini-2.5-flash-lite',
      name: 'Google Gemini 2.5 Flash Lite',
      description: 'Barato e com visão, o mais adequado para gerar alt text a partir da imagem.',
      vision: true
    }
  ]
};

function getOpenRouterModel(modelId) {
  return ACCESSIFY_AI_CONFIG.openRouterModels.find((model) => model.id === modelId) || null;
}

function getModelDisplayName(modelId, provider = 'openrouter', localModel = ACCESSIFY_AI_CONFIG.defaults.localModel) {
  if (provider === 'local') {
    return `Ollama (${localModel || ACCESSIFY_AI_CONFIG.defaults.localModel})`;
  }

  const model = getOpenRouterModel(modelId);
  return model?.name || modelId || 'Modelo não definido';
}

function openRouterModelSupportsVision(modelId) {
  return !!getOpenRouterModel(modelId)?.vision;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ACCESSIFY_AI_CONFIG = ACCESSIFY_AI_CONFIG;
  globalThis.getOpenRouterModel = getOpenRouterModel;
  globalThis.getModelDisplayName = getModelDisplayName;
  globalThis.openRouterModelSupportsVision = openRouterModelSupportsVision;
}
