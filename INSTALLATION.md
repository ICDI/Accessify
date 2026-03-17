# 📦 Guia de Instalação - WCAG Accessibility Transformer

## Pré-requisitos

- ✅ Google Chrome versão 88 ou superior
- ✅ Chave de API do OpenRouter (gratuita)
- ✅ Conexão com a internet

## Passo 1: Obter Chave de API OpenRouter

### 1.1 Criar Conta
1. Acesse [https://openrouter.ai](https://openrouter.ai)
2. Clique em "Sign Up" (Registrar)
3. Crie uma conta usando email ou conta Google
4. Verifique seu email

### 1.2 Gerar Chave de API
1. Faça login em https://openrouter.ai
2. Clique no seu avatar/perfil no canto superior direito
3. Selecione "Keys" (Chaves)
4. Clique em "Create Key" (Criar Chave)
5. Dê um nome à chave (ex: "WCAG Plugin")
6. Copie a chave gerada (começará com `sk-or-`)
7. **Guarde esta chave em um local seguro**

## Passo 2: Instalar o Plugin

### 2.1 Baixar o Plugin
- Opção A: Clonar do GitHub
  ```bash
  git clone https://github.com/seu-usuario/wcag-accessibility-plugin.git
  cd wcag-accessibility-plugin
  ```

- Opção B: Baixar como ZIP
  1. Acesse o repositório GitHub
  2. Clique em "Code" → "Download ZIP"
  3. Extraia o arquivo em uma pasta

### 2.2 Carregar no Chrome

1. **Abra o Chrome** e digite na barra de endereço:
   ```
   chrome://extensions/
   ```

2. **Ative o Modo de Desenvolvedor**
   - Procure pelo toggle "Developer mode" no canto superior direito
   - Clique para ativar (ficará azul)

3. **Carregue a extensão**
   - Clique em "Load unpacked" (Carregar extensão não empacotada)
   - Navegue até a pasta do plugin
   - Selecione a pasta `wcag-accessibility-plugin`
   - Clique em "Select Folder" (Selecionar Pasta)

4. **Verifique a instalação**
   - O plugin deve aparecer na lista de extensões
   - Você verá um ícone ♿ na barra de ferramentas do Chrome

## Passo 3: Configurar o Plugin

### 3.1 Abrir Configurações
1. Clique no ícone ♿ na barra de ferramentas
2. Clique em "⚙️ Configurações" (no popup)
3. Ou clique com botão direito no ícone → "Opções"

### 3.2 Inserir Chave de API
1. Cole sua chave de API do OpenRouter no campo "Chave de API OpenRouter"
2. Escolha um modelo de IA (recomendado: "Auto")
3. Clique em "🧪 Testar Conexão" para validar
4. Clique em "💾 Salvar Configurações"

### 3.3 Configurações Opcionais
- ☑️ **Otimizar automaticamente todas as páginas** - Analisa cada página visitada
- ☑️ **Mostrar notificações** - Notifica quando análise é concluída

## Passo 4: Usar o Plugin

### Primeira Análise
1. Navegue até qualquer página web
2. Clique no ícone ♿ na barra de ferramentas
3. Clique em "🔍 Analisar Acessibilidade"
4. Aguarde a análise ser concluída (pode levar alguns segundos)
5. Revise os problemas encontrados
6. Clique em "✨ Aplicar Otimizações" para fazer as mudanças

### Resultado
- Uma nova aba será aberta mostrando as etapas de otimização
- A página será modificada para melhorar a acessibilidade
- Todas as mudanças serão reversíveis (recarregue a página para desfazer)

## 🎯 Casos de Uso

### Exemplo 1: Analisar Blog Pessoal
```
1. Abra seu blog
2. Clique no ícone do plugin
3. Clique em "Analisar Acessibilidade"
4. Revise os problemas
5. Aplique as otimizações
6. Teste com leitores de tela
```

### Exemplo 2: Otimizar Site Corporativo
```
1. Navegue até a página principal
2. Ative "Otimização Automática" nas configurações
3. Visite cada página importante
4. Revise as recomendações
5. Implemente as mudanças no código-fonte
```

### Exemplo 3: Testar Conformidade WCAG
```
1. Abra a página a ser testada
2. Clique em "Analisar Acessibilidade"
3. Verifique o resumo de problemas
4. Compare com relatórios de ferramentas profissionais
5. Documente os achados
```

## 🔧 Solução de Problemas

### Problema: "API não configurada"
**Solução:**
1. Verifique se você inseriu a chave de API
2. Certifique-se de que a chave começa com `sk-or-`
3. Teste a conexão usando o botão "Testar Conexão"
4. Verifique se sua conta OpenRouter tem créditos

### Problema: "Erro ao analisar página"
**Solução:**
1. Recarregue a página (F5)
2. Tente em uma página diferente
3. Verifique se o JavaScript está ativado
4. Limpe o cache do navegador
5. Desative outras extensões que possam conflitar

### Problema: "Mudanças não aparecem"
**Solução:**
1. Verifique se o plugin está habilitado em `chrome://extensions/`
2. Recarregue a página
3. Tente em uma aba privada (Ctrl+Shift+N)
4. Verifique o console do navegador (F12) para erros

### Problema: "Chave de API rejeitada"
**Solução:**
1. Verifique se a chave está correta (copie novamente)
2. Acesse https://openrouter.ai e verifique se a chave está ativa
3. Certifique-se de que tem créditos na conta
4. Gere uma nova chave se necessário

### Problema: "Plugin não aparece na barra de ferramentas"
**Solução:**
1. Verifique em `chrome://extensions/` se está habilitado
2. Clique no ícone de extensões (quebra-cabeça) na barra
3. Clique no ícone do plugin para "fixá-lo" na barra
4. Recarregue o Chrome completamente

## 📊 Monitoramento de Uso

### Verificar Uso de API
1. Acesse https://openrouter.ai
2. Faça login
3. Vá para "Usage" (Uso) ou "Billing" (Faturamento)
4. Veja o histórico de requisições

### Limitar Gastos
1. Nas configurações do plugin, escolha um modelo mais econômico
2. Use "Auto" para deixar o OpenRouter otimizar
3. Monitore regularmente seu uso de API
4. Configure limites de gastos na sua conta OpenRouter

## 🚀 Próximas Etapas

### Após Instalar
1. ✅ Teste em 2-3 páginas diferentes
2. ✅ Revise as recomendações geradas
3. ✅ Aplique as otimizações
4. ✅ Teste com um leitor de tela (NVDA, JAWS, VoiceOver)

### Integração em Produção
1. 📋 Exporte as recomendações
2. 🔧 Implemente manualmente no código-fonte
3. 🧪 Teste com usuários reais
4. ♿ Valide com ferramentas profissionais (WAVE, Axe)

## 📚 Recursos Adicionais

### Documentação
- [README.md](README.md) - Visão geral do plugin
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/standards-guidelines/wcag/)

### Ferramentas de Teste
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Axe DevTools](https://www.deque.com/axe/devtools/)
- [Lighthouse (Chrome DevTools)](https://developers.google.com/web/tools/lighthouse)

### Leitores de Tela
- [NVDA (Gratuito)](https://www.nvaccess.org/)
- [JAWS (Pago)](https://www.freedomscientific.com/products/software/jaws/)
- [VoiceOver (macOS/iOS)](https://www.apple.com/accessibility/voiceover/)

## ❓ Perguntas Frequentes

**P: O plugin modifica meu site permanentemente?**
R: Não. As mudanças são aplicadas apenas na sua sessão do navegador. Para aplicar permanentemente, você precisa implementar as mudanças no código-fonte.

**P: Quanto custa usar o plugin?**
R: O plugin é gratuito. Você paga apenas pelas requisições à API do OpenRouter (geralmente muito barato).

**P: Meus dados são enviados para servidores?**
R: Sua chave de API é armazenada localmente. Apenas o conteúdo necessário é enviado ao OpenRouter para análise.

**P: Posso usar em múltiplos navegadores?**
R: Atualmente apenas Chrome. Versões para Firefox e Edge estão planejadas.

**P: Como desinstalar o plugin?**
R: Acesse `chrome://extensions/`, encontre o plugin e clique em "Remove" (Remover).

---

**Precisa de ajuda?** Abra uma issue no repositório GitHub ou entre em contato com o suporte.
