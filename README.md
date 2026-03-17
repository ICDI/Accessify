# WCAG Accessibility Transformer

Um plugin poderoso do Google Chrome que transforma páginas web em acessíveis seguindo as diretrizes **WCAG 2.1**, com foco especial em usuários cegos ou de baixa visão.

## 🎯 Funcionalidades

### Análise Automática de Acessibilidade
- ✅ Avalia conformidade com critérios WCAG 2.1 (Nível A e AA)
- 🔍 Identifica problemas críticos e avisos
- 📊 Fornece resumo detalhado dos problemas encontrados

### Otimizações Inteligentes com IA
- 🤖 Usa OpenRouter para análise com modelos de IA avançados
- 📝 Gera textos alternativos automáticos para imagens
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
- **1.1.1 Alternativas de Texto** - Imagens devem ter alt text
- **1.3.1 Informações e Relações** - Estrutura semântica apropriada
- **2.1.1 Teclado** - Todos os elementos acessíveis por teclado
- **2.4.2 Título da Página** - Página deve ter título descritivo
- **2.4.4 Propósito do Link** - Links devem ter texto descritivo
- **3.1.1 Idioma da Página** - Idioma deve ser declarado

### Nível AA (Melhorado)
- **1.4.3 Contraste (Mínimo)** - Contraste mínimo 4.5:1
- **2.4.7 Foco Visível** - Elementos focáveis devem ter indicador visual

## 🚀 Como Instalar

### Pré-requisitos
- Google Chrome versão 88+
- Uma chave de API do OpenRouter (gratuita em https://openrouter.ai)

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

4. **Configurar a API**
   - Clique no ícone do plugin (♿) na barra de ferramentas
   - Clique em "⚙️ Configurações"
   - Insira sua chave de API do OpenRouter
   - Escolha o modelo de IA desejado
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

| Modelo | Descrição | Custo |
|--------|-----------|-------|
| **Auto** (Recomendado) | OpenRouter escolhe o melhor modelo | Variável |
| GPT-4 Turbo | Mais avançado da OpenAI | Alto |
| GPT-3.5 Turbo | Rápido e eficiente | Baixo |
| Claude 3 Opus | Mais poderoso da Anthropic | Alto |
| Claude 3 Sonnet | Equilíbrio qualidade/custo | Médio |
| Mistral Large | Código aberto, rápido | Baixo |

### Variáveis de Ambiente

O plugin armazena as seguintes informações localmente:
- `apiKey` - Chave de API do OpenRouter
- `selectedModel` - Modelo de IA selecionado
- `autoOptimize` - Ativar otimização automática
- `showNotifications` - Mostrar notificações

## 🏗️ Arquitetura

### Estrutura de Arquivos

```
wcag-accessibility-plugin/
├── manifest.json              # Configuração do plugin
├── background.js              # Service worker (integração com API)
├── content.js                 # Content script (análise na página)
├── wcag-evaluator.js          # Avaliador WCAG
├── popup.html                 # Interface do popup
├── popup.js                   # Lógica do popup
├── options.html               # Página de configurações
├── options.js                 # Lógica das configurações
├── icons/                     # Ícones do plugin
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md                  # Este arquivo
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
OpenRouter API (Análise com IA)
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
- ⚠️ Imagens são enviadas para OpenRouter para geração de alt text

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

### "API não configurada"
- Verifique se você inseriu a chave de API corretamente
- Teste a conexão usando o botão "🧪 Testar Conexão"
- Certifique-se de que sua chave de API é válida em https://openrouter.ai

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
