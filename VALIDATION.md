# ✅ Checklist de Validação - WCAG Accessibility Transformer

## Pré-Instalação

- [ ] Todos os arquivos estão presentes
- [ ] manifest.json é válido
- [ ] Nenhum arquivo contém erros de sintaxe
- [ ] Ícones estão no diretório `/icons`

## Instalação

- [ ] Plugin carrega em `chrome://extensions/`
- [ ] Ícone aparece na barra de ferramentas
- [ ] Popup abre ao clicar no ícone
- [ ] Página de opções abre corretamente

## Funcionalidade Básica

### Análise WCAG
- [ ] Botão "Analisar Acessibilidade" funciona
- [ ] Análise identifica problemas em página de teste
- [ ] Barra de progresso aparece durante análise
- [ ] Etapas são exibidas corretamente
- [ ] Resumo de problemas é mostrado

### Problemas Detectados
- [ ] Detecta imagens sem alt text
- [ ] Detecta estrutura de títulos ruim
- [ ] Detecta formulários sem labels
- [ ] Detecta links com texto genérico
- [ ] Detecta contraste baixo
- [ ] Detecta falta de idioma declarado
- [ ] Detecta falta de título da página

## Configuração da API

### Página de Opções
- [ ] Campo de API key aceita entrada
- [ ] Seletor de modelo funciona
- [ ] Botão "Testar Conexão" funciona
- [ ] Mensagens de status aparecem
- [ ] Configurações são salvas
- [ ] Configurações persistem após reload

### Validação de API
- [ ] Aceita chave válida do OpenRouter
- [ ] Rejeita chave inválida
- [ ] Mostra erro apropriado
- [ ] Teste de conexão valida corretamente

## Geração de Alt Text

- [ ] Gera alt text para imagens
- [ ] Alt text é descritivo
- [ ] Alt text tem comprimento apropriado
- [ ] Múltiplas imagens são processadas
- [ ] Delay entre requisições funciona

## Aplicação de Otimizações

- [ ] Overlay é criado corretamente
- [ ] Etapas são atualizadas
- [ ] Alt text é aplicado
- [ ] ARIA labels são adicionados
- [ ] Estilos CSS são aplicados
- [ ] Página permanece funcional
- [ ] Conteúdo original é preservado

## Interface do Usuário

### Popup
- [ ] Layout é responsivo
- [ ] Cores têm contraste adequado
- [ ] Texto é legível
- [ ] Botões são clicáveis
- [ ] Ícones aparecem corretamente
- [ ] Status é exibido claramente

### Página de Opções
- [ ] Layout é organizado
- [ ] Campos são acessíveis
- [ ] Informações de ajuda são claras
- [ ] Links funcionam
- [ ] Formulário é validado

## Acessibilidade do Plugin

- [ ] Plugin é acessível por teclado
- [ ] Indicadores de foco são visíveis
- [ ] Contraste atende WCAG AA
- [ ] ARIA labels são apropriados
- [ ] Estrutura semântica é correta
- [ ] Funciona com leitores de tela

## Testes em Página de Exemplo

### test-page.html
- [ ] Identifica falta de H1
- [ ] Identifica salto de nível de título (H3 → H5)
- [ ] Identifica imagens sem alt
- [ ] Identifica alt text curto
- [ ] Identifica links genéricos
- [ ] Identifica formulário sem labels
- [ ] Identifica contraste baixo
- [ ] Identifica tabela sem headers
- [ ] Identifica div com onclick
- [ ] Identifica falta de foco visual

## Testes com Ferramentas Externas

### WAVE (WebAIM)
- [ ] Instalar extensão WAVE
- [ ] Analisar página antes de otimização
- [ ] Aplicar otimizações do plugin
- [ ] Analisar página após otimização
- [ ] Verificar redução de erros

### Axe DevTools
- [ ] Instalar extensão Axe
- [ ] Executar scan antes de otimização
- [ ] Aplicar otimizações do plugin
- [ ] Executar scan após otimização
- [ ] Comparar resultados

### Lighthouse
- [ ] Abrir DevTools (F12)
- [ ] Ir para aba Lighthouse
- [ ] Executar auditoria de acessibilidade
- [ ] Verificar pontuação antes
- [ ] Aplicar otimizações
- [ ] Verificar pontuação depois

## Testes com Leitores de Tela

### NVDA (Windows/Linux)
- [ ] Baixar e instalar NVDA
- [ ] Ativar NVDA
- [ ] Navegar com Tab
- [ ] Verificar anúncios
- [ ] Testar com página otimizada
- [ ] Verificar melhorias

### JAWS (Windows)
- [ ] Abrir JAWS
- [ ] Navegar página
- [ ] Verificar leitura de alt text
- [ ] Testar com página otimizada
- [ ] Comparar experiência

### VoiceOver (macOS/iOS)
- [ ] Ativar VoiceOver (Cmd+F5)
- [ ] Navegar com VO+Seta
- [ ] Verificar descrições
- [ ] Testar otimizações
- [ ] Validar melhorias

## Testes de Compatibilidade

### Navegadores
- [ ] Chrome (versão 88+)
- [ ] Chrome Beta
- [ ] Chromium
- [ ] Edge (baseado em Chromium)

### Sistemas Operacionais
- [ ] Windows 10/11
- [ ] macOS
- [ ] Linux

### Tamanhos de Tela
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (não suportado, mas testar)

## Testes de Performance

- [ ] Análise completa < 5 segundos
- [ ] Geração de alt text < 3 segundos por imagem
- [ ] Aplicação de otimizações < 2 segundos
- [ ] Sem travamento da página
- [ ] Sem consumo excessivo de memória

## Testes de Segurança

- [ ] API key não é exposta no console
- [ ] API key não é enviada para servidores não autorizados
- [ ] Conteúdo da página não é vazado
- [ ] Sem vulnerabilidades XSS
- [ ] Sem vulnerabilidades CSRF
- [ ] Sem injeção de código malicioso

## Testes de Casos Extremos

### Páginas Problemáticas
- [ ] Página sem HTML semântico
- [ ] Página com muito JavaScript
- [ ] Página com iframes
- [ ] Página com shadow DOM
- [ ] Página com conteúdo dinâmico

### Conteúdo Extremo
- [ ] Página com muitas imagens (100+)
- [ ] Página com muito texto
- [ ] Página com tabelas complexas
- [ ] Página com formulários longos
- [ ] Página com estrutura aninhada profunda

## Testes de Erro

- [ ] Sem API key configurada
- [ ] API key inválida
- [ ] Sem conexão com internet
- [ ] Timeout da API
- [ ] Resposta inválida da API
- [ ] Página não carrega completamente
- [ ] JavaScript desativado

## Documentação

- [ ] README.md está completo
- [ ] INSTALLATION.md tem instruções claras
- [ ] TECHNICAL.md documenta arquitetura
- [ ] Código tem comentários
- [ ] Exemplos funcionam

## Antes do Lançamento

- [ ] Todos os testes passaram
- [ ] Nenhum erro no console
- [ ] Performance é aceitável
- [ ] Documentação está atualizada
- [ ] Versão foi incrementada
- [ ] Changelog foi atualizado
- [ ] Licença está incluída
- [ ] Créditos estão documentados

## Checklist Final

- [ ] Plugin funciona conforme esperado
- [ ] Nenhum problema crítico
- [ ] Documentação está completa
- [ ] Código está limpo
- [ ] Testes passaram
- [ ] Pronto para lançamento

---

## Notas de Teste

### Problemas Encontrados
```
Data: ___________
Problema: _______________________________
Severidade: [ ] Crítico [ ] Alto [ ] Médio [ ] Baixo
Solução: _________________________________
```

### Melhorias Sugeridas
```
Data: ___________
Sugestão: _______________________________
Prioridade: [ ] Alta [ ] Média [ ] Baixa
Implementação: __________________________
```

---

**Data de Validação:** ___________
**Validado por:** ___________
**Status:** [ ] Aprovado [ ] Reprovado [ ] Pendente
