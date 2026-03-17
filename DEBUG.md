# 🐛 Guia de Debug - WCAG Accessibility Transformer

Este guia mostra como debugar e diagnosticar problemas no plugin.

## 1. Acessar o Console do Plugin (Service Worker)

O console do Service Worker é onde você verá os logs do `background.js`.

### Passo a Passo:

1. **Abra chrome://extensions/**
2. **Encontre o plugin "WCAG Accessibility Transformer"**
3. **Clique em "Detalhes"**
4. **Role para baixo até encontrar "Atividade do Service Worker"**
5. **Clique em "Inspecionar visualizações ativas"**
6. **Selecione "service_worker"** na lista de abas

Agora você verá o console do Service Worker onde aparecem todos os logs do `background.js`.

### O que você verá:

```
WCAG Accessibility Plugin - Background Service Worker Loaded
Response status: 200
Response headers: Headers {...}
Success response: {choices: Array(1), ...}
```

## 2. Acessar o Console da Página (Content Script)

O console da página mostra os logs do `content.js`.

### Passo a Passo:

1. **Abra qualquer página web**
2. **Pressione F12** para abrir o DevTools
3. **Vá para a aba "Console"**
4. **Você verá os logs do content script**

### O que você verá:

```
WCAG Evaluator initialized
Found 5 images without alt text
Found 3 links with generic text
```

## 3. Acessar o Console do Popup

O console do popup mostra os logs da interface principal.

### Passo a Passo:

1. **Clique no ícone ♿ do plugin**
2. **Pressione F12** para abrir o DevTools
3. **Vá para a aba "Console"**
4. **Você verá os logs do popup.js**

### O que você verá:

```
Popup initialized
Analysis started
Received issues from content script
```

## 4. Acessar o Console das Opções

O console da página de opções mostra os logs do `options.js`.

### Passo a Passo:

1. **Clique no ícone ♿ do plugin**
2. **Clique em "⚙️ Configurações"**
3. **Pressione F12** para abrir o DevTools
4. **Vá para a aba "Console"**
5. **Você verá os logs do options.js**

### O que você verá:

```
Options Controller initialized
Settings loaded
API key found
```

## 5. Verificar Erros de Rede

Para ver exatamente o que está sendo enviado e recebido da API:

### Passo a Passo:

1. **Abra o DevTools (F12)**
2. **Vá para a aba "Network"**
3. **Clique em "Testar Conexão" no plugin**
4. **Procure por requisições para "openrouter.io"**
5. **Clique na requisição para ver detalhes**

### Informações Importantes:

- **Headers:** Mostra os headers enviados (Authorization, Content-Type, etc.)
- **Request Body:** Mostra o JSON que você enviou
- **Response:** Mostra a resposta da API
- **Status:** Mostra o código HTTP (200, 401, 429, 500, etc.)

## 6. Adicionar Logs Personalizados

Se você quiser adicionar mais logs para debug, edite os arquivos:

### No background.js:

```javascript
// Adicione console.log em qualquer lugar
console.log('Testando API com modelo:', this.selectedModel);
console.log('API Key configurada:', this.apiKey ? 'Sim' : 'Não');
console.log('Resposta da API:', data);
```

### No content.js:

```javascript
// Adicione console.log para debug
console.log('Problemas encontrados:', issues);
console.log('Imagens sem alt text:', imagesWithoutAlt);
```

### No options.js:

```javascript
// Adicione console.log para debug
console.log('Salvando configurações:', { apiKey, selectedModel });
console.log('Testando conexão...');
```

## 7. Erros Comuns e Soluções

### Erro: "API key não configurada"

**Causa:** Você não inseriu a chave de API nas configurações

**Solução:**
1. Clique no ícone ♿
2. Clique em "⚙️ Configurações"
3. Insira sua chave de API do OpenRouter
4. Clique em "💾 Salvar Configurações"

### Erro: "Failed to execute 'json' on 'Response'"

**Causa:** A resposta não é um JSON válido

**Solução:**
1. Abra o DevTools (F12)
2. Vá para "Network"
3. Procure pela requisição para openrouter.io
4. Clique em "Response" para ver o que foi retornado
5. Se vir HTML ou texto, significa que a API retornou um erro

### Erro: "Unexpected end of JSON input"

**Causa:** A resposta está vazia ou corrompida

**Solução:**
1. Verifique se sua chave de API é válida
2. Verifique se tem créditos na conta OpenRouter
3. Verifique a conexão com internet
4. Tente novamente

### Erro: "401 Unauthorized"

**Causa:** Sua chave de API é inválida ou expirou

**Solução:**
1. Acesse https://openrouter.io
2. Verifique se sua chave de API está correta
3. Se necessário, gere uma nova chave
4. Atualize a chave no plugin

### Erro: "429 Too Many Requests"

**Causa:** Você fez muitas requisições muito rápido

**Solução:**
1. Aguarde alguns minutos
2. Tente novamente
3. O plugin já tem delay entre requisições de imagens

### Erro: "500 Internal Server Error"

**Causa:** Problema no servidor do OpenRouter

**Solução:**
1. Aguarde alguns minutos
2. Tente novamente
3. Verifique o status em https://openrouter.io

## 8. Verificar Armazenamento Local

Para ver o que está armazenado no navegador:

### Passo a Passo:

1. **Abra chrome://extensions/**
2. **Clique em "Detalhes" do plugin**
3. **Vá para "Storage"** (ou "Armazenamento")
4. **Clique em "Sync storage"** na esquerda
5. **Você verá suas configurações salvas**

### O que você verá:

```json
{
  "apiKey": "sk-or-v1-...",
  "selectedModel": "openai/gpt-5-nano",
  "autoOptimize": false,
  "showNotifications": true
}
```

## 9. Testar com Página de Teste

Use a página de teste incluída no plugin:

### Passo a Passo:

1. **Abra o arquivo `test-page.html` no navegador**
2. **Clique no ícone ♿ do plugin**
3. **Clique em "🔍 Analisar Acessibilidade"**
4. **Abra o DevTools (F12)**
5. **Vá para a aba "Console"**
6. **Você verá os logs da análise**

### Problemas Esperados:

A página de teste tem 10 problemas intencionais:
1. Sem H1
2. Salto de nível de títulos
3. Imagens sem alt text
4. Alt text muito curto
5. Links com texto genérico
6. Formulário sem labels
7. Tabela sem headers
8. Contraste baixo
9. Div com onclick
10. Sem indicador de foco

Se o plugin detectar todos esses problemas, está funcionando corretamente!

## 10. Mensagens de Debug Úteis

### No Service Worker (background.js):

```javascript
// Ver se a API key está configurada
console.log('API Key configurada:', optimizer.isConfigured());

// Ver qual modelo está selecionado
console.log('Modelo selecionado:', optimizer.selectedModel);

// Ver a resposta completa da API
console.log('Resposta da API:', JSON.stringify(data, null, 2));

// Ver erros da API
console.error('Erro ao conectar:', error.message);
```

### Na Página (content.js):

```javascript
// Ver problemas encontrados
console.log('Problemas encontrados:', issues);

// Ver estrutura da página
console.log('Título:', document.title);
console.log('Idioma:', document.documentElement.lang);

// Ver imagens analisadas
console.log('Total de imagens:', images.length);
```

### No Popup (popup.js):

```javascript
// Ver etapas de otimização
console.log('Etapas:', steps);

// Ver resultado da análise
console.log('Resultado:', result);

// Ver erro
console.error('Erro na análise:', error);
```

## 11. Checklist de Debug

Quando tiver um problema, siga este checklist:

- [ ] Abra o console do Service Worker (chrome://extensions/ → Inspecionar)
- [ ] Procure por mensagens de erro em vermelho
- [ ] Abra o DevTools da página (F12)
- [ ] Vá para a aba "Network"
- [ ] Repita a ação que causa o erro
- [ ] Procure por requisições para openrouter.io
- [ ] Clique na requisição e veja a resposta
- [ ] Verifique o status HTTP (200, 401, 429, 500, etc.)
- [ ] Leia a mensagem de erro na resposta
- [ ] Procure pela solução acima

## 12. Exportar Logs para Análise

Se você quiser compartilhar os logs comigo para debug:

### Passo a Passo:

1. **Abra o console (F12)**
2. **Clique com botão direito no console**
3. **Selecione "Save as..."**
4. **Salve como arquivo .txt**
5. **Compartilhe comigo**

Ou copie e cole o texto do console em uma mensagem.

## 13. Resetar Configurações

Se tudo estiver errado, você pode resetar:

### Passo a Passo:

1. **Abra chrome://extensions/**
2. **Clique em "Detalhes" do plugin**
3. **Vá para "Storage"**
4. **Clique em "Clear site data"**
5. **Recarregue o plugin**
6. **Configure novamente**

## 14. Recursos Úteis

- **OpenRouter Status:** https://openrouter.io/status
- **OpenRouter Docs:** https://openrouter.io/docs
- **Chrome DevTools:** https://developer.chrome.com/docs/devtools/
- **Chrome Extensions API:** https://developer.chrome.com/docs/extensions/

## 15. Próximas Etapas

Se você ainda tiver problemas após seguir este guia:

1. **Anote exatamente qual é o erro**
2. **Abra o console e copie a mensagem de erro**
3. **Verifique a resposta da API no Network**
4. **Compartilhe comigo:**
   - O erro exato
   - A resposta da API
   - Qual ação você estava fazendo quando o erro ocorreu

---

**Dica:** Os logs do console são seus melhores amigos para debug! Sempre comece lá.

**Última Atualização:** Março 2026
