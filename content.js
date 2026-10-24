/**
 * Content Script - Executado no contexto da página.
 * WCAGEvaluator é carregado por wcag-evaluator.js (declarado antes no manifest).
 */

class AccessibilityAnalyzer {
  constructor() {
    this.evaluator = null;
    this.issues = [];
    this.optimizationSteps = [];
    this.currentStep = 0;
  }

  async analyzePageForAccessibility() {
    try {
      await this.waitForStablePage();

      const evaluator = new WCAGEvaluator();
      this.evaluator = evaluator;

      const rawIssues = evaluator.evaluate();
      const issues = rawIssues.map((issue) => this.serializeIssue(issue));
      const summary = this.buildSummary(issues);

      this.issues = issues;

      console.log('WCAG Analysis Complete:', summary);

      return {
        success: true,
        summary,
        issues,
        pageContent: this.extractPageContent()
      };
    } catch (error) {
      console.error('Erro ao analisar página:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Espera fontes web terminarem de carregar e mais um frame de renderização antes de
   * analisar. Reduz (não elimina) variação entre execuções causada por FOUT/reflow em
   * andamento no momento exato do clique - sites com fontes customizadas, carrosséis ou
   * scripts de terceiros ainda podem mudar o DOM entre uma análise e outra; isso é
   * inerente a conteúdo dinâmico "ao vivo", não algo que o content script controla.
   */
  async waitForStablePage() {
    try {
      if (document.fonts && document.fonts.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 1500))
        ]);
      }
    } catch (error) {
      // Ignora falhas da Font Loading API e segue com a análise mesmo assim
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  extractPageContent() {
    return {
      title: document.title,
      url: window.location.href,
      html: document.documentElement.outerHTML.substring(0, 1500),
      language: document.documentElement.getAttribute('lang') || 'pt-BR'
    };
  }

  serializeIssue(issue) {
    const serializedIssue = { ...issue };
    const element = issue.element;

    delete serializedIssue.element;

    if (element instanceof Element) {
      serializedIssue.selector = this.getElementSelector(element);
      serializedIssue.tagName = element.tagName.toLowerCase();
      serializedIssue.id = element.getAttribute('id');
      serializedIssue.name = element.getAttribute('name');
      serializedIssue.placeholder = element.getAttribute('placeholder');
      serializedIssue.title_attribute = element.getAttribute('title');
      serializedIssue.input_type = element.tagName.toLowerCase() === 'input' ? element.getAttribute('type') || 'text' : null;
      serializedIssue.text_content = element.textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
      serializedIssue.ariaLabelledBy = element.getAttribute('aria-labelledby');
      serializedIssue.ariaDescribedBy = element.getAttribute('aria-describedby');
      serializedIssue.role = element.getAttribute('role');
      serializedIssue.href = element.tagName.toLowerCase() === 'a' ? element.getAttribute('href') : null;
    }

    return serializedIssue;
  }

  buildSummary(issues) {
    const critical = issues.filter((issue) => issue.severity === 'critical').length;
    const warnings = issues.filter((issue) => issue.severity === 'warning').length;
    const requiresLLM = issues.filter((issue) => issue.requires_llm).length;

    return {
      total: issues.length,
      critical,
      warnings,
      requiresLLM,
      issues
    };
  }

  getElementSelector(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    const path = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.localName;

      if (current.id) {
        selector = `#${this.escapeSelector(current.id)}`;
        path.unshift(selector);
        break;
      }

      const parent = current.parentElement;
      if (parent) {
        const sameTypeSiblings = Array.from(parent.children).filter(
          (child) => child.localName === current.localName
        );

        if (sameTypeSiblings.length > 1) {
          const index = sameTypeSiblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  escapeSelector(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }

    return value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  normalizeMalformedIdToken(token) {
    if (typeof token !== 'string' || token.trim().length === 0) {
      return '';
    }

    return this.escapeSelector(token.replace(/\\/g, ''));
  }

  resolveMalformedIdSelector(selector) {
    if (typeof selector !== 'string') {
      return null;
    }

    const trimmedSelector = selector.trim();
    if (!trimmedSelector.startsWith('#')) {
      return null;
    }

    const match = trimmedSelector.match(/^#([^\s>+~]+)(.*)$/);
    if (!match) {
      return null;
    }

    const elementId = match[1].replace(/\\/g, '');
    const baseElement = document.getElementById(elementId);
    if (!baseElement) {
      return null;
    }

    const remainder = match[2]?.trim();
    if (!remainder) {
      return baseElement;
    }

    const nestedSelector = /^[>+~]/.test(remainder)
      ? `:scope ${remainder}`
      : remainder;

    try {
      return baseElement.querySelector(nestedSelector);
    } catch (error) {
      return null;
    }
  }

  resolveSelector(selector) {
    if (typeof selector !== 'string' || selector.trim().length === 0) {
      return null;
    }

    try {
      return document.querySelector(selector);
    } catch (error) {
      const normalizedIdSelector = selector.replace(
        /^#([^\s>+~]+)(.*)$/,
        (_, idToken, rest) => `#${this.normalizeMalformedIdToken(idToken)}${rest}`
      );

      try {
        return document.querySelector(normalizedIdSelector);
      } catch (retryError) {
        const fallbackElement = this.resolveMalformedIdSelector(selector);
        if (fallbackElement) {
          return fallbackElement;
        }

        console.warn('Seletor inválido ignorado durante aplicação de otimizações:', selector, retryError);
        return null;
      }
    }
  }

  extractImages(options = {}) {
    const images = [];
    const evaluator = this.evaluator || new WCAGEvaluator();
    const maxImages = Number.isInteger(options.maxImages) ? options.maxImages : Number.POSITIVE_INFINITY;
    const includeDataUrl = options.includeDataUrl === true;

    document.querySelectorAll('img').forEach((img, index) => {
      if (images.length >= maxImages) {
        return;
      }

      if (
        evaluator.isSpacerImage(img)
        || evaluator.isEmojiImage(img)
        || evaluator.isDecorativeIconImage(img)
        || evaluator.isMarkedDecorative(img)
        || img.hasAttribute('alt')
      ) {
        return;
      }

      images.push({
        index,
        src: img.src,
        currentAlt: img.getAttribute('alt') || '',
        fileName: evaluator.getImageFileName(img.currentSrc || img.src),
        title: (img.getAttribute('title') || '').trim(),
        figcaption: this.getFigcaptionText(img),
        adjacentText: this.getImageAdjacentText(img, evaluator),
        parentAriaLabel: this.getParentAccessibleName(img),
        width: img.naturalWidth || img.width || null,
        height: img.naturalHeight || img.height || null,
        dataUrl: includeDataUrl ? this.tryGetImageDataUrl(img) : null
      });
    });

    return images;
  }

  getFigcaptionText(img) {
    const figure = img.closest('figure');
    const caption = figure?.querySelector('figcaption');
    return caption ? caption.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  }

  getImageAdjacentText(img, evaluator) {
    const candidates = evaluator.getAdjacentTextCandidates(img) || [];
    return candidates.find((text) => typeof text === 'string' && text.trim().length > 0)?.trim().slice(0, 200) || '';
  }

  getParentAccessibleName(img) {
    const parent = img.closest('a, button, [aria-label], [role="img"]');
    if (!parent) {
      return '';
    }

    const ariaLabel = parent.getAttribute('aria-label');
    if (typeof ariaLabel === 'string' && ariaLabel.trim()) {
      return ariaLabel.trim();
    }

    return parent.textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  tryGetImageDataUrl(img) {
    try {
      if (!img.complete || img.naturalWidth === 0) {
        return null;
      }

      const maxSize = 768;
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch (error) {
      return null;
    }
  }

  applyAiProvidedOptimizations(optimizations) {
    let appliedCount = 0;

    if (optimizations.imageAlts) {
      optimizations.imageAlts.forEach(({ index, alt }) => {
        const images = document.querySelectorAll('img');
        if (images[index] && typeof alt === 'string') {
          images[index].setAttribute('alt', alt);
          images[index].setAttribute('role', 'img');
          appliedCount++;
        }
      });
    }

    if (optimizations.structureChanges) {
      optimizations.structureChanges.forEach((change) => {
        const element = this.resolveSelector(change.selector);
        if (!element) {
          return;
        }

        if (change.newTag) {
          this.replaceElementTag(element, change.newTag, change.attributes || {});
          appliedCount++;
        } else if (change.attributes) {
          Object.keys(change.attributes).forEach((key) => {
            const value = change.attributes[key];
            if (value === null || value === undefined) {
              element.removeAttribute(key);
            } else {
              element.setAttribute(key, value);
            }
          });
          appliedCount++;
        }
      });
    }

    if (optimizations.textChanges) {
      optimizations.textChanges.forEach(({ selector, text }) => {
        const element = this.resolveSelector(selector);
        if (element && typeof text === 'string' && text.trim().length > 0) {
          element.textContent = text;
          appliedCount++;
        }
      });
    }

    if (optimizations.styles) {
      const existingStyles = document.querySelectorAll('style[data-accessibility="true"]:not(#accessify-deterministic-styles)');
      existingStyles.forEach((style) => style.remove());

      const style = document.createElement('style');
      style.textContent = optimizations.styles;
      style.setAttribute('data-accessibility', 'true');
      document.head.appendChild(style);
      appliedCount++;
    }

    if (optimizations.ariaLabels) {
      optimizations.ariaLabels.forEach(({ selector, label, role }) => {
        const element = this.resolveSelector(selector);
        if (element) {
          element.setAttribute('aria-label', label);
          if (role) {
            element.setAttribute('role', role);
          }
          appliedCount++;
        }
      });
    }

    return appliedCount;
  }

  async applyOptimizations(optimizations) {
    try {
      let appliedCount = 0;
      let roundsRun = 0;
      let remainingIssues = null;

      // Uma única passada de applyDeterministicFixes() pode não bastar: revelar um
      // bloco com aria-hidden pode expor texto com contraste ruim, um heading
      // promovido a H1 muda o que outra regra vê como "primeiro heading", etc. Em vez
      // de medir convergência por "quantas alterações apliquei" (algumas correções,
      // como reaplicar o mesmo alt text, contam de novo mesmo sem mudar nada), rodamos
      // de novo e comparamos quantos problemas reais sobram a cada rodada - é o mesmo
      // sinal que uma reanálise manual usaria. Para no primeiro dos três casos: zerou,
      // parou de melhorar, ou atingiu o limite de rodadas.
      const maxRounds = 4;
      let previousIssueCount = Number.POSITIVE_INFINITY;

      for (let round = 0; round < maxRounds; round++) {
        roundsRun++;
        appliedCount += this.applyDeterministicFixes();

        if (round === 0) {
          appliedCount += this.applyAiProvidedOptimizations(optimizations);
        }

        const evaluator = new WCAGEvaluator();
        this.evaluator = evaluator;
        remainingIssues = evaluator.evaluate().length;

        if (remainingIssues === 0 || remainingIssues >= previousIssueCount) {
          break;
        }

        previousIssueCount = remainingIssues;
      }

      if (appliedCount === 0) {
        return {
          success: false,
          error: 'Nenhuma alteração aplicável foi encontrada para a página atual.'
        };
      }

      return { success: true, appliedCount, roundsRun, remainingIssues };
    } catch (error) {
      console.error('Erro ao aplicar otimizações:', error);
      return { success: false, error: error.message };
    }
  }

  replaceElementTag(element, newTag, attributes) {
    const newElement = document.createElement(newTag);
    Array.from(element.attributes).forEach((attr) => {
      newElement.setAttribute(attr.name, attr.value);
    });
    Object.keys(attributes).forEach((key) => {
      const value = attributes[key];
      if (value === null || value === undefined) {
        newElement.removeAttribute(key);
      } else {
        newElement.setAttribute(key, value);
      }
    });
    while (element.firstChild) {
      newElement.appendChild(element.firstChild);
    }
    element.replaceWith(newElement);
  }

  applyDeterministicFixes() {
    let appliedCount = 0;
    const evaluator = this.evaluator || new WCAGEvaluator();

    document.querySelectorAll('img').forEach((img) => {
      if (evaluator.isSpacerImage(img) && !img.hasAttribute('alt')) {
        img.setAttribute('alt', '');
        appliedCount++;
      }
    });

    if (!document.documentElement.getAttribute('lang')) {
      document.documentElement.setAttribute('lang', navigator.language || 'pt-BR');
      appliedCount++;
    }

    document.querySelectorAll('table').forEach((table) => {
      if (table.querySelector('th') || table.getAttribute('role') === 'presentation') {
        return;
      }

      const firstRow = table.querySelector('tr');
      if (!firstRow) {
        return;
      }

      Array.from(firstRow.children).forEach((cell) => {
        if (cell.tagName !== 'TD') {
          return;
        }

        this.replaceElementTag(cell, 'th', { scope: 'col' });
        appliedCount++;
      });
    });

    document.querySelectorAll('iframe').forEach((iframe) => {
      const title = iframe.getAttribute('title');
      const ariaLabel = iframe.getAttribute('aria-label');
      if ((title && title.trim()) || (ariaLabel && ariaLabel.trim())) {
        return;
      }

      let inferred = 'Conteúdo incorporado';
      try {
        const src = iframe.src || iframe.getAttribute('src') || '';
        if (src) {
          inferred = `Conteúdo de ${new URL(src, window.location.href).hostname}`;
        }
      } catch (error) {
        inferred = 'Conteúdo incorporado';
      }

      iframe.setAttribute('title', inferred);
      appliedCount++;
    });

    const hasSkipLink = Array.from(document.querySelectorAll('a[href^="#"]')).some((link) => (
      /pular|skip|ir para o conte[uú]do|jump to|main-content/i.test(`${link.textContent} ${link.getAttribute('href')}`)
    ));
    const hasMain = document.querySelector('main, [role="main"]');
    if (!hasSkipLink && !hasMain) {
      const target = document.querySelector('h1, h2, h3, [role="main"], .container, body > *:not(script):not(style)');
      if (target) {
        if (!target.id) {
          target.id = 'accessify-main-content';
        }
        this.ensureAccessifySrOnlyStyles();
        const skipLink = document.createElement('a');
        skipLink.href = `#${target.id}`;
        skipLink.textContent = 'Pular para o conteúdo principal';
        skipLink.setAttribute('data-accessify-skip', 'true');
        skipLink.className = 'accessify-sr-only accessify-skip-link';
        document.body.insertBefore(skipLink, document.body.firstChild);
        appliedCount++;
      }
    }

    document.querySelectorAll('[onclick]').forEach((element) => {
      const tag = element.tagName;
      if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'LABEL'].includes(tag)) {
        return;
      }

      if (!element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '0');
        appliedCount++;
      }
      if (!element.getAttribute('role')) {
        element.setAttribute('role', 'button');
        appliedCount++;
      }
      if (!element.dataset.accessifyKeyboard) {
        element.dataset.accessifyKeyboard = 'true';
        element.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            element.click();
          }
        });
        appliedCount++;
      }
    });

    document.querySelectorAll('svg').forEach((svg) => {
      if (svg.getAttribute('aria-hidden') === 'true' || svg.getAttribute('role') === 'presentation') {
        return;
      }

      const parentControl = svg.closest('a, button');
      if (parentControl && parentControl.textContent.replace(svg.textContent, '').trim()) {
        return;
      }

      if (svg.getAttribute('aria-label') || svg.querySelector('title')) {
        return;
      }

      const titleText = this.getParentAccessibleName(svg) || 'Gráfico';
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', titleText);
      appliedCount++;
    });

    const seenIds = new Map();
    document.querySelectorAll('[id]').forEach((element) => {
      const id = element.id;
      if (!id) {
        return;
      }

      if (seenIds.has(id)) {
        let suffix = 2;
        while (document.getElementById(`${id}-accessify-${suffix}`)) {
          suffix += 1;
        }
        element.id = `${id}-accessify-${suffix}`;
        appliedCount++;
      } else {
        seenIds.set(id, element);
      }
    });

    document.querySelectorAll('input, textarea, select').forEach((input) => {
      if (evaluator.shouldIgnoreFormControl(input) || evaluator.hasVisibleFormLabel(input)) {
        return;
      }

      const nameText = (input.getAttribute('aria-label') || input.getAttribute('title') || input.getAttribute('placeholder') || '').trim();
      if (!nameText) {
        return;
      }

      if (!input.id) {
        input.id = `accessify-field-${Math.random().toString(36).slice(2, 8)}`;
      }

      if (!document.querySelector(`label[for="${CSS.escape(input.id)}"]`)) {
        const label = document.createElement('label');
        label.setAttribute('for', input.id);
        label.textContent = nameText;
        input.parentNode?.insertBefore(label, input);
        appliedCount++;
      }
    });

    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const content = viewport.getAttribute('content') || '';
      if (/user-scalable\s*=\s*(no|0)/i.test(content) || /maximum-scale\s*=\s*1(\.0+)?(\s|,|$)/i.test(content)) {
        viewport.setAttribute(
          'content',
          content
            .replace(/user-scalable\s*=\s*(no|0)/ig, 'user-scalable=yes')
            .replace(/maximum-scale\s*=\s*1(\.0+)?/ig, 'maximum-scale=5')
        );
        appliedCount++;
      }
    }

    document.querySelectorAll('input').forEach((input) => {
      if (input.getAttribute('autocomplete')) {
        return;
      }

      const type = (input.type || '').toLowerCase();
      const identity = `${input.name || ''} ${input.id || ''}`.toLowerCase();
      if (type === 'email' || /e-?mail/.test(identity)) {
        input.setAttribute('autocomplete', 'email');
        appliedCount++;
      } else if (type === 'tel' || /(tel|phone|fone|celular)/.test(identity)) {
        input.setAttribute('autocomplete', 'tel');
        appliedCount++;
      } else if (/(^|[_-])(name|nome)($|[_-])/.test(identity)) {
        input.setAttribute('autocomplete', 'name');
        appliedCount++;
      }
    });

    document.querySelectorAll('[title]').forEach((element) => {
      if (this.isAccessifyUi(element)) {
        return;
      }

      const title = element.getAttribute('title');
      const normalizedTitle = evaluator.normalizeComparableText(title);
      const comparisonText = evaluator.getTitleComparisonText(element);
      const normalizedComparison = evaluator.normalizeComparableText(comparisonText);

      if (normalizedTitle && normalizedComparison && normalizedTitle === normalizedComparison) {
        element.removeAttribute('title');
        appliedCount++;
      }
    });

    appliedCount += this.fixPageTitle();
    appliedCount += this.fixMissingH1();
    appliedCount += this.fixGenericLinks(evaluator);
    appliedCount += this.fixEmptyLinksAndButtons(evaluator);
    appliedCount += this.fixMissingImageAlts(evaluator);
    appliedCount += this.fixGraphicFallbacks(evaluator);
    appliedCount += this.fixBrokenAriaReferences(evaluator);
    appliedCount += this.fixPositiveTabindex();
    appliedCount += this.fixLabelInName(evaluator);
    appliedCount += this.fixAriaHiddenContent();
    appliedCount += this.fixNewTabLinks(evaluator);
    appliedCount += this.fixAutoplayMedia();
    appliedCount += this.fixDuplicateLandmarks(evaluator);
    appliedCount += this.fixUnlinkedFieldErrors(evaluator);
    const removeUnderlineCount = this.fixUnderlinedNonLinkText(evaluator);
    appliedCount += removeUnderlineCount;

    let leftAlignNeeded = false;
    let minFontNeeded = false;
    let contrastNeeded = false;
    let nonTextContrastNeeded = false;

    document.querySelectorAll('p, div, td, span, li, a, button, label, small').forEach((element) => {
      if (this.isAccessifyUi(element) || !evaluator.isVisible(element)) {
        return;
      }

      const textContent = evaluator.getRelevantElementText(element);
      if (textContent.length === 0) {
        return;
      }

      const style = window.getComputedStyle(element);
      const fontSize = evaluator.parsePixelValue(style.fontSize);

      if (Number.isFinite(fontSize) && fontSize < 14) {
        element.setAttribute('data-accessify-min-font', 'true');
        minFontNeeded = true;
        appliedCount++;
      }

      if (textContent.length > 500 && style.textAlign === 'justify') {
        element.setAttribute('data-accessify-left-align', 'true');
        leftAlignNeeded = true;
        appliedCount++;
      }
    });

    const colorOnlyLinks = document.querySelectorAll('a[href]');
    let underlineNeeded = false;
    colorOnlyLinks.forEach((link) => {
      if (!link.closest('p, li, td, th, article, blockquote, dd')) {
        return;
      }

      const style = window.getComputedStyle(link);
      const decoration = `${style.textDecorationLine || ''} ${style.textDecoration || ''}`.toLowerCase();
      if (!decoration.includes('underline')) {
        link.setAttribute('data-accessify-underline', 'true');
        underlineNeeded = true;
      }
    });

    const focusNeeded = evaluator.checkForOutlineRemoval();
    const reducedMotionNeeded = this.hasInfiniteAnimation();
    const removeUnderlineNeeded = removeUnderlineCount > 0;

    // O contraste de um elemento pode depender do fundo herdado de um ancestral que
    // TAMBÉM recebe correção (ex.: uma caixa "solid-dark" muda o background-color do
    // pai). Como a folha de estilo com as correções só existe depois de inserida no
    // <head>, uma única passada pode deixar alguns casos pendentes até a folha entrar
    // em vigor. Por isso repetimos aqui - dentro do mesmo clique em "Aplicar" - até não
    // sobrar nada novo, em vez de depender do usuário clicar duas vezes.
    const maxConvergencePasses = 3;
    for (let pass = 0; pass < maxConvergencePasses; pass++) {
      const contrastFixesThisPass = this.fixLowContrast(evaluator);
      appliedCount += contrastFixesThisPass;
      contrastNeeded = contrastNeeded || !!document.querySelector('[data-accessify-contrast]');
      nonTextContrastNeeded = this.markLowNonTextContrast(evaluator) || nonTextContrastNeeded;

      if (
        underlineNeeded || focusNeeded || leftAlignNeeded || minFontNeeded
        || contrastNeeded || nonTextContrastNeeded || reducedMotionNeeded || removeUnderlineNeeded
      ) {
        this.ensureAccessifyStyles({
          focusNeeded,
          underlineNeeded,
          leftAlignNeeded,
          minFontNeeded,
          contrastNeeded,
          nonTextContrastNeeded,
          reducedMotionNeeded,
          removeUnderlineNeeded
        });
      }

      if (contrastFixesThisPass === 0) {
        break;
      }
    }

    if (
      underlineNeeded || focusNeeded || leftAlignNeeded || minFontNeeded
      || contrastNeeded || nonTextContrastNeeded || reducedMotionNeeded || removeUnderlineNeeded
    ) {
      appliedCount++;
    }

    return appliedCount;
  }

  /**
   * Detecta animações CSS contínuas (infinite) em elementos visíveis, para
   * decidir se vale injetar a media query prefers-reduced-motion.
   */
  hasInfiniteAnimation() {
    const elements = document.querySelectorAll('*');
    let checked = 0;

    for (const element of elements) {
      if (checked > 1000) {
        break;
      }
      if (this.isAccessifyUi(element)) {
        continue;
      }
      checked++;

      const style = window.getComputedStyle(element);
      const duration = parseFloat(style.animationDuration) || 0;
      const isInfinite = duration > 0
        && style.animationIterationCount.split(',').some((value) => value.trim() === 'infinite');

      if (isInfinite) {
        return true;
      }
    }

    return false;
  }

  isAccessifyUi(element) {
    return !!(
      element.closest('[data-accessibility="true"]')
      || element.closest('[data-accessify-skip]')
      || element.closest('[data-accessify-sr-h1]')
      || element.closest('.accessify-sr-only')
      || element.id?.startsWith('accessify-')
    );
  }

  /**
   * CSS padrão "sr-only" (clip-path) para conteúdo visualmente oculto mas
   * exposto a leitores de tela. Substitui a técnica antiga de
   * `left:-9999px`, que ferramentas como a WAVE nem sempre reconhecem como
   * oculta e cujo texto herda a cor do site sem um fundo local garantido -
   * o que podia gerar um NOVO problema de contraste em vez de corrigi-lo.
   */
  ensureAccessifySrOnlyStyles() {
    if (document.getElementById('accessify-sr-only-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'accessify-sr-only-styles';
    style.setAttribute('data-accessibility', 'true');
    style.textContent = `
      .accessify-sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        clip-path: inset(50%) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      .accessify-skip-link:focus {
        position: fixed !important;
        top: 8px !important;
        left: 8px !important;
        width: auto !important;
        height: auto !important;
        padding: 8px 16px !important;
        margin: 0 !important;
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
        white-space: normal !important;
        background: #ffffff !important;
        color: #111111 !important;
        z-index: 2147483647 !important;
        outline: 2px solid #1976d2 !important;
      }
    `;
    document.head.appendChild(style);
  }

  fixPageTitle() {
    if (document.title && document.title.trim().length >= 5) {
      return 0;
    }

    const heading = document.querySelector('h1, h2, h3');
    const inferred = (heading?.textContent || '').replace(/\s+/g, ' ').trim()
      || window.location.hostname
      || 'Página da web';
    document.title = inferred.slice(0, 120);
    return 1;
  }

  fixMissingH1() {
    if (document.querySelector('h1')) {
      return 0;
    }

    const firstHeading = document.querySelector('h2, h3, h4, h5, h6');
    if (firstHeading) {
      this.replaceElementTag(firstHeading, 'h1', {});
      return 1;
    }

    const title = (document.title || '').trim();
    if (!title) {
      return 0;
    }

    this.ensureAccessifySrOnlyStyles();
    const heading = document.createElement('h1');
    heading.textContent = title;
    heading.setAttribute('data-accessify-sr-h1', 'true');
    heading.className = 'accessify-sr-only';
    document.body.insertBefore(heading, document.body.firstChild);
    return 1;
  }

  fixGenericLinks(evaluator) {
    let appliedCount = 0;

    document.querySelectorAll('a[href]').forEach((link) => {
      if (this.isAccessifyUi(link)) {
        return;
      }

      const visible = (link.textContent || '').replace(/\s+/g, ' ').trim();
      if (!evaluator.isGenericLinkText(visible)) {
        return;
      }

      const context = this.getLinkPurposeContext(link, evaluator);
      if (!context || evaluator.isGenericLinkText(context)) {
        return;
      }

      const label = `${visible}: ${context}`.slice(0, 160);
      if (link.getAttribute('aria-label') === label) {
        return;
      }

      link.setAttribute('aria-label', label);
      appliedCount++;
    });

    return appliedCount;
  }

  getLinkPurposeContext(link, evaluator) {
    const titled = (link.getAttribute('title') || '').trim();
    if (titled && !evaluator.isGenericLinkText(titled)) {
      return titled;
    }

    const container = link.closest('article, li, figure, section, [class*="card"]');
    const heading = container?.querySelector('h1, h2, h3, h4, h5, h6');
    const headingText = (heading?.textContent || '').replace(/\s+/g, ' ').trim();
    if (headingText && headingText !== (link.textContent || '').trim()) {
      return headingText.slice(0, 120);
    }

    const precedingHeading = this.getPrecedingHeadingText(link);
    if (precedingHeading) {
      return precedingHeading.slice(0, 120);
    }

    const parentText = (link.parentElement?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(new RegExp(this.escapeRegExp(link.textContent.trim()), 'i'), '')
      .trim();
    if (parentText.length >= 8) {
      return parentText.slice(0, 120);
    }

    const href = link.getAttribute('href') || '';
    if (href.startsWith('#') && href.length > 1) {
      const target = document.getElementById(decodeURIComponent(href.slice(1)));
      const targetText = (target?.textContent || '').replace(/\s+/g, ' ').trim();
      if (targetText) {
        return targetText.slice(0, 120);
      }
    }

    try {
      const url = new URL(link.href, window.location.href);
      if (url.hostname && url.hostname !== window.location.hostname) {
        return url.hostname.replace(/^www\./, '');
      }

      const slug = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
      const humanized = this.humanizeFileName(slug);
      if (humanized) {
        return humanized;
      }
    } catch (error) {
      return '';
    }

    return '';
  }

  getPrecedingHeadingText(element) {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previous = '';

    headings.forEach((heading) => {
      if (heading.contains(element)) {
        previous = (heading.textContent || '').replace(/\s+/g, ' ').trim();
        return;
      }

      if (heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
        previous = (heading.textContent || '').replace(/\s+/g, ' ').trim();
      }
    });

    return previous;
  }

  fixEmptyLinksAndButtons(evaluator) {
    let appliedCount = 0;

    document.querySelectorAll('a[href]').forEach((link, index) => {
      if (this.isAccessifyUi(link) || evaluator.getAccessibleLinkText(link)) {
        return;
      }

      const context = this.getLinkPurposeContext(link, evaluator)
        || this.humanizeFileName((link.getAttribute('href') || '').split('/').pop())
        || `Abrir link ${index + 1}`;
      link.setAttribute('aria-label', context.slice(0, 160));
      appliedCount++;
    });

    document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]').forEach((button, index) => {
      if (this.isAccessifyUi(button) || !evaluator.isEmptyButton(button)) {
        return;
      }

      const label = (button.getAttribute('title') || button.getAttribute('name') || `Acionar botão ${index + 1}`).trim();
      if (button.tagName === 'INPUT') {
        button.setAttribute('value', label);
      } else {
        button.setAttribute('aria-label', label);
      }
      appliedCount++;
    });

    return appliedCount;
  }

  fixMissingImageAlts(evaluator) {
    let appliedCount = 0;

    document.querySelectorAll('img').forEach((img) => {
      if (this.isAccessifyUi(img) || img.hasAttribute('alt')) {
        return;
      }

      if (
        evaluator.isSpacerImage(img)
        || evaluator.isEmojiImage(img)
        || evaluator.isDecorativeIconImage(img)
        || evaluator.isMarkedDecorative(img)
      ) {
        img.setAttribute('alt', '');
        appliedCount++;
        return;
      }

      const alt = this.buildHeuristicImageAlt(img, evaluator);
      img.setAttribute('alt', alt);
      appliedCount++;
    });

    return appliedCount;
  }

  buildHeuristicImageAlt(img, evaluator) {
    const figcaption = this.getFigcaptionText(img);
    if (figcaption.length >= 8) {
      return figcaption.slice(0, 100);
    }

    const title = (img.getAttribute('title') || '').trim();
    if (title.length >= 8) {
      return title.slice(0, 100);
    }

    const parentName = this.getParentAccessibleName(img);
    if (parentName.length >= 8 && parentName.toLowerCase() !== (img.src || '').toLowerCase()) {
      return parentName.slice(0, 100);
    }

    const adjacent = this.getImageAdjacentText(img, evaluator);
    if (adjacent.length >= 8) {
      return adjacent.slice(0, 100);
    }

    const fileName = this.humanizeFileName(evaluator.getImageFileName(img.currentSrc || img.src));
    if (fileName) {
      return fileName;
    }

    const width = evaluator.getImageDimension(img, 'width');
    const height = evaluator.getImageDimension(img, 'height');
    if (width <= 32 || height <= 32) {
      return '';
    }

    return 'Imagem';
  }

  humanizeFileName(fileName) {
    if (typeof fileName !== 'string' || fileName.trim().length === 0) {
      return '';
    }

    const base = fileName
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (base.length < 6 || /^\d+$/.test(base.replace(/\s/g, ''))) {
      return '';
    }

    if (/^[a-f0-9\s]{8,}$/i.test(base)) {
      return '';
    }

    return base.slice(0, 100);
  }

  fixGraphicFallbacks(evaluator) {
    let appliedCount = 0;

    document.querySelectorAll('input[type="image"]').forEach((input) => {
      const alt = input.getAttribute('alt');
      if (typeof alt === 'string' && alt.trim()) {
        return;
      }

      const inferred = (input.getAttribute('title') || input.getAttribute('value') || this.humanizeFileName(evaluator.getImageFileName(input.src)) || 'Enviar').trim();
      input.setAttribute('alt', inferred.slice(0, 100));
      appliedCount++;
    });

    document.querySelectorAll('area').forEach((area) => {
      if (area.hasAttribute('alt')) {
        return;
      }

      const inferred = (area.getAttribute('title') || area.getAttribute('href') || 'Área do mapa').toString().trim();
      area.setAttribute('alt', inferred.slice(0, 100));
      appliedCount++;
    });

    return appliedCount;
  }

  fixBrokenAriaReferences(evaluator) {
    let appliedCount = 0;
    const attributeNames = evaluator.getIdReferenceAriaAttributes();

    document.querySelectorAll(attributeNames.map((name) => `[${name}]`).join(', ')).forEach((element) => {
      attributeNames.forEach((attributeName) => {
        const value = element.getAttribute(attributeName);
        if (!value) {
          return;
        }

        const remaining = value
          .split(/\s+/)
          .filter(Boolean)
          .filter((id) => document.getElementById(id));

        if (remaining.length === value.split(/\s+/).filter(Boolean).length) {
          return;
        }

        if (remaining.length === 0) {
          element.removeAttribute(attributeName);
        } else {
          element.setAttribute(attributeName, remaining.join(' '));
        }
        appliedCount++;
      });
    });

    return appliedCount;
  }

  fixPositiveTabindex() {
    let appliedCount = 0;

    document.querySelectorAll('[tabindex]').forEach((element) => {
      const tabindex = parseInt(element.getAttribute('tabindex'), 10);
      if (Number.isFinite(tabindex) && tabindex > 0) {
        element.setAttribute('tabindex', '0');
        appliedCount++;
      }
    });

    return appliedCount;
  }

  fixLabelInName(evaluator) {
    let appliedCount = 0;

    document.querySelectorAll('[aria-label]').forEach((element) => {
      if (this.isAccessifyUi(element)) {
        return;
      }

      const visibleText = evaluator.getRelevantElementText(element);
      const ariaLabel = evaluator.normalizeComparableText(element.getAttribute('aria-label'));
      const visible = evaluator.normalizeComparableText(visibleText);

      if (!visible || visible.length < 2 || !ariaLabel) {
        return;
      }

      if (ariaLabel.includes(visible) || visible.includes(ariaLabel)) {
        return;
      }

      element.setAttribute('aria-label', `${visibleText.trim()} ${element.getAttribute('aria-label')}`.replace(/\s+/g, ' ').trim().slice(0, 160));
      appliedCount++;
    });

    return appliedCount;
  }

  fixAriaHiddenContent() {
    let appliedCount = 0;

    document.querySelectorAll('[aria-hidden="true"]').forEach((element) => {
      if (this.isAccessifyUi(element) || element.closest('svg, i, [class*="icon"]')) {
        return;
      }

      const hasFocusableDescendant = !!element.querySelector(
        'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
      );
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      const shouldReveal = hasFocusableDescendant || (text.length >= 20 && ['DIV', 'P', 'SECTION', 'ARTICLE', 'SPAN'].includes(element.tagName));

      if (!shouldReveal) {
        return;
      }

      element.removeAttribute('aria-hidden');
      element.removeAttribute('hidden');
      element.removeAttribute('inert');
      appliedCount++;
    });

    return appliedCount;
  }

  fixLowContrast(evaluator) {
    let appliedCount = 0;
    let checkedCount = 0;

    document.querySelectorAll('*').forEach((element) => {
      if (checkedCount > 400 || appliedCount > 80) {
        return;
      }

      if (this.isAccessifyUi(element) || !evaluator.isVisible(element) || !evaluator.hasDirectTextContent(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const color = style.color;
      const bgColor = evaluator.getEffectiveBackgroundColor(element);
      const contrast = evaluator.calculateContrast(color, bgColor);
      const minimumContrast = evaluator.isLargeText(style) ? 3 : 4.5;

      checkedCount++;

      if (!(contrast > 0 && contrast < minimumContrast)) {
        return;
      }

      const fg = evaluator.parseColor(color);
      const bg = evaluator.parseColor(bgColor);
      if (!fg || !bg) {
        return;
      }

      const blackContrast = evaluator.calculateContrast('rgb(17, 17, 17)', bgColor);
      const whiteContrast = evaluator.calculateContrast('rgb(255, 255, 255)', bgColor);
      const fgLuminance = evaluator.getLuminance(fg);

      // Se o fundo efetivo detectado vem de uma cor sólida "adivinhada" (ex.: caiu no
      // branco padrão porque um ancestral tem background-image/gradiente), trocar só a
      // cor do texto pode piorar o contraste real. Nesse caso, usamos sempre a caixa
      // sólida, que garante o contraste independente do que estiver por trás.
      const uncertainBackground = evaluator.hasUncertainBackground(element);

      if (!uncertainBackground && blackContrast >= minimumContrast && blackContrast >= whiteContrast) {
        element.setAttribute('data-accessify-contrast', 'dark');
      } else if (!uncertainBackground && whiteContrast >= minimumContrast) {
        element.setAttribute('data-accessify-contrast', 'light');
      } else if (fgLuminance >= 0.5) {
        element.setAttribute('data-accessify-contrast', 'solid-dark');
      } else {
        element.setAttribute('data-accessify-contrast', 'solid-light');
      }

      appliedCount++;
    });

    return appliedCount;
  }

  fixNewTabLinks(evaluator) {
    let appliedCount = 0;

    document.querySelectorAll('a[target="_blank"][href]').forEach((link) => {
      if (this.isAccessifyUi(link)) {
        return;
      }

      const accessibleName = evaluator.getAccessibleLinkText(link);
      const normalized = evaluator.normalizeComparableText(accessibleName);
      if (!normalized || /nova aba|nova janela|new tab|new window|abre em/.test(normalized)) {
        return;
      }

      const baseLabel = (link.getAttribute('aria-label') || accessibleName).trim();
      link.setAttribute('aria-label', `${baseLabel} (abre em nova aba)`.slice(0, 160));
      appliedCount++;
    });

    return appliedCount;
  }

  fixAutoplayMedia() {
    let appliedCount = 0;

    document.querySelectorAll('audio[autoplay], video[autoplay]').forEach((media) => {
      if (this.isAccessifyUi(media) || media.hasAttribute('muted') || media.muted) {
        return;
      }

      if (!media.hasAttribute('controls')) {
        media.setAttribute('controls', '');
        appliedCount++;
      }

      if (!media.paused) {
        try {
          media.pause();
          appliedCount++;
        } catch (error) {
          // Alguns navegadores podem recusar pause() antes do primeiro gesto do usuário
        }
      }
    });

    return appliedCount;
  }

  fixDuplicateLandmarks(evaluator) {
    let appliedCount = 0;
    const groups = {
      'nav, [role="navigation"]': 'Navegação',
      'aside, [role="complementary"]': 'Conteúdo complementar'
    };

    Object.entries(groups).forEach(([selector, fallbackLabel]) => {
      const elements = Array.from(document.querySelectorAll(selector)).filter((element) => !this.isAccessifyUi(element));
      if (elements.length < 2) {
        return;
      }

      elements.forEach((element, index) => {
        if (evaluator.hasAccessibleLandmarkLabel(element)) {
          return;
        }

        const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
        const headingText = heading ? evaluator.getRelevantElementText(heading) : '';
        const positional = element.closest('header')
          ? `${fallbackLabel} principal`
          : element.closest('footer')
            ? `${fallbackLabel} do rodapé`
            : `${fallbackLabel} ${index + 1}`;

        element.setAttribute('aria-label', (headingText || positional).slice(0, 160));
        appliedCount++;
      });
    });

    return appliedCount;
  }

  fixUnlinkedFieldErrors(evaluator) {
    let appliedCount = 0;

    document.querySelectorAll('input, textarea, select').forEach((field) => {
      if (this.isAccessifyUi(field) || evaluator.shouldIgnoreFormControl(field) || !evaluator.isVisible(field)) {
        return;
      }

      const errorElement = evaluator.findNearbyErrorText(field);
      if (!errorElement) {
        return;
      }

      if (!errorElement.id) {
        errorElement.id = `accessify-error-${Math.random().toString(36).slice(2, 8)}`;
      }

      const describedBy = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      if (describedBy.has(errorElement.id)) {
        return;
      }

      describedBy.add(errorElement.id);
      field.setAttribute('aria-describedby', Array.from(describedBy).join(' '));
      if (!field.hasAttribute('aria-invalid')) {
        field.setAttribute('aria-invalid', 'true');
      }
      appliedCount++;
    });

    return appliedCount;
  }

  fixUnderlinedNonLinkText(evaluator) {
    let appliedCount = 0;
    const candidates = document.querySelectorAll('u, span, strong, em, b, i, small, p, li, td, th, div, label');

    candidates.forEach((element) => {
      if (this.isAccessifyUi(element) || !evaluator.isVisible(element)) {
        return;
      }

      if (element.closest('a, [role="link"], button, [role="button"], ins')) {
        return;
      }

      if (!evaluator.hasDirectTextContent(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const decoration = `${style.textDecorationLine || ''} ${style.textDecoration || ''}`.toLowerCase();
      if (!decoration.includes('underline')) {
        return;
      }

      element.setAttribute('data-accessify-remove-underline', 'true');
      appliedCount++;
    });

    return appliedCount;
  }

  markLowNonTextContrast(evaluator) {
    let marked = false;
    let checkedCount = 0;

    document.querySelectorAll('button, input, select, textarea, a[href], [role="button"]').forEach((element) => {
      if (checkedCount > 80 || this.isAccessifyUi(element) || !evaluator.isVisible(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const borderWidth = parseFloat(style.borderTopWidth) || 0;
      const ownBackground = style.backgroundColor;
      const hasOwnOpaqueBackground = evaluator.isOpaqueColor(ownBackground);
      if (!hasOwnOpaqueBackground && borderWidth === 0) {
        return;
      }

      const background = hasOwnOpaqueBackground ? ownBackground : evaluator.getEffectiveBackgroundColor(element);
      const parentBackground = element.parentElement
        ? evaluator.getEffectiveBackgroundColor(element.parentElement)
        : 'rgb(255, 255, 255)';
      const backgroundContrast = evaluator.calculateContrast(background, parentBackground);
      const borderContrast = borderWidth > 0 ? evaluator.calculateContrast(style.borderTopColor, parentBackground) : 0;

      checkedCount++;

      if (backgroundContrast >= 3 || borderContrast >= 3 || backgroundContrast === 0) {
        return;
      }

      element.setAttribute('data-accessify-control-outline', 'true');
      marked = true;
    });

    return marked;
  }

  ensureAccessifyStyles({
    focusNeeded,
    underlineNeeded,
    leftAlignNeeded,
    minFontNeeded,
    contrastNeeded,
    nonTextContrastNeeded,
    reducedMotionNeeded,
    removeUnderlineNeeded
  }) {
    let style = document.getElementById('accessify-deterministic-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'accessify-deterministic-styles';
      style.setAttribute('data-accessibility', 'true');
      document.head.appendChild(style);
    }

    const rules = [];
    if (focusNeeded) {
      rules.push('a:focus, button:focus, input:focus, select:focus, textarea:focus, [tabindex]:focus { outline: 2px solid #1976d2; outline-offset: 2px; }');
    }
    if (underlineNeeded) {
      rules.push('a[data-accessify-underline="true"] { text-decoration: underline; }');
    }
    if (removeUnderlineNeeded) {
      rules.push('[data-accessify-remove-underline="true"] { text-decoration: none !important; }');
    }
    if (leftAlignNeeded) {
      rules.push('[data-accessify-left-align="true"] { text-align: left !important; }');
    }
    if (minFontNeeded) {
      rules.push('[data-accessify-min-font="true"] { font-size: 14px !important; }');
    }
    if (contrastNeeded) {
      rules.push('[data-accessify-contrast="dark"] { color: #111111 !important; }');
      rules.push('[data-accessify-contrast="light"] { color: #ffffff !important; }');
      rules.push('[data-accessify-contrast="solid-dark"] { color: #ffffff !important; background-color: #111111 !important; padding: 0.12em 0.25em; }');
      rules.push('[data-accessify-contrast="solid-light"] { color: #111111 !important; background-color: #ffffff !important; padding: 0.12em 0.25em; }');
    }
    if (nonTextContrastNeeded) {
      rules.push('[data-accessify-control-outline="true"] { outline: 2px solid #111111; outline-offset: 2px; }');
    }
    if (reducedMotionNeeded) {
      rules.push(`@media (prefers-reduced-motion: reduce) {
        *:not([data-accessibility="true"]):not([data-accessibility="true"] *) {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }`);
    }
    style.textContent = rules.join('\n');
  }

  createAccessibilityOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'wcag-accessibility-overlay';
    overlay.setAttribute('data-accessibility', 'true');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.95);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow-y: auto;
    `;

    overlay.innerHTML = `
      <div style="padding: 20px; max-width: 1200px; margin: 0 auto; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; color: #333;">Otimização de Acessibilidade WCAG</h1>
          <button id="wcag-close-overlay" style="
            background: #f0f0f0;
            border: 1px solid #ccc;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Fechar</button>
        </div>

        <div id="wcag-steps-container" style="margin-bottom: 30px;"></div>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 4px; margin-bottom: 20px;">
          <h2 style="margin-top: 0;">Resumo das Alterações</h2>
          <div id="wcag-summary" style="font-size: 14px; line-height: 1.6;"></div>
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="wcag-apply-btn" style="
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
          ">Aplicar Otimizações</button>
          <button id="wcag-cancel-btn" style="
            background: #f44336;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
          ">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('wcag-close-overlay').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('wcag-cancel-btn').addEventListener('click', () => {
      overlay.remove();
    });

    return overlay;
  }

  updateStepsDisplay(steps) {
    const container = document.getElementById('wcag-steps-container');
    if (!container) return;

    container.innerHTML = '';
    steps.forEach((step) => {
      const stepDiv = document.createElement('div');
      stepDiv.style.cssText = `
        margin-bottom: 15px;
        padding: 15px;
        background: #f9f9f9;
        border-left: 4px solid ${step.status === 'completed' ? '#4CAF50' : step.status === 'processing' ? '#2196F3' : '#ccc'};
        border-radius: 4px;
      `;

      const statusIcon = step.status === 'completed' ? '✓' : step.status === 'processing' ? '⟳' : '○';
      const statusColor = step.status === 'completed' ? '#4CAF50' : step.status === 'processing' ? '#2196F3' : '#999';

      stepDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <span style="color: ${statusColor}; font-size: 18px; font-weight: bold;">${statusIcon}</span>
          <span style="font-weight: bold; color: #333;">${step.title}</span>
        </div>
        <div style="color: #666; font-size: 14px; margin-left: 28px;">
          ${step.description}
        </div>
        ${step.details ? `<div style="color: #999; font-size: 12px; margin-left: 28px; margin-top: 5px;">${step.details}</div>` : ''}
      `;

      container.appendChild(stepDiv);
    });
  }

  updateSummary(summary) {
    const summaryDiv = document.getElementById('wcag-summary');
    if (!summaryDiv) return;

    summaryDiv.innerHTML = `
      <p><strong>Total de problemas encontrados:</strong> ${summary.total}</p>
      <p><strong>Críticos:</strong> ${summary.critical}</p>
      <p><strong>Avisos:</strong> ${summary.warnings}</p>
      <p><strong>Requer processamento de IA:</strong> ${summary.requiresLLM}</p>
    `;
  }
}

window.accessibilityAnalyzer = new AccessibilityAnalyzer();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeAccessibility') {
    window.accessibilityAnalyzer.analyzePageForAccessibility()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'extractImages') {
    sendResponse(window.accessibilityAnalyzer.extractImages({
      includeDataUrl: request.includeDataUrl === true,
      maxImages: request.maxImages
    }));
    return false;
  }

  if (request.action === 'applyOptimizations') {
    window.accessibilityAnalyzer.applyOptimizations(request.optimizations)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'createOverlay') {
    window.accessibilityAnalyzer.createAccessibilityOverlay();
    sendResponse({ success: true });
  }

  if (request.action === 'updateSteps') {
    window.accessibilityAnalyzer.updateStepsDisplay(request.steps);
    sendResponse({ success: true });
  }

  if (request.action === 'updateSummary') {
    window.accessibilityAnalyzer.updateSummary(request.summary);
    sendResponse({ success: true });
  }
});

console.log('Accessify - Content Script Loaded');
