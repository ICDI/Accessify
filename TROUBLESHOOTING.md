# 🔧 Troubleshooting - Solução Rápida de Problemas

## Problema: Erro ao Testar Conexão

### Sintomas:
- Mensagem: "✗ Erro ao conectar: ..."
- Botão fica travado
- Nenhuma resposta da API

### Soluções Rápidas:

**1. Verifique sua chave de API**
```
- Acesse https://openrouter.io
- Faça login na sua conta
- Vá para "Keys" (Chaves)
- Copie sua chave de API
- Cole no plugin (deve começar com "sk-or-")
```

**2. Verifique se tem créditos**
```
- Acesse https://openrouter.io/account/credits
- Veja seu saldo de créditos
- Se estiver zerado, adicione créditos
```

**3. Verifique a conexão com internet**
```
- Abra https://openrouter.io no navegador
- Se carregar, sua internet está OK
- Se não carregar, verifique sua conexão
```

**4. Tente outro modelo**
```
- Vá para Configurações
- Selecione outro modelo
- Tente novamente
```

**5. Recarregue o plugin**
```
- Abra chrome://extensions/
- Clique no ícone de reload do plugin
- Tente novamente
```

---

## Problema: Erro ao Analisar Página

### Sintomas:
- Análise começa mas não termina
- Mensagem de erro aparece
- Etapas não avançam

### Soluções Rápidas:

**1. Verifique se a API está configurada**
```
- Clique no ícone ♿
- Clique em "⚙️ Configurações"
- Verifique se tem uma chave de API
- Se não, insira uma
```

**2. Teste a conexão primeiro**
```
- Vá para Configurações
- Clique em "🧪 Testar Conexão"
- Aguarde a resposta
- Se der erro, veja a solução acima
```

**3. Tente em uma página mais simples**
```
- Abra uma página simples (como google.com)
- Tente analisar
- Se funcionar, o problema é com a página anterior
```

**4. Aguarde um pouco**
```
- Análise pode demorar 5-10 segundos
- Não feche o popup enquanto está analisando
- Aguarde até aparecer a mensagem de sucesso
```

**5. Verifique o console**
```
- Pressione F12
- Vá para Console
- Procure por mensagens de erro em vermelho
- Veja a seção "Como Debugar" no DEBUG.md
```

---

## Problema: Plugin Não Aparece na Barra de Ferramentas

### Sintomas:
- Ícone ♿ não aparece
- Plugin não funciona
- Não consegue clicar

### Soluções Rápidas:

**1. Verifique se está instalado**
```
- Abra chrome://extensions/
- Procure por "WCAG Accessibility Transformer"
- Se não estiver lá, instale novamente
```

**2. Verifique se está ativado**
```
- Abra chrome://extensions/
- Procure pelo plugin
- Verifique se o toggle está ligado (azul)
- Se estiver desligado, clique para ligar
```

**3. Procure o ícone**
```
- Abra chrome://extensions/
- Clique em "Detalhes" do plugin
- Procure por "Ícone de ação"
- Se não estiver fixado, clique no ícone de pin
```

**4. Recarregue o plugin**
```
- Abra chrome://extensions/
- Clique no ícone de reload do plugin
- Aguarde recarregar
- Verifique se o ícone aparece
```

---

## Problema: Configurações Não Salvam

### Sintomas:
- Insere a chave de API mas não salva
- Ao reabrir, as configurações sumiram
- Mensagem de erro ao salvar

### Soluções Rápidas:

**1. Clique em "Salvar Configurações"**
```
- Insira sua chave de API
- Selecione um modelo
- Clique em "💾 Salvar Configurações"
- Aguarde a mensagem de sucesso
```

**2. Verifique o armazenamento do navegador**
```
- Abra chrome://extensions/
- Clique em "Detalhes" do plugin
- Vá para "Storage"
- Verifique se tem espaço disponível
```

**3. Limpe o armazenamento**
```
- Abra chrome://extensions/
- Clique em "Detalhes" do plugin
- Vá para "Storage"
- Clique em "Clear site data"
- Configure novamente
```

**4. Tente em modo incógnito**
```
- Abra uma aba incógnita (Ctrl+Shift+N)
- Clique no ícone ♿
- Vá para Configurações
- Insira a chave de API
- Verifique se salva
```

---

## Problema: Página Fica Lenta Após Análise

### Sintomas:
- Página fica lenta ou travada
- Muitos recursos sendo usados
- Navegação fica difícil

### Soluções Rápidas:

**1. Recarregue a página**
```
- Pressione F5 ou Ctrl+R
- A página volta ao normal
- Tente novamente com menos imagens
```

**2. Feche o popup**
```
- Clique fora do popup para fechá-lo
- Isso libera recursos
- Página deve voltar ao normal
```

**3. Tente em uma página mais simples**
```
- Páginas com muitas imagens são mais lentas
- Tente em uma página com menos conteúdo
- Verifique se o problema persiste
```

**4. Reinicie o navegador**
```
- Feche o Chrome completamente
- Abra novamente
- Tente novamente
```

---

## Problema: Imagens Não Recebem Alt Text

### Sintomas:
- Análise encontra imagens sem alt
- Mas alt text não é gerado
- Ou gera mas não aplica

### Soluções Rápidas:

**1. Verifique se a API está funcionando**
```
- Vá para Configurações
- Clique em "🧪 Testar Conexão"
- Se der erro, corrija primeiro
```

**2. Verifique se tem créditos**
```
- Acesse https://openrouter.io/account/credits
- Veja seu saldo
- Se estiver baixo, adicione créditos
```

**3. Aguarde mais tempo**
```
- Gerar alt text para muitas imagens demora
- Cada imagem leva 1-2 segundos
- Aguarde até terminar
```

**4. Tente com menos imagens**
```
- Páginas com muitas imagens são mais lentas
- Tente em uma página com 2-3 imagens
- Verifique se funciona
```

---

## Problema: Popup Não Abre

### Sintomas:
- Clica no ícone mas nada acontece
- Popup não aparece
- Nenhuma reação

### Soluções Rápidas:

**1. Verifique se o plugin está ativado**
```
- Abra chrome://extensions/
- Procure pelo plugin
- Verifique se o toggle está ligado
```

**2. Recarregue o plugin**
```
- Abra chrome://extensions/
- Clique no ícone de reload
- Aguarde recarregar
- Tente novamente
```

**3. Reinicie o navegador**
```
- Feche o Chrome completamente
- Abra novamente
- Tente novamente
```

**4. Desinstale e reinstale**
```
- Abra chrome://extensions/
- Clique em "Remover" do plugin
- Carregue novamente a extensão
- Configure tudo de novo
```

---

## Problema: Erro "Unexpected end of JSON input"

### Sintomas:
- Mensagem: "Unexpected end of JSON input"
- Ao testar conexão ou analisar
- Resposta vazia da API

### Soluções Rápidas:

**1. Verifique sua chave de API**
```
- Acesse https://openrouter.io
- Verifique se sua chave está correta
- Se dúvida, gere uma nova chave
```

**2. Verifique o modelo selecionado**
```
- Vá para Configurações
- Verifique qual modelo está selecionado
- Tente outro modelo
```

**3. Aguarde e tente novamente**
```
- Pode ser um problema temporário da API
- Aguarde 1-2 minutos
- Tente novamente
```

**4. Verifique a resposta da API**
```
- Abra DevTools (F12)
- Vá para Network
- Clique em "Testar Conexão"
- Procure por requisição para openrouter.io
- Clique e veja a resposta
- Se vir HTML ou erro, compartilhe comigo
```

---

## Problema: Erro "401 Unauthorized"

### Sintomas:
- Mensagem: "401 Unauthorized"
- Sua chave de API não é aceita
- Erro ao conectar

### Soluções Rápidas:

**1. Verifique se copiou a chave corretamente**
```
- Acesse https://openrouter.io
- Vá para "Keys"
- Copie a chave inteira (com "sk-or-")
- Cole no plugin
- Não adicione espaços extras
```

**2. Gere uma nova chave**
```
- Acesse https://openrouter.io
- Vá para "Keys"
- Clique em "Create new key"
- Copie a nova chave
- Cole no plugin
```

**3. Verifique se sua conta está ativa**
```
- Acesse https://openrouter.io
- Faça login
- Se não conseguir fazer login, recupere sua senha
- Tente novamente
```

---

## Problema: Erro "429 Too Many Requests"

### Sintomas:
- Mensagem: "429 Too Many Requests"
- Muitas requisições muito rápido
- Precisa aguardar

### Soluções Rápidas:

**1. Aguarde alguns minutos**
```
- Pare de usar o plugin
- Aguarde 5-10 minutos
- Tente novamente
```

**2. Não clique múltiplas vezes**
```
- Clique em "Analisar" uma vez
- Aguarde a resposta
- Não clique novamente enquanto está processando
```

**3. Processe menos imagens**
```
- Páginas com muitas imagens geram muitas requisições
- Tente em uma página com menos imagens
- Ou processe em lotes menores
```

---

## Problema: Página Não Muda Após Otimização

### Sintomas:
- Clica em "Aplicar Otimizações"
- Mas a página não muda
- Nenhuma alteração visível

### Soluções Rápidas:

**1. Aguarde a conclusão**
```
- Otimizações podem demorar alguns segundos
- Não feche o popup enquanto está processando
- Aguarde até terminar
```

**2. Verifique o overlay**
```
- Um overlay pode estar cobrindo a página
- Procure por uma camada cinza ou semi-transparente
- Clique para fechar ou remover
```

**3. Recarregue a página**
```
- Pressione F5
- A página volta ao normal
- Tente novamente
```

**4. Verifique o console**
```
- Pressione F12
- Vá para Console
- Procure por erros em vermelho
- Veja a seção "Como Debugar"
```

---

## Checklist Rápido

Se tiver qualquer problema, siga este checklist:

- [ ] Verifique se o plugin está instalado
- [ ] Verifique se o plugin está ativado
- [ ] Verifique se tem uma chave de API válida
- [ ] Teste a conexão com a API
- [ ] Verifique se tem créditos na conta OpenRouter
- [ ] Abra o console (F12) e procure por erros
- [ ] Tente em uma página mais simples
- [ ] Recarregue o plugin
- [ ] Limpe o armazenamento do navegador
- [ ] Reinicie o navegador

Se nenhuma solução funcionar, compartilhe:
1. O erro exato que aparece
2. Uma screenshot do erro
3. Os logs do console (F12 → Console)
4. A resposta da API (F12 → Network)

---

**Última Atualização:** Março 2026
**Versão:** 1.0.0
