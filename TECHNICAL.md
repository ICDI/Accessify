# 🔧 Documentação Técnica - WCAG Accessibility Transformer

## Arquitetura do Plugin

### Visão Geral
O plugin é estruturado em três camadas principais:

```
┌─────────────────────────────────────────────────────────────┐
│                    Página Web (DOM)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Content Script (content.js)                     │
│  - WCAGEvaluator (análise local)                            │
│  - AccessibilityAnalyzer (gerenciamento)                    │
│  - Aplicação de otimizações                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│         Background Service Worker (background.js)           │
│  - AccessibilityOptimizer (integração com API)             │
│  - Gerenciamento de configurações                           │
│  - Comunicação com OpenRouter                               │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              OpenRouter API (Modelos de IA)                 │
│  - Análise de otimizações                                   │
│  - Geração de alt text para imagens                         │
└─────────────────────────────────────────────────────────────┘
```

## Componentes Principais

### 1. manifest.json
**Função:** Configuração do plugin Chrome

**Campos Principais:**
- `manifest_version: 3` - Versão do Manifest V3 (obrigatório)
- `permissions` - Permissões necessárias
- `host_permissions` - Acesso a todas as URLs
- `content_scripts` - Scripts executados no contexto da página
- `background.service_worker` - Worker de fundo
- `action` - Ícone e popup

### 2. content.js
**Função:** Executado no contexto da página web

**Classes:**
- `WCAGEvaluator` - Avalia conformidade WCAG
- `AccessibilityAnalyzer` - Gerencia análise e aplicação de otimizações

**Métodos Principais:**
```javascript
// Análise
analyzePageForAccessibility()    // Inicia análise
extractPageContent()             // Extrai conteúdo da página
extractImages()                  // Extrai imagens

// Aplicação
applyOptimizations()             // Aplica mudanças
createAccessibilityOverlay()     // Cria interface de overlay

// Comunicação
updateStepsDisplay()             // Atualiza etapas
updateSummary()                  // Atualiza resumo
```

**Fluxo de Execução:**
1. Content script carrega automaticamente em todas as páginas
2. Escuta mensagens do background script
3. Executa análise WCAG localmente
4. Aplica otimizações quando solicitado

### 3. background.js
**Função:** Service worker que gerencia integração com API

**Classes:**
- `AccessibilityOptimizer` - Gerencia chamadas à API OpenRouter

**Métodos Principais:**
```javascript
// Configuração
loadSettings()                   // Carrega configurações
saveSettings()                   // Salva configurações
isConfigured()                   // Verifica se API está configurada

// Análise com IA
generateImageAltText()           // Gera alt text para imagem
analyzePageForOptimizations()    // Análise completa com IA
processImages()                  // Processa múltiplas imagens
```

**Fluxo de Integração com OpenRouter:**
1. Recebe requisição do popup ou content script
2. Valida configuração da API
3. Monta payload JSON
4. Envia para `https://openrouter.io/api/v1/chat/completions`
5. Processa resposta e retorna resultado

### 4. popup.html / popup.js
**Função:** Interface principal do plugin

**Componentes:**
- Header com status
- Seção de ações (Analisar)
- Seção de progresso (durante análise)
- Seção de resultados
- Links para configurações

**Estados:**
1. `main-section` - Botão de análise
2. `progress-section` - Barra de progresso e etapas
3. `results-section` - Resumo e botão de aplicar

### 5. options.html / options.js
**Função:** Página de configurações

**Campos:**
- Chave de API OpenRouter
- Seleção de modelo de IA
- Teste de conexão
- Configurações de comportamento

## Fluxo de Dados

### Análise de Página

```
1. Usuário clica em "Analisar"
   ↓
2. Popup envia mensagem ao content script
   ↓
3. Content script executa WCAGEvaluator
   ↓
4. Retorna issues encontrados
   ↓
5. Popup envia para background script
   ↓
6. Background envia para OpenRouter API
   ↓
7. Retorna recomendações de otimização
   ↓
8. Popup exibe resultados
```

### Aplicação de Otimizações

```
1. Usuário clica em "Aplicar Otimizações"
   ↓
2. Popup cria overlay na página
   ↓
3. Content script aplica mudanças
   ↓
4. Atualiza etapas de progresso
   ↓
5. Página é modificada em tempo real
```

## Critérios WCAG Avaliados

### Nível A (Essencial)

| Critério | Código | Descrição |
|----------|--------|-----------|
| Alternativas de Texto | 1.1.1 | Imagens devem ter alt text |
| Informações e Relações | 1.3.1 | Estrutura semântica apropriada |
| Teclado | 2.1.1 | Acessível por teclado |
| Título da Página | 2.4.2 | Deve ter título descritivo |
| Propósito do Link | 2.4.4 | Links devem ter texto descritivo |
| Idioma da Página | 3.1.1 | Deve declarar idioma |

### Nível AA (Melhorado)

| Critério | Código | Descrição |
|----------|--------|-----------|
| Contraste (Mínimo) | 1.4.3 | Contraste mínimo 4.5:1 |
| Foco Visível | 2.4.7 | Indicador visual de foco |

## Integração com OpenRouter

### Endpoint
```
POST https://openrouter.io/api/v1/chat/completions
```

### Headers Obrigatórios
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${apiKey}`,
  'HTTP-Referer': 'https://wcag-accessibility-plugin.local',
  'X-Title': 'WCAG Accessibility Plugin'
}
```

### Payload para Geração de Alt Text
```javascript
{
  model: "openrouter/auto",
  messages: [
    {
      role: "system",
      content: "Você é um especialista em acessibilidade web..."
    },
    {
      role: "user",
      content: "Gere um alt text para esta imagem: [URL]"
    }
  ],
  max_tokens: 100,
  temperature: 0.7
}
```

### Payload para Análise de Otimizações
```javascript
{
  model: "openrouter/auto",
  messages: [
    {
      role: "system",
      content: "Você é um especialista em WCAG 2.1..."
    },
    {
      role: "user",
      content: "Analise esta página e forneça recomendações..."
    }
  ],
  max_tokens: 2000,
  temperature: 0.7
}
```

## Armazenamento de Dados

### Chrome Storage API
```javascript
// Sincronização entre dispositivos
chrome.storage.sync.set({
  apiKey: "sk-or-...",
  selectedModel: "openrouter/auto",
  autoOptimize: false,
  showNotifications: true
});

// Recuperar
chrome.storage.sync.get(['apiKey', 'selectedModel'], (result) => {
  console.log(result);
});
```

## Comunicação entre Scripts

### Content Script → Background
```javascript
chrome.runtime.sendMessage(
  { action: 'analyzePageForOptimizations', pageContent, issues },
  (response) => {
    if (response.success) {
      // Processar resultado
    }
  }
);
```

### Popup → Content Script
```javascript
chrome.tabs.sendMessage(
  tabId,
  { action: 'analyzeAccessibility' },
  (response) => {
    // Processar resultado
  }
);
```

### Listeners
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeAccessibility') {
    // Processar e responder
    sendResponse({ success: true, data: result });
  }
  return true; // Indica resposta assíncrona
});
```

## Otimizações Aplicadas

### 1. Textos Alternativos
```javascript
// Antes
<img src="photo.jpg">

// Depois
<img src="photo.jpg" alt="Descrição gerada por IA" role="img">
```

### 2. Estrutura de Títulos
```javascript
// Antes
<h3>Título</h3>
<h5>Subtítulo</h5>

// Depois
<h1>Título Principal</h1>
<h2>Subtítulo</h2>
```

### 3. ARIA Labels
```javascript
// Antes
<div onclick="navigate()">Clique aqui</div>

// Depois
<a href="page.html" aria-label="Navegue para página principal">
  Clique aqui
</a>
```

### 4. Contraste de Cores
```javascript
// Adiciona CSS para melhorar contraste
const style = document.createElement('style');
style.textContent = `
  .low-contrast { color: #000; background: #fff; }
  a:focus { outline: 2px solid #1976d2; }
`;
document.head.appendChild(style);
```

## Tratamento de Erros

### Erro de API
```javascript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message);
  }
} catch (error) {
  console.error('Erro:', error);
  sendResponse({ success: false, error: error.message });
}
```

### Erro de Análise
```javascript
if (!analysisResult.success) {
  showError(`Erro: ${analysisResult.error}`);
  return;
}
```

## Performance

### Otimizações Implementadas

1. **Análise Local**
   - Avaliação WCAG executada no navegador
   - Reduz latência e uso de API

2. **Limitação de Elementos**
   - Contraste avaliado apenas em 100 primeiros elementos
   - Evita análise desnecessária

3. **Cache de Configurações**
   - Configurações armazenadas localmente
   - Reduz chamadas ao storage

4. **Processamento Sequencial de Imagens**
   - Delay de 500ms entre requisições
   - Evita rate limiting da API

## Segurança

### Proteção de Chave de API
- ✅ Armazenada localmente no navegador
- ✅ Nunca enviada para servidores de terceiros
- ✅ Mascarada na interface (mostra ***)

### Validação de Entrada
- ✅ Verificação de URL antes de processar
- ✅ Sanitização de conteúdo HTML
- ✅ Validação de resposta JSON

### Isolamento de Contexto
- ✅ Content script isolado da página
- ✅ Background script isolado do content script
- ✅ Popup isolado do contexto da página

## Testes

### Página de Teste
- `test-page.html` contém 10 problemas intencionais
- Útil para validar funcionalidade do plugin

### Checklist de Teste
- [ ] Plugin carrega sem erros
- [ ] Análise identifica todos os 10 problemas
- [ ] Geração de alt text funciona
- [ ] Otimizações são aplicadas
- [ ] Página permanece funcional após otimizações
- [ ] Teste com leitor de tela (NVDA/JAWS)

## Extensões Futuras

### Possíveis Melhorias
1. Suporte para mais critérios WCAG (Nível AAA)
2. Exportação de relatório em PDF
3. Integração com ferramentas de CI/CD
4. Suporte para Firefox e Edge
5. Análise de vídeos e áudio
6. Detecção automática de padrões de acessibilidade
7. Histórico de análises
8. Comparação antes/depois

## Referências

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/standards-guidelines/wcag/)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [OpenRouter Documentation](https://openrouter.ai/docs)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Web Accessibility Initiative](https://www.w3.org/WAI/)
