# 📁 Estrutura do Projeto - WCAG Accessibility Transformer

## Visão Geral da Estrutura

```
wcag-accessibility-plugin/
├── manifest.json                    # Configuração do plugin Chrome
├── background.js                    # Service worker (integração com API)
├── content.js                       # Content script (análise na página)
├── wcag-evaluator.js                # Avaliador WCAG (integrado em content.js)
├── popup.html                       # Interface do popup
├── popup.js                         # Lógica do popup
├── options.html                     # Página de configurações
├── options.js                       # Lógica das configurações
├── test-page.html                   # Página de teste com 10 problemas
├── icons/                           # Ícones do plugin
│   ├── icon-16.png                  # Ícone 16x16 (barra de ferramentas)
│   ├── icon-48.png                  # Ícone 48x48 (página de extensões)
│   └── icon-128.png                 # Ícone 128x128 (Chrome Web Store)
├── README.md                        # Documentação principal
├── INSTALLATION.md                  # Guia de instalação
├── TECHNICAL.md                     # Documentação técnica
├── VALIDATION.md                    # Checklist de validação
├── STRUCTURE.md                     # Este arquivo
├── PROJECT_SUMMARY.txt              # Resumo executivo
└── LICENSE                          # Licença MIT
```

## Descrição Detalhada dos Arquivos

### Arquivos de Configuração

#### `manifest.json` (816 bytes)
**Propósito:** Configuração do plugin Chrome
**Conteúdo Principal:**
- Versão do manifest (v3)
- Permissões necessárias
- Declaração de scripts
- Configuração de ícones
- Página de opções

**Exemplo:**
```json
{
  "manifest_version": 3,
  "name": "WCAG Accessibility Transformer",
  "version": "1.0.0",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" }
}
```

### Scripts Principais

#### `background.js` (8.7 KB)
**Propósito:** Service worker do plugin
**Responsabilidades:**
- Gerenciar integração com OpenRouter API
- Armazenar e recuperar configurações
- Processar requisições de análise
- Gerar alt text para imagens
- Comunicar com content script e popup

**Classes:**
- `AccessibilityOptimizer` - Gerencia análise com IA

**Métodos Principais:**
```javascript
loadSettings()                      // Carrega configurações
saveSettings(apiKey, model)         // Salva configurações
generateImageAltText(imageUrl)      // Gera alt text
analyzePageForOptimizations()       // Análise completa
processImages(images)               // Processa múltiplas imagens
```

#### `content.js` (22.5 KB)
**Propósito:** Script executado no contexto da página
**Responsabilidades:**
- Executar avaliação WCAG localmente
- Extrair conteúdo da página
- Aplicar otimizações
- Criar interface de overlay
- Comunicar com background script

**Classes:**
- `WCAGEvaluator` - Avalia conformidade WCAG
- `AccessibilityAnalyzer` - Gerencia análise e otimizações

**Métodos Principais:**
```javascript
// WCAGEvaluator
evaluate()                          // Executa avaliação completa
evaluateImages()                    // Avalia imagens
evaluateHeadings()                  // Avalia estrutura de títulos
evaluateForms()                     // Avalia formulários
evaluateLinks()                     // Avalia links
evaluateColorContrast()             // Avalia contraste

// AccessibilityAnalyzer
analyzePageForAccessibility()       // Inicia análise
applyOptimizations()                // Aplica otimizações
createAccessibilityOverlay()        // Cria overlay
```

#### `wcag-evaluator.js` (13.6 KB)
**Propósito:** Avaliador WCAG (também integrado em content.js)
**Responsabilidades:**
- Implementar lógica de avaliação WCAG
- Identificar problemas de acessibilidade
- Classificar por severidade
- Agrupar problemas por tipo

**Critérios Avaliados:**
- 1.1.1 Alternativas de Texto
- 1.3.1 Informações e Relações
- 1.4.3 Contraste de Cores
- 2.1.1 Teclado
- 2.4.2 Título da Página
- 2.4.4 Propósito do Link
- 2.4.7 Foco Visível
- 3.1.1 Idioma da Página

### Interface do Usuário

#### `popup.html` (9.7 KB)
**Propósito:** Interface do popup do plugin
**Componentes:**
- Header com status
- Seção de ações (botão de análise)
- Seção de progresso (barra + etapas)
- Seção de resultados (resumo)
- Link para configurações

**Estrutura HTML:**
```html
<div class="container">
  <div class="header">...</div>
  <div class="section" id="main-section">...</div>
  <div class="section" id="progress-section">...</div>
  <div class="section" id="results-section">...</div>
  <div class="settings-link">...</div>
</div>
```

#### `popup.js` (11.7 KB)
**Propósito:** Lógica do popup
**Responsabilidades:**
- Gerenciar fluxo de análise
- Atualizar interface
- Comunicar com background e content scripts
- Exibir progresso e resultados

**Classes:**
- `PopupController` - Controla interface do popup

**Métodos Principais:**
```javascript
init()                              // Inicializa popup
startAnalysis()                     // Inicia análise
applyOptimizations()                // Aplica otimizações
showProgressSection()               // Mostra progresso
showResults()                       // Mostra resultados
```

#### `options.html` (13.6 KB)
**Propósito:** Página de configurações
**Componentes:**
- Campo de API key
- Seletor de modelo de IA
- Botão de teste de conexão
- Configurações de comportamento
- Informações sobre o plugin

**Seções:**
- Configuração da API OpenRouter
- Comportamento do plugin
- Informações e recursos

#### `options.js` (5.4 KB)
**Propósito:** Lógica da página de configurações
**Responsabilidades:**
- Carregar e salvar configurações
- Validar API key
- Testar conexão com OpenRouter
- Gerenciar preferências do usuário

**Classes:**
- `OptionsController` - Controla página de opções

**Métodos Principais:**
```javascript
init()                              // Inicializa página
loadSettings()                      // Carrega configurações
handleSaveSettings()                // Salva configurações
testAPIConnection()                 // Testa API
togglePasswordVisibility()          // Alterna visibilidade de senha
```

### Páginas de Teste

#### `test-page.html` (9.0 KB)
**Propósito:** Página de teste com problemas intencionais
**Problemas Inclusos:**
1. Sem H1 (título principal)
2. Estrutura de títulos ruim (H3 → H5)
3. Imagens sem alt text
4. Imagem com alt text muito curto
5. Links com texto genérico ("clique aqui")
6. Formulário sem labels
7. Tabela sem headers semânticos
8. Contraste de cores baixo
9. Div com onclick (não semântico)
10. Sem indicador de foco visual

**Uso:**
```
1. Abra test-page.html no navegador
2. Clique no ícone do plugin
3. Clique em "Analisar Acessibilidade"
4. Verifique se todos os 10 problemas são detectados
```

### Ícones

#### `icons/icon-16.png` (216 bytes)
**Uso:** Barra de ferramentas do Chrome
**Dimensões:** 16x16 pixels
**Formato:** PNG com fundo azul e símbolo de acessibilidade

#### `icons/icon-48.png` (224 bytes)
**Uso:** Página de extensões do Chrome
**Dimensões:** 48x48 pixels
**Formato:** PNG com fundo azul e símbolo de acessibilidade

#### `icons/icon-128.png` (231 bytes)
**Uso:** Chrome Web Store
**Dimensões:** 128x128 pixels
**Formato:** PNG com fundo azul e símbolo de acessibilidade

### Documentação

#### `README.md` (7.6 KB)
**Conteúdo:**
- Descrição do projeto
- Funcionalidades principais
- Critérios WCAG avaliados
- Instruções de instalação
- Como usar
- Recursos úteis
- Aviso legal

#### `INSTALLATION.md` (7.4 KB)
**Conteúdo:**
- Pré-requisitos
- Obtenção de chave de API OpenRouter
- Instalação passo a passo
- Configuração do plugin
- Casos de uso
- Solução de problemas
- Monitoramento de uso

#### `TECHNICAL.md` (12.2 KB)
**Conteúdo:**
- Arquitetura do plugin
- Descrição de componentes
- Fluxo de dados
- Integração com OpenRouter
- Armazenamento de dados
- Comunicação entre scripts
- Otimizações aplicadas
- Tratamento de erros
- Performance
- Segurança

#### `VALIDATION.md` (6.9 KB)
**Conteúdo:**
- Checklist de validação
- Testes de funcionalidade
- Testes de compatibilidade
- Testes de segurança
- Testes de casos extremos
- Testes de erro
- Checklist final

#### `STRUCTURE.md` (Este arquivo)
**Conteúdo:**
- Visão geral da estrutura
- Descrição detalhada de cada arquivo
- Tamanho e propósito
- Métodos principais
- Exemplos de uso

#### `PROJECT_SUMMARY.txt` (10.1 KB)
**Conteúdo:**
- Resumo executivo
- Descrição do projeto
- Arquivos inclusos
- Funcionalidades principais
- Critérios WCAG
- Requisitos
- Instalação rápida
- Arquitetura
- Integração com OpenRouter
- Testes
- Documentação
- Suporte

#### `LICENSE` (1.1 KB)
**Conteúdo:** Licença MIT completa

## Fluxo de Dados

### Análise de Página

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuário clica em "Analisar Acessibilidade" (popup.js)   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 2. Popup envia mensagem ao content script (content.js)      │
│    { action: 'analyzeAccessibility' }                       │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 3. Content script executa WCAGEvaluator.evaluate()          │
│    - Avalia imagens                                         │
│    - Avalia títulos                                         │
│    - Avalia formulários                                     │
│    - Avalia links                                           │
│    - Avalia contraste                                       │
│    - Avalia estrutura semântica                             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 4. Retorna issues encontrados e conteúdo da página          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 5. Popup envia para background script (background.js)       │
│    { action: 'analyzePageForOptimizations' }                │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 6. Background script envia para OpenRouter API              │
│    POST https://openrouter.io/api/v1/chat/completions      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 7. OpenRouter retorna recomendações de otimização           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 8. Popup exibe resultados e etapas de otimização            │
└─────────────────────────────────────────────────────────────┘
```

### Aplicação de Otimizações

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Usuário clica em "Aplicar Otimizações" (popup.js)        │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│ 2. Popup cria overlay na página (content.js)                 │
│    createAccessibilityOverlay()                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│ 3. Content script aplica otimizações                         │
│    applyOptimizations(optimizations)                         │
│    - Adiciona alt text em imagens                            │
│    - Melhora estrutura HTML                                  │
│    - Adiciona ARIA labels                                    │
│    - Aplica estilos CSS                                      │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│ 4. Atualiza etapas de progresso no overlay                   │
│    updateStepsDisplay(steps)                                 │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│ 5. Página é modificada em tempo real                         │
│    Usuário vê as mudanças aplicadas                          │
└──────────────────────────────────────────────────────────────┘
```

## Tamanhos dos Arquivos

| Arquivo | Tamanho | Tipo |
|---------|---------|------|
| manifest.json | 816 B | Configuração |
| background.js | 8.7 KB | Script |
| content.js | 22.5 KB | Script |
| wcag-evaluator.js | 13.6 KB | Script |
| popup.html | 9.7 KB | HTML |
| popup.js | 11.7 KB | Script |
| options.html | 13.6 KB | HTML |
| options.js | 5.4 KB | Script |
| test-page.html | 9.0 KB | HTML |
| icon-16.png | 216 B | Imagem |
| icon-48.png | 224 B | Imagem |
| icon-128.png | 231 B | Imagem |
| README.md | 7.6 KB | Documentação |
| INSTALLATION.md | 7.4 KB | Documentação |
| TECHNICAL.md | 12.2 KB | Documentação |
| VALIDATION.md | 6.9 KB | Documentação |
| PROJECT_SUMMARY.txt | 10.1 KB | Documentação |
| LICENSE | 1.1 KB | Licença |
| **TOTAL** | **~141 KB** | **20 arquivos** |

## Dependências

### Externas
- **OpenRouter API** - Para análise com IA
- **Chrome 88+** - Para executar o plugin

### Internas
- Nenhuma dependência de biblioteca externa
- Usa apenas APIs nativas do Chrome
- Usa apenas JavaScript vanilla

## Como Usar Cada Arquivo

### Para Desenvolvedores

1. **Modificar funcionalidade WCAG**
   - Editar: `wcag-evaluator.js` e `content.js`
   - Adicionar novos métodos em `WCAGEvaluator`

2. **Modificar integração com API**
   - Editar: `background.js`
   - Modificar classe `AccessibilityOptimizer`

3. **Modificar interface**
   - Editar: `popup.html`, `popup.js`, `options.html`, `options.js`
   - Modificar estilos CSS nos arquivos HTML

4. **Adicionar novos testes**
   - Editar: `test-page.html`
   - Adicionar novos problemas intencionais

### Para Usuários

1. **Instalar o plugin**
   - Seguir instruções em `INSTALLATION.md`

2. **Usar o plugin**
   - Clicar no ícone ♿
   - Seguir instruções no popup

3. **Configurar**
   - Abrir `options.html` via ícone de configurações
   - Inserir chave de API OpenRouter

4. **Testar**
   - Abrir `test-page.html`
   - Executar análise
   - Verificar se detecta todos os 10 problemas

## Notas Importantes

1. **Arquivo ZIP**
   - Extrair em uma pasta
   - Não renomear a pasta principal
   - Manter a estrutura de diretórios

2. **Ícones**
   - Devem estar em formato PNG
   - Devem estar na pasta `icons/`
   - Nomes devem corresponder ao manifest.json

3. **Configuração**
   - manifest.json não deve ser modificado para instalação básica
   - Apenas para desenvolvimento avançado

4. **Segurança**
   - Nunca compartilhe sua chave de API
   - Armazene em local seguro
   - Regenere se comprometida

---

**Última Atualização:** Março 2026
**Versão:** 1.0.0
