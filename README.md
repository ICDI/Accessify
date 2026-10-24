# WCAG Accessibility Transformer

Um plugin poderoso do Google Chrome que transforma páginas web em acessíveis seguindo as diretrizes **WCAG 2.1**, com foco especial em usuários cegos ou de baixa visão.

## 🎯 Funcionalidades

### Análise Automática de Acessibilidade
- ✅ Avalia conformidade com critérios WCAG 2.1 (Nível A e AA)
- 🔍 Identifica problemas críticos e avisos
- 📊 Fornece resumo detalhado dos problemas encontrados

### Otimizações Inteligentes com IA
- 🤖 Usa Ollama local (Qwen3 8B) ou OpenRouter para análise
- 📝 Gera textos alternativos (contexto da página no local; visão no OpenRouter)
- 🏗️ Melhora estrutura HTML semântica
- 🎨 Otimiza contraste de cores
- ♿ Adiciona ARIA labels apropriados
- ⌨️ Garante navegação por teclado

### Interface Amigável
- 📋 Mostra etapas de otimização em tempo real
- 🎯 Permite revisar mudanças antes de aplicar
- 🔄 Suporta otimização automática de todas as páginas
- ⚙️ Painel de configurações intuitivo

## 📋 Critérios WCAG Avaliados

### Nível A (Essencial)
- **1.1.1 Alternativas de Texto** - Imagens, SVG, `input type="image"` e `area`
- **1.3.1 Informações e Relações** - Headings, labels, landmarks, tabelas com `th`
- **1.3.2 Sequência Significativa** - CSS `order` vs ordem do DOM
- **1.3.3 / 1.4.1 Uso de Cor** - Links no texto distinguíveis só por cor
- **2.1.1 Teclado** - Elementos clicáveis não semânticos e `tabindex` positivo
- **2.4.1 Pular Blocos** - Skip link ou região `main`
- **2.4.2 Título da Página** - Página deve ter título descritivo
- **2.4.4 Propósito do Link** - Links devem ter texto descritivo
- **2.5.3 Nome contém Rótulo** - `aria-label` deve incluir o texto visível
- **3.1.1 Idioma da Página** - Idioma deve ser declarado
- **3.3.2 Rótulos ou Instruções** - Label visível, não só placeholder/`title`
- **4.1.2 Nome, Função, Valor** - iframe com title, IDs únicos, ARIA válido

### Nível AA (Melhorado)
- **1.3.5 Propósito do Input** - `autocomplete` em campos comuns
- **1.4.3 Contraste (Mínimo)** - Contraste mínimo 4.5:1 (3:1 para texto grande)
- **1.4.4 Redimensionar Texto** - Viewport não pode bloquear zoom
- **1.4.11 Contraste de Não-texto** - Componentes de interface 3:1
- **2.4.7 Foco Visível** - Elementos focáveis devem ter indicador visual

## 🚀 Como Instalar

### Pré-requisitos
- Google Chrome versão 88+
- **Ollama local** com o modelo `qwen3:8b` **ou** uma chave de API do OpenRouter (https://openrouter.ai)

### Passos de Instalação

1. **Clonar ou baixar o plugin**
   ```bash
   git clone https://github.com/seu-usuario/wcag-accessibility-plugin.git
   cd wcag-accessibility-plugin
   ```

2. **Abrir o Chrome e acessar a página de extensões**
   - Abra o Chrome
   - Digite `chrome://extensions/` na barra de endereço
   - Ative o "Modo de desenvolvedor" (canto superior direito)

3. **Carregar o plugin**
   - Clique em "Carregar extensão não empacotada"
   - Selecione a pasta do plugin
   - O plugin aparecerá na lista de extensões

4. **Configurar a IA**
   - Clique no ícone do plugin (♿) na barra de ferramentas
   - Clique em "⚙️ Configurações"
   - **Local (padrão):** instale o [Ollama](https://ollama.com), rode `ollama pull qwen3:8b` e teste a conexão
   - Se o teste local retornar 403, defina `OLLAMA_ORIGINS=chrome-extension://*` e reinicie o Ollama
   - **OpenRouter:** insira a chave de API e escolha um modelo barato da lista
   - Clique em "Salvar Configurações"

## 📖 Como Usar

### Análise Manual
1. Navegue até uma página web
2. Clique no ícone do plugin (♿) na barra de ferramentas
3. Clique em "🔍 Analisar Acessibilidade"
4. Aguarde a análise ser concluída
5. Revise os problemas encontrados
6. Clique em "✨ Aplicar Otimizações" para fazer as mudanças

### Otimização Automática
1. Acesse as configurações do plugin
2. Ative "Otimizar automaticamente todas as páginas"
3. O plugin analisará cada página que você visitar

## 🔧 Configuração

### Modelos de IA Disponíveis

**Local (Ollama)**

| Modelo | Descrição | Custo |
|--------|-----------|-------|
| **qwen3:8b** (padrão) | Roda na sua máquina. Texto apenas; alt text usa contexto da página | Gratuito |

**OpenRouter**

| Modelo | Descrição | Custo (USD / 1M tokens) |
|--------|-----------|-------------------------|
| **DeepSeek V4 Flash** (padrão OpenRouter) | Melhor custo para JSON de remediação | $0.05 / $0.14 |
| GPT-5 Nano | Rápido, segue instruções; aceita visão | $0.05 / $0.40 |
| Qwen 3.5 Flash | Mesma família do modelo local | $0.07 / $0.26 |
| Gemini 2.5 Flash Lite | Barato e com visão para alt text | $0.10 / $0.40 |

### Variáveis de Ambiente

O plugin armazena as seguintes informações localmente:
- `provider` - `local` (Ollama) ou `openrouter`
- `localBaseUrl` / `localModel` - endpoint e modelo Ollama
- `apiKey` - Chave de API do OpenRouter
- `selectedModel` - Modelo OpenRouter selecionado
- `autoOptimize` - Ativar otimização automática
- `showNotifications` - Mostrar notificações

## 🏗️ Arquitetura

### Estrutura de Arquivos

```
wcag-accessibility-plugin/
├── manifest.json
├── ai-config.js               # Provedores e modelos
├── background.js              # Service worker (Ollama + OpenRouter)
├── content.js                 # Content script (aplicação)
├── wcag-evaluator.js          # Avaliador WCAG
├── popup.html / popup.js
├── options.html / options.js
├── icons/
└── README.md
```

### Fluxo de Dados

```
Página Web
    ↓
Content Script (wcag-evaluator.js)
    ↓
Análise WCAG Local
    ↓
Background Service Worker
    ↓
Ollama local (qwen3:8b)  ou  OpenRouter API
    ↓
Recomendações de Otimização
    ↓
Content Script (Aplicar mudanças)
    ↓
Página Otimizada
```

## 🔐 Privacidade e Segurança

- ✅ Chave de API armazenada **localmente** no navegador
- ✅ Nenhum dado pessoal é enviado para servidores
- ✅ Análise local executada antes de enviar para IA
- ✅ Conteúdo da página é processado apenas para otimização
- ⚠️ No OpenRouter com visão, imagens podem ser enviadas para gerar alt text
- ✅ No Ollama local, o alt text usa só o contexto textual da página

## 📝 Exemplos de Otimizações

### Antes
```html
<img src="photo.jpg">
<div onclick="navigate()">Clique aqui</div>
<input type="text">
```

### Depois
```html
<img src="photo.jpg" alt="Retrato de uma pessoa sorrindo em um parque">
<a href="page.html" aria-label="Navegue para a página principal">Clique aqui</a>
<label for="name">Nome:</label>
<input type="text" id="name" aria-label="Campo para inserir seu nome">
```

## 🐛 Solução de Problemas

### "API não configurada" / Ollama não responde
- No modo local, confirme que o Ollama está rodando e que `qwen3:8b` foi baixado (`ollama pull qwen3:8b`)
- Se o teste retornar 403, defina `OLLAMA_ORIGINS=chrome-extension://*` e reinicie o Ollama
- No OpenRouter, verifique a chave e teste a conexão em https://openrouter.ai

### "Erro ao analisar página"
- Recarregue a página
- Certifique-se de que o site não está bloqueando o plugin
- Verifique se há espaço em branco suficiente na API (créditos)

### "Mudanças não foram aplicadas"
- Verifique se o JavaScript está ativado no navegador
- Tente novamente em uma página diferente
- Limpe o cache do navegador

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📚 Recursos Úteis

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/standards-guidelines/wcag/)
- [Web Accessibility Initiative (WAI)](https://www.w3.org/WAI/)
- [OpenRouter Documentation](https://openrouter.ai/docs)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## ⚠️ Aviso Legal

Este plugin é fornecido "como está". Sempre revise as mudanças de acessibilidade antes de aplicá-las em produção. Recomenda-se:

1. Testar com usuários reais com deficiências visuais
2. Usar ferramentas de acessibilidade profissionais (WAVE, Axe, etc.)
3. Realizar testes com leitores de tela (NVDA, JAWS, VoiceOver)
4. Consultar especialistas em acessibilidade web

## 🙋 Suporte

Para reportar bugs ou sugerir melhorias, abra uma issue no repositório.

---

**Desenvolvido com ❤️ para tornar a web mais acessível para todos.**
