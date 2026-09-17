// WCAG Evaluator carregado pelo content script via manifest

class WCAGEvaluator {
  constructor() {
    this.issues = [];
    this.wcagCriteria = {
      // WCAG 2.1 Level A & AA criteria
      'text-alternatives': {
        name: 'Alternativas de Texto',
        level: 'A',
        criterion: '1.1.1',
        description: 'Imagens devem ter alternativas de texto'
      },
      'color-contrast': {
        name: 'Contraste de Cores',
        level: 'AA',
        criterion: '1.4.3',
        description: 'Texto deve ter contraste mínimo de 4.5:1'
      },
      'readability-alerts': {
        name: 'Alertas de Legibilidade',
        level: 'Advisory',
        criterion: 'Advisory',
        description: 'Evita padrões que reduzem legibilidade ou repetem informação'
      },
      'page-regions': {
        name: 'Regiões da Página',
        level: 'A',
        criterion: '1.3.1',
        description: 'A página deve expor regiões e landmarks semânticos'
      },
      'aria-hidden': {
        name: 'ARIA Hidden',
        level: 'A',
        criterion: '4.1.2',
        description: 'Conteúdo oculto com aria-hidden deve ser intencional e seguro'
      },
      'aria-references': {
        name: 'Referências ARIA',
        level: 'A',
        criterion: '4.1.2',
        description: 'Referências aria-labelledby e aria-describedby devem apontar para elementos existentes'
      },
      'heading-structure': {
        name: 'Estrutura de Títulos',
        level: 'A',
        criterion: '1.3.1',
        description: 'Títulos devem estar em ordem hierárquica'
      },
      'form-labels': {
        name: 'Rótulos de Formulário',
        level: 'A',
        criterion: '1.3.1',
        description: 'Campos de formulário devem ter rótulos associados'
      },
      'link-text': {
        name: 'Texto do Link',
        level: 'A',
        criterion: '2.4.4',
        description: 'Links devem ter texto descritivo'
      },
      'keyboard-navigation': {
        name: 'Navegação por Teclado',
        level: 'A',
        criterion: '2.1.1',
        description: 'Todos os elementos devem ser acessíveis por teclado'
      },
      'focus-indicator': {
        name: 'Indicador de Foco',
        level: 'AA',
        criterion: '2.4.7',
        description: 'Elementos focáveis devem ter indicador visual'
      },
      'semantic-html': {
        name: 'HTML Semântico',
        level: 'A',
        criterion: '1.3.1',
        description: 'Deve usar elementos semânticos apropriados'
      },
      'language-declaration': {
        name: 'Declaração de Idioma',
        level: 'A',
        criterion: '3.1.1',
        description: 'Página deve declarar o idioma principal'
      },
      'page-title': {
        name: 'Título da Página',
        level: 'A',
        criterion: '2.4.2',
        description: 'Página deve ter um título descritivo'
      },
      'data-tables': {
        name: 'Tabelas de Dados',
        level: 'A',
        criterion: '1.3.1',
        description: 'Tabelas de dados devem ter cabeçalhos semânticos'
      },
      'bypass-blocks': {
        name: 'Pular Blocos',
        level: 'A',
        criterion: '2.4.1',
        description: 'Deve ser possível pular blocos repetidos de conteúdo'
      },
      'iframe-title': {
        name: 'Título de iframe',
        level: 'A',
        criterion: '4.1.2',
        description: 'iframes devem ter título acessível'
      },
      'use-of-color': {
        name: 'Uso de Cor',
        level: 'A',
        criterion: '1.4.1',
        description: 'Cor não deve ser o único meio de distinguir links no texto'
      },
      'duplicate-ids': {
        name: 'IDs Duplicados',
        level: 'A',
        criterion: '4.1.2',
        description: 'IDs devem ser únicos para relações e rótulos acessíveis'
      },
      'form-instructions': {
        name: 'Rótulos ou Instruções',
        level: 'A',
        criterion: '3.3.2',
        description: 'Campos devem ter rótulo visível, não apenas placeholder ou title'
      },
      'resize-text': {
        name: 'Redimensionar Texto',
        level: 'AA',
        criterion: '1.4.4',
        description: 'A página não deve impedir zoom do navegador'
      },
      'input-purpose': {
        name: 'Propósito do Campo',
        level: 'AA',
        criterion: '1.3.5',
        description: 'Campos comuns devem declarar autocomplete'
      },
      'label-in-name': {
        name: 'Nome contém Rótulo',
        level: 'A',
        criterion: '2.5.3',
        description: 'O nome acessível deve conter o texto visível'
      },
      'non-text-contrast': {
        name: 'Contraste de Não-texto',
        level: 'AA',
        criterion: '1.4.11',
        description: 'Componentes de interface devem ter contraste mínimo de 3:1'
      },
      'meaningful-sequence': {
        name: 'Sequência Significativa',
        level: 'A',
        criterion: '1.3.2',
        description: 'A ordem visual não deve contradizer a ordem do DOM'
      },
      'audio-control': {
        name: 'Áudio Controlável',
        level: 'A',
        criterion: '1.4.2',
        description: 'Som que toca automaticamente por mais de 3 segundos deve poder ser pausado ou silenciado'
      },
      'animation-control': {
        name: 'Controle de Animação',
        level: 'A',
        criterion: '2.2.2',
        description: 'Conteúdo em movimento automático e contínuo deve respeitar a preferência de redução de movimento do usuário'
      },
      'captcha-alternative': {
        name: 'Alternativa a CAPTCHA',
        level: 'A',
        criterion: '1.1.1',
        description: 'CAPTCHAs devem oferecer alternativa acessível (ex.: desafio sonoro) para usuários de leitor de tela'
      },
      'timing-adjustable': {
        name: 'Tempo Ajustável',
        level: 'A',
        criterion: '2.2.1',
        description: 'Atualizações ou redirecionamentos automáticos por tempo não devem ocorrer sem controle do usuário'
      }
    };
  }

  /**
   * Avalia toda a página
   */
  evaluate() {
    this.issues = [];
    
    this.evaluateImages();
    this.evaluateNonTextAlternatives();
    this.evaluateHeadings();
    this.evaluateForms();
    this.evaluateLinks();
    this.evaluateButtons();
    this.evaluateTitleAttributes();
    this.evaluateColorContrast();
    this.evaluateNonTextContrast();
    this.evaluateTextPresentation();
    this.evaluatePageRegions();
    this.evaluateBypassBlocks();
    this.evaluateTables();
    this.evaluateSemanticHTML();
    this.evaluateClickableNonSemantic();
    this.evaluateAriaHidden();
    this.evaluateAriaReferences();
    this.evaluateIframes();
    this.evaluateDuplicateIds();
    this.evaluateLanguage();
    this.evaluatePageTitle();
    this.evaluateKeyboardNavigation();
    this.evaluateFocusIndicators();
    this.evaluateColorOnlyLinks();
    this.evaluateViewportZoom();
    this.evaluateInputPurpose();
    this.evaluateLabelInName();
    this.evaluateReadingOrder();
    this.evaluateAutoplayMedia();
    this.evaluateNewTabLinks();
    this.evaluateDuplicateLandmarks();
    this.evaluateInfiniteAnimations();
    this.evaluateCaptcha();
    this.evaluateUnlinkedFieldErrors();
    this.evaluateMetaRefresh();
    this.evaluateBrokenSamePageLinks();
    this.evaluateUnderlinedNonLinkText();

    return this.issues;
  }

  /**
   * Avalia imagens e alt text
   */
  evaluateImages() {
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
      const hasAltAttribute = img.hasAttribute('alt');
      const alt = img.getAttribute('alt');
      const normalizedAlt = typeof alt === 'string' ? alt.trim() : '';

      if (!hasAltAttribute) {
        if (this.isSpacerImage(img) || this.isDecorativeIconImage(img) || this.isMarkedDecorative(img)) {
          this.issues.push({
            type: 'spacer-image-missing-alt',
            element: img,
            index,
            severity: 'warning',
            criterion: this.wcagCriteria['text-alternatives'],
            message: `Imagem decorativa ${index + 1} sem alt vazio`,
            element_html: img.outerHTML.substring(0, 100),
            requires_llm: false,
            image_src: img.src
          });
          return;
        }

        this.issues.push({
          type: 'image-missing-alt',
          element: img,
          severity: 'critical',
          criterion: this.wcagCriteria['text-alternatives'],
          message: `Imagem ${index + 1} não possui texto alternativo`,
          element_html: img.outerHTML.substring(0, 100),
          requires_llm: true,
          image_src: img.src
        });
      } else if (this.isEmojiImage(img)) {
        return;
      } else if (normalizedAlt.length > 100) {
        this.issues.push({
          type: 'image-alt-too-long',
          element: img,
          severity: 'warning',
          criterion: this.wcagCriteria['text-alternatives'],
          message: `Alt text da imagem é muito longo (${normalizedAlt.length} caracteres)`,
          element_html: img.outerHTML.substring(0, 100),
          requires_llm: false,
          image_src: img.src
        });
      } else if (normalizedAlt.length > 0 && normalizedAlt.length < 5) {
        this.issues.push({
          type: 'image-alt-too-short',
          element: img,
          severity: 'warning',
          criterion: this.wcagCriteria['text-alternatives'],
          message: `Alt text da imagem é muito curto: "${normalizedAlt}"`,
          element_html: img.outerHTML.substring(0, 100),
          requires_llm: false,
          image_src: img.src
        });
      }

      if (normalizedAlt.length > 0) {
        const adjacentText = this.getRedundantAdjacentText(img, normalizedAlt);

        if (adjacentText) {
          this.issues.push({
            type: 'redundant-image-alt',
            element: img,
            index,
            severity: 'warning',
            criterion: this.wcagCriteria['text-alternatives'],
            message: `Alt text da imagem repete o texto adjacente: "${normalizedAlt}"`,
            element_html: img.outerHTML.substring(0, 100),
            requires_llm: false,
            image_src: img.src,
            alt_text: normalizedAlt,
            adjacent_text: adjacentText
          });
        }
      }
    });
  }

  /**
   * Avalia estrutura de títulos
   */
  evaluateHeadings() {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    let h1Count = 0;

    if (headings.length === 0) {
      this.issues.push({
        type: 'no-headings',
        severity: 'warning',
        criterion: this.wcagCriteria['heading-structure'],
        message: 'Página não possui títulos estruturados',
        requires_llm: false
      });
      return;
    }

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName[1]);

      if (this.isHeadingEmpty(heading)) {
        this.issues.push({
          type: 'empty-heading',
          element: heading,
          severity: 'critical',
          criterion: this.wcagCriteria['heading-structure'],
          message: `Título ${heading.tagName} sem conteúdo informativo`,
          element_html: heading.outerHTML.substring(0, 100),
          requires_llm: false
        });
      }
      
      if (level === 1) h1Count++;
      
      if (index === 0 && level !== 1) {
        this.issues.push({
          type: 'heading-structure-invalid',
          element: heading,
          severity: 'warning',
          criterion: this.wcagCriteria['heading-structure'],
          message: 'Primeira estrutura de título deve ser H1',
          element_html: heading.outerHTML.substring(0, 100),
          requires_llm: false
        });
      }

      if (level - lastLevel > 1 && index > 0) {
        this.issues.push({
          type: 'heading-level-skip',
          element: heading,
          severity: 'warning',
          criterion: this.wcagCriteria['heading-structure'],
          message: `Salto de nível de título: de H${lastLevel} para H${level}`,
          element_html: heading.outerHTML.substring(0, 100),
          requires_llm: false
        });
      }

      lastLevel = level;
    });

    if (h1Count === 0) {
      this.issues.push({
        type: 'no-h1',
        severity: 'critical',
        criterion: this.wcagCriteria['heading-structure'],
        message: 'Página deve ter pelo menos um H1',
        requires_llm: false
      });
    } else if (h1Count > 1) {
      this.issues.push({
        type: 'multiple-h1',
        severity: 'warning',
        criterion: this.wcagCriteria['heading-structure'],
        message: `Página com ${h1Count} elementos H1 (recomenda-se apenas um por página)`,
        requires_llm: false
      });
    }
  }

  /**
   * Avalia formulários
   */
  evaluateForms() {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach((input) => {
      if (this.shouldIgnoreFormControl(input)) {
        return;
      }

      if (!this.hasAccessibleFormLabel(input)) {
        this.issues.push({
          type: 'form-field-no-label',
          element: input,
          severity: 'critical',
          criterion: this.wcagCriteria['form-labels'],
          message: `Campo de formulário sem rótulo associado`,
          element_html: input.outerHTML.substring(0, 100),
          requires_llm: false,
          placeholder: input.getAttribute('placeholder')
        });
        return;
      }

      if (!this.hasVisibleFormLabel(input)) {
        this.issues.push({
          type: 'form-field-no-visible-label',
          element: input,
          severity: 'warning',
          criterion: this.wcagCriteria['form-instructions'],
          message: 'Campo possui nome acessível, mas não tem rótulo visível (placeholder ou title não bastam)',
          element_html: input.outerHTML.substring(0, 100),
          requires_llm: false,
          placeholder: input.getAttribute('placeholder'),
          title_attribute: input.getAttribute('title')
        });
      }
    });
  }

  /**
   * Avalia links
   */
  evaluateLinks() {
    const links = document.querySelectorAll('a[href]');
    links.forEach((link) => {
      const text = this.getAccessibleLinkText(link);
      const hasImageWithoutAlt = this.hasLinkedImageMissingAlt(link);

      if (!text && hasImageWithoutAlt) {
        this.issues.push({
          type: 'linked-image-missing-alt',
          element: link,
          severity: 'critical',
          criterion: this.wcagCriteria['link-text'],
          message: 'Imagem linkada sem texto alternativo descritivo',
          element_html: link.outerHTML.substring(0, 100),
          requires_llm: false
        });
      }

      if (!text) {
        this.issues.push({
          type: 'link-no-text',
          element: link,
          severity: 'critical',
          criterion: this.wcagCriteria['link-text'],
          message: 'Link sem texto descritivo',
          element_html: link.outerHTML.substring(0, 100),
          requires_llm: false
        });
        return;
      }

      if (text && this.isGenericLinkText(text)) {
        this.issues.push({
          type: 'link-generic-text',
          element: link,
          severity: 'warning',
          criterion: this.wcagCriteria['link-text'],
          message: `Link com texto genérico: "${text}"`,
          element_html: link.outerHTML.substring(0, 100),
          requires_llm: false
        });
      }
    });
  }

  evaluateButtons() {
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]');

    buttons.forEach((button, index) => {
      if (this.isEmptyButton(button)) {
        this.issues.push({
          type: 'empty-button',
          element: button,
          severity: 'critical',
          criterion: this.wcagCriteria['link-text'],
          message: `Botão ${index + 1} sem texto descritivo`,
          element_html: button.outerHTML.substring(0, 100),
          requires_llm: false
        });
      }
    });
  }

  evaluateTitleAttributes() {
    const elements = document.querySelectorAll('[title]');

    elements.forEach((element) => {
      const title = element.getAttribute('title');
      const normalizedTitle = this.normalizeComparableText(title);

      if (!normalizedTitle) {
        return;
      }

      const comparisonText = this.getTitleComparisonText(element);
      const normalizedComparison = this.normalizeComparableText(comparisonText);

      if (normalizedComparison && normalizedComparison === normalizedTitle) {
        this.issues.push({
          type: 'redundant-title-text',
          element,
          severity: 'warning',
          criterion: this.wcagCriteria['readability-alerts'],
          message: `Title redundante repete o texto disponível: "${title.trim()}"`,
          element_html: element.outerHTML.substring(0, 100),
          requires_llm: false,
          title_attribute: title.trim(),
          element_text: comparisonText.trim()
        });
      }
    });
  }

  evaluateTextPresentation() {
    const elements = document.querySelectorAll('p, div, td, span, li, a, button, label, small');

    elements.forEach((element) => {
      if (!this.isVisible(element)) {
        return;
      }

      const textContent = this.getRelevantElementText(element);
      if (textContent.length === 0) {
        return;
      }

      const style = window.getComputedStyle(element);
      const fontSize = this.parsePixelValue(style.fontSize);

      if (Number.isFinite(fontSize) && fontSize < 14) {
        this.issues.push({
          type: 'small-text',
          element,
          severity: 'warning',
          criterion: this.wcagCriteria['readability-alerts'],
          message: `Texto muito pequeno (${style.fontSize})`,
          element_html: element.outerHTML.substring(0, 100),
          requires_llm: false,
          font_size: style.fontSize,
          text_content: textContent.slice(0, 160)
        });
      }

      if (textContent.length <= 500) {
        return;
      }

      if (style.textAlign === 'justify') {
        this.issues.push({
          type: 'justified-text',
          element,
          severity: 'warning',
          criterion: this.wcagCriteria['readability-alerts'],
          message: `Bloco longo com texto justificado (${textContent.length} caracteres)`,
          element_html: element.outerHTML.substring(0, 100),
          requires_llm: false,
          character_count: textContent.length,
          text_align: style.textAlign
        });
      }
    });
  }

  /**
   * Avalia contraste de cores
   */
  evaluateColorContrast() {
    const elements = document.querySelectorAll('*');
    let checkedCount = 0;

    elements.forEach((element) => {
      if (checkedCount > 400) return;

      if (!this.isVisible(element) || !this.hasDirectTextContent(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const color = style.color;
      const bgColor = this.getEffectiveBackgroundColor(element);
      const contrast = this.calculateContrast(color, bgColor);
      const isLargeText = this.isLargeText(style);
      const minimumContrast = isLargeText ? 3 : 4.5;

      if (contrast > 0 && contrast < minimumContrast) {
        this.issues.push({
          type: 'low-color-contrast',
          element: element,
          severity: 'warning',
          criterion: this.wcagCriteria['color-contrast'],
          message: `Contraste baixo: ${contrast.toFixed(2)}:1 (mínimo ${minimumContrast}:1)`,
          element_html: element.outerHTML.substring(0, 100),
          requires_llm: false,
          contrast_ratio: contrast,
          minimum_contrast: minimumContrast,
          foreground_color: color,
          background_color: bgColor,
          font_size: style.fontSize,
          font_weight: style.fontWeight,
          is_large_text: isLargeText,
          background_image: style.backgroundImage
        });
      }

      checkedCount++;
    });
  }

  evaluatePageRegions() {
    const landmarks = document.querySelectorAll(
      'header, nav, main, footer, aside, [role="banner"], [role="navigation"], [role="main"], [role="contentinfo"], [role="complementary"], [role="search"]'
    );

    if (landmarks.length === 0) {
      this.issues.push({
        type: 'no-page-regions',
        severity: 'warning',
        criterion: this.wcagCriteria['page-regions'],
        message: 'Página sem regiões semânticas ou landmarks ARIA',
        requires_llm: false
      });
    }
  }

  evaluateAriaHidden() {
    const hiddenElements = document.querySelectorAll('[aria-hidden="true"]');

    hiddenElements.forEach((element) => {
      const hasFocusableDescendant = !!element.querySelector(
        'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
      );
      const style = window.getComputedStyle(element);
      const backgroundColor = this.getEffectiveBackgroundColor(element);
      const minimumContrast = this.isLargeText(style) ? 3 : 4.5;

      this.issues.push({
        type: 'aria-hidden-content',
        element,
        severity: hasFocusableDescendant ? 'critical' : 'warning',
        criterion: this.wcagCriteria['aria-hidden'],
        message: hasFocusableDescendant
          ? 'Elemento com aria-hidden contém conteúdo navegável'
          : 'Elemento com aria-hidden="true" presente na página',
        element_html: element.outerHTML.substring(0, 100),
        requires_llm: false,
        foreground_color: style.color,
        background_color: backgroundColor,
        font_size: style.fontSize,
        minimum_contrast: minimumContrast
      });
    });
  }

  /**
   * Atributos ARIA que referenciam outro(s) elemento(s) por ID. A WAVE reporta
   * "Broken ARIA reference" para qualquer um deles, não só labelledby/describedby -
   * aria-controls e aria-owns são comuns em widgets customizados (accordion, combobox,
   * tabs) e aria-activedescendant em listas/menus navegáveis por teclado.
   */
  getIdReferenceAriaAttributes() {
    return [
      'aria-labelledby',
      'aria-describedby',
      'aria-controls',
      'aria-owns',
      'aria-flowto',
      'aria-activedescendant',
      'aria-details',
      'aria-errormessage'
    ];
  }

  evaluateAriaReferences() {
    const attributeNames = this.getIdReferenceAriaAttributes();
    const elements = document.querySelectorAll(attributeNames.map((name) => `[${name}]`).join(', '));

    elements.forEach((element) => {
      attributeNames.forEach((attributeName) => {
        const value = element.getAttribute(attributeName);
        if (!value) {
          return;
        }

        const missingIds = value
          .split(/\s+/)
          .filter(Boolean)
          .filter((id) => !document.getElementById(id));

        if (missingIds.length > 0) {
          this.issues.push({
            type: 'broken-aria-reference',
            element,
            severity: 'critical',
            criterion: this.wcagCriteria['aria-references'],
            message: `${attributeName} referencia ID inexistente: ${missingIds.join(', ')}`,
            element_html: element.outerHTML.substring(0, 100),
            requires_llm: false
          });
        }
      });
    });
  }

  /**
   * Calcula contraste entre duas cores
   */
  calculateContrast(color1, color2) {
    const rgb1 = this.parseColor(color1);
    const rgb2 = this.parseColor(color2);

    if (!rgb1 || !rgb2) return 0;

    const lum1 = this.getLuminance(rgb1);
    const lum2 = this.getLuminance(rgb2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Extrai RGB de uma cor
   */
  parseColor(color) {
    if (typeof color !== 'string') {
      return null;
    }

    const rgb = color.match(/\d+/g);
    return rgb ? { r: parseInt(rgb[0]), g: parseInt(rgb[1]), b: parseInt(rgb[2]) } : null;
  }

  isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  hasDirectTextContent(element) {
    return Array.from(element.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
    );
  }

  isHeadingEmpty(heading) {
    if (heading.textContent.trim().length > 0) {
      return false;
    }

    const informativeImage = Array.from(heading.querySelectorAll('img')).some(
      (img) => this.getImageAlternativeText(img).length > 0
    );

    return !informativeImage;
  }

  isSpacerImage(img) {
    const width = this.getImageDimension(img, 'width');
    const height = this.getImageDimension(img, 'height');
    const fileName = this.getImageFileName(img.currentSrc || img.src);

    return width <= 3 || height <= 3 || /^(spacer|space|blank)\b/i.test(fileName);
  }

  isEmojiImage(img) {
    if (!(img instanceof Element)) {
      return false;
    }

    const src = img.currentSrc || img.src || img.getAttribute('src') || '';
    const className = typeof img.className === 'string'
      ? img.className
      : (img.className?.baseVal || '');

    return /\bemoji\b/i.test(className)
      || /\/emoji\//i.test(src)
      || /s\.w\.org\/images\/core\/emoji/i.test(src);
  }

  isDecorativeIconImage(img) {
    if (!(img instanceof Element)) {
      return false;
    }

    const className = typeof img.className === 'string'
      ? img.className
      : (img.className?.baseVal || '');

    // Divide por espaço, hífen e underscore para comparar TOKEN a token (não
    // substring). Um regex como /\bicon\b/ casaria "team-icon-photo" ou
    // "article-icon-header" inteiros por causa dos hífens ao redor de "icon" -
    // marcando uma foto de conteúdo real como decorativa e tirando-a da fila de
    // geração de alt text (heurística ou IA). Exigir um token exato evita isso.
    const decorativeTokens = new Set(['icon', 'ico', 'glyph', 'bullet', 'divider', 'decorative']);
    const words = className.toLowerCase().split(/[\s_-]+/).filter(Boolean);
    if (words.some((word) => decorativeTokens.has(word))) {
      return true;
    }

    const src = img.currentSrc || img.src || img.getAttribute('src') || '';
    if (/\/(icons?|glyphs?)\//i.test(src)) {
      return true;
    }

    const width = this.getImageDimension(img, 'width');
    const height = this.getImageDimension(img, 'height');
    return width > 0 && width <= 16 && height > 0 && height <= 16;
  }

  isMarkedDecorative(img) {
    if (!(img instanceof Element)) {
      return false;
    }

    const role = img.getAttribute('role');
    return role === 'presentation' || role === 'none' || img.getAttribute('aria-hidden') === 'true';
  }

  getImageDimension(img, dimension) {
    const attributeValue = parseInt(img.getAttribute(dimension), 10);
    if (Number.isFinite(attributeValue)) {
      return attributeValue;
    }

    const renderedValue = dimension === 'width' ? img.width : img.height;
    return Number.isFinite(renderedValue) ? renderedValue : Number.POSITIVE_INFINITY;
  }

  getImageFileName(src) {
    if (typeof src !== 'string' || src.length === 0) {
      return '';
    }

    if (src.startsWith('data:')) {
      return '';
    }

    try {
      const url = new URL(src, window.location.href);
      const segments = url.pathname.split('/').filter(Boolean);
      return decodeURIComponent(segments[segments.length - 1] || '');
    } catch {
      const segments = src.split('/').filter(Boolean);
      return segments[segments.length - 1] || '';
    }
  }

  getEffectiveBackgroundColor(element) {
    let current = element;

    while (current) {
      const bgColor = window.getComputedStyle(current).backgroundColor;
      if (this.isOpaqueColor(bgColor)) {
        return bgColor;
      }
      current = current.parentElement;
    }

    return 'rgb(255, 255, 255)';
  }

  /**
   * Detecta se o fundo efetivo do elemento é incerto (imagem/gradiente) antes de
   * chegar a uma cor sólida — nesse caso, trocar só a cor do texto pode piorar
   * o contraste real em vez de corrigi-lo.
   */
  hasUncertainBackground(element) {
    let current = element;

    while (current) {
      const style = window.getComputedStyle(current);
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        return true;
      }
      if (this.isOpaqueColor(style.backgroundColor)) {
        return false;
      }
      current = current.parentElement;
    }

    return false;
  }

  isOpaqueColor(color) {
    if (typeof color !== 'string') {
      return false;
    }

    if (color === 'transparent') {
      return false;
    }

    const alphaMatch = color.match(/rgba?\([^)]*\)/);
    if (!alphaMatch) {
      return false;
    }

    const values = color.match(/[\d.]+/g);
    if (!values) {
      return false;
    }

    if (values.length < 4) {
      return true;
    }

    return parseFloat(values[3]) > 0;
  }

  isLargeText(style) {
    const fontSize = parseFloat(style.fontSize);
    const fontWeight = parseInt(style.fontWeight, 10);
    const isBold = Number.isFinite(fontWeight) ? fontWeight >= 700 : style.fontWeight === 'bold';

    return fontSize >= 24 || (isBold && fontSize >= 18.66);
  }

  shouldIgnoreFormControl(input) {
    if (input.tagName !== 'INPUT') {
      return false;
    }

    return ['image', 'submit', 'reset', 'button', 'hidden'].includes((input.type || '').toLowerCase());
  }

  hasAccessibleFormLabel(input) {
    const ariaLabel = input.getAttribute('aria-label');
    if (typeof ariaLabel === 'string' && ariaLabel.trim().length > 0) {
      return true;
    }

    const title = input.getAttribute('title');
    if (typeof title === 'string' && title.trim().length > 0) {
      return true;
    }

    if (this.hasAssociatedLabelElement(input)) {
      return true;
    }

    return this.hasAriaLabelledByText(input);
  }

  hasVisibleFormLabel(input) {
    return this.hasAssociatedLabelElement(input);
  }

  hasAssociatedLabelElement(input) {
    if (!input.labels || input.labels.length === 0) {
      return false;
    }

    return Array.from(input.labels).some((label) => {
      if (label.hidden || label.getAttribute('aria-hidden') === 'true' || !this.isVisible(label)) {
        return false;
      }

      if (label.textContent.trim().length === 0) {
        return false;
      }

      if (label.htmlFor) {
        return label.htmlFor === input.id;
      }

      const nestedControls = label.querySelectorAll('input, select, textarea');
      return nestedControls.length === 1 && nestedControls[0] === input;
    });
  }

  hasAriaLabelledByText(input) {
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    if (!ariaLabelledBy) {
      return false;
    }

    return ariaLabelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .some((element) => element && this.isVisible(element) && element.textContent.trim().length > 0);
  }

  isGenericLinkText(text) {
    const normalized = this.normalizeComparableText(text);
    return /^(clique aqui|leia mais|saiba mais|veja mais|acesse aqui|click here|read more|learn more|here)$/i.test(normalized);
  }

  getAccessibleLinkText(link) {
    const ariaLabel = link.getAttribute('aria-label');
    const title = link.getAttribute('title');
    const visibleText = link.textContent.trim();

    if (typeof ariaLabel === 'string' && ariaLabel.trim().length > 0) {
      return ariaLabel.trim();
    }

    if (visibleText.length > 0) {
      return visibleText;
    }

    if (typeof title === 'string' && title.trim().length > 0) {
      return title.trim();
    }

    const imageAltText = Array.from(link.querySelectorAll('img'))
      .map((img) => this.getImageAlternativeText(img))
      .find((text) => text.length > 0);

    return imageAltText || '';
  }

  isEmptyButton(button) {
    if (button.tagName === 'BUTTON') {
      if (button.textContent.trim().length > 0) {
        return false;
      }

      const informativeImage = Array.from(button.querySelectorAll('img')).some(
        (img) => this.getImageAlternativeText(img).length > 0
      );

      return !informativeImage;
    }

    const value = button.getAttribute('value');
    return !(typeof value === 'string' && value.trim().length > 0);
  }

  hasLinkedImageMissingAlt(link) {
    const images = Array.from(link.querySelectorAll('img'));
    if (images.length === 0) {
      return false;
    }

    return images.every((img) => this.getImageAlternativeText(img).length === 0 || this.isAriaHidden(img));
  }

  getImageAlternativeText(img) {
    if (!img.hasAttribute('alt')) {
      return '';
    }

    const alt = img.getAttribute('alt');
    return typeof alt === 'string' ? alt.trim() : '';
  }

  normalizeComparableText(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  parsePixelValue(value) {
    if (typeof value !== 'string') {
      return Number.NaN;
    }

    const match = value.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : Number.NaN;
  }

  getRedundantAdjacentText(img, altText) {
    const normalizedAlt = this.normalizeComparableText(altText);
    if (!normalizedAlt) {
      return null;
    }

    const candidates = this.getAdjacentTextCandidates(img);
    for (const candidate of candidates) {
      const normalizedCandidate = this.normalizeComparableText(candidate);

      if (!normalizedCandidate) {
        continue;
      }

      if (normalizedCandidate === normalizedAlt) {
        return candidate.trim();
      }

      if (normalizedCandidate.includes(normalizedAlt) && Math.abs(normalizedCandidate.length - normalizedAlt.length) <= 15) {
        return candidate.trim();
      }
    }

    return null;
  }

  getAdjacentTextCandidates(img) {
    const candidates = [];
    const siblingNodes = [img.previousSibling, img.nextSibling];
    const siblingElements = [img.previousElementSibling, img.nextElementSibling];

    siblingNodes.forEach((node) => {
      const text = this.getTextFromNode(node);
      if (text) {
        candidates.push(text);
      }
    });

    siblingElements.forEach((element) => {
      const text = this.getRelevantElementText(element);
      if (text) {
        candidates.push(text);
      }
    });

    if (img.parentElement) {
      const parentInlineText = Array.from(img.parentElement.childNodes)
        .filter((node) => node !== img && !(node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG'))
        .map((node) => this.getTextFromNode(node))
        .filter(Boolean)
        .join(' ')
        .trim();

      if (parentInlineText) {
        candidates.push(parentInlineText);
      }
    }

    return [...new Set(candidates)];
  }

  getTextFromNode(node) {
    if (!node) {
      return '';
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.replace(/\s+/g, ' ').trim();
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      return this.getRelevantElementText(node);
    }

    return '';
  }

  getRelevantElementText(element) {
    if (!(element instanceof Element)) {
      return '';
    }

    return element.textContent.replace(/\s+/g, ' ').trim();
  }

  getTitleComparisonText(element) {
    if (element.tagName === 'IMG') {
      return this.getImageAlternativeText(element);
    }

    const text = this.getRelevantElementText(element);
    if (text.length > 0) {
      return text;
    }

    const imageAltText = Array.from(element.querySelectorAll('img'))
      .map((img) => this.getImageAlternativeText(img))
      .find((value) => value.length > 0);

    if (imageAltText) {
      return imageAltText;
    }

    const ariaLabel = element.getAttribute('aria-label');
    return typeof ariaLabel === 'string' ? ariaLabel.trim() : '';
  }

  isAriaHidden(element) {
    return element.getAttribute('aria-hidden') === 'true';
  }

  /**
   * Calcula luminância relativa
   */
  getLuminance(rgb) {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Avalia HTML semântico
   */
  evaluateSemanticHTML() {
    const divs = document.querySelectorAll('div[role]');
    let divRoleCount = 0;

    divs.forEach(div => {
      if (div.getAttribute('role') === 'button' || div.getAttribute('role') === 'link') {
        divRoleCount++;
      }
    });

    if (divs.length > 0 && divRoleCount > divs.length * 0.3) {
      this.issues.push({
        type: 'excessive-div-roles',
        severity: 'warning',
        criterion: this.wcagCriteria['semantic-html'],
        message: 'Muitos divs com roles - considere usar elementos semânticos',
        requires_llm: false
      });
    }
  }

  /**
   * Avalia declaração de idioma
   */
  evaluateLanguage() {
    const htmlElement = document.documentElement;
    const lang = htmlElement.getAttribute('lang');

    if (!lang) {
      this.issues.push({
        type: 'no-language-declared',
        severity: 'warning',
        criterion: this.wcagCriteria['language-declaration'],
        message: 'Página não declara o idioma principal',
        requires_llm: false
      });
    }
  }

  /**
   * Avalia título da página
   */
  evaluatePageTitle() {
    const title = document.title;

    if (!title || title.length === 0) {
      this.issues.push({
        type: 'no-page-title',
        severity: 'critical',
        criterion: this.wcagCriteria['page-title'],
        message: 'Página não possui título',
        requires_llm: false
      });
    } else if (title.length < 5) {
      this.issues.push({
        type: 'page-title-too-short',
        severity: 'warning',
        criterion: this.wcagCriteria['page-title'],
        message: `Título da página muito curto: "${title}"`,
        requires_llm: false
      });
    }
  }

  /**
   * Avalia navegação por teclado
   */
  evaluateKeyboardNavigation() {
    const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
    let focusableCount = 0;

    interactiveElements.forEach(element => {
      const tabindex = element.getAttribute('tabindex');
      if (tabindex && parseInt(tabindex) > 0) {
        focusableCount++;
      }
    });

    if (focusableCount > interactiveElements.length * 0.5) {
      this.issues.push({
        type: 'excessive-positive-tabindex',
        severity: 'warning',
        criterion: this.wcagCriteria['keyboard-navigation'],
        message: 'Muitos elementos com tabindex positivo - pode prejudicar navegação',
        requires_llm: false
      });
    }
  }

  /**
   * Avalia indicadores de foco
   */
  evaluateFocusIndicators() {
    const style = document.createElement('style');
    const hasOutlineRemoval = this.checkForOutlineRemoval();

    if (hasOutlineRemoval) {
      this.issues.push({
        type: 'focus-outline-removed',
        severity: 'critical',
        criterion: this.wcagCriteria['focus-indicator'],
        message: 'Outline de foco foi removido sem substituição',
        requires_llm: false
      });
    }
  }

  /**
   * Verifica se outline foi removido
   */
  checkForOutlineRemoval() {
    return this.checkStylesheetOutlineRemoval() || this.checkInlineOutlineRemoval();
  }

  checkStylesheetOutlineRemoval() {
    const sheets = document.styleSheets;
    try {
      for (let sheet of sheets) {
        const rules = sheet.cssRules || sheet.rules;
        for (let rule of rules) {
          if (rule.selectorText && /:focus(-visible)?/.test(rule.selectorText)) {
            const outline = rule.style.outline || rule.style.outlineStyle;
            if (outline === 'none' || outline === '0') {
              return true;
            }
          }
        }
      }
    } catch (e) {
      // Pode falhar com CORS
    }
    return false;
  }

  checkInlineOutlineRemoval() {
    const elements = document.querySelectorAll('[style*="outline"]');
    for (const element of elements) {
      const inlineStyle = element.getAttribute('style') || '';
      if (/outline(-style)?\s*:\s*(none|0)\b/i.test(inlineStyle)) {
        return true;
      }
    }
    return false;
  }

  evaluateNonTextAlternatives() {
    document.querySelectorAll('svg').forEach((svg, index) => {
      if (!this.isVisible(svg) || this.isAriaHidden(svg) || svg.closest('[aria-hidden="true"]')) {
        return;
      }

      const parentControl = svg.closest('a, button, [role="button"], [role="link"]');
      if (parentControl && this.getRelevantElementText(parentControl).replace(svg.textContent, '').trim().length > 0) {
        return;
      }

      if (this.hasAccessibleGraphicName(svg)) {
        return;
      }

      this.issues.push({
        type: 'svg-missing-name',
        element: svg,
        severity: parentControl ? 'critical' : 'warning',
        criterion: this.wcagCriteria['text-alternatives'],
        message: `SVG ${index + 1} sem nome acessível`,
        element_html: svg.outerHTML.substring(0, 100),
        requires_llm: false
      });
    });

    document.querySelectorAll('input[type="image"]').forEach((input, index) => {
      const alt = input.getAttribute('alt');
      if (typeof alt === 'string' && alt.trim().length > 0) {
        return;
      }

      this.issues.push({
        type: 'input-image-missing-alt',
        element: input,
        severity: 'critical',
        criterion: this.wcagCriteria['text-alternatives'],
        message: `Botão de imagem ${index + 1} sem alt`,
        element_html: input.outerHTML.substring(0, 100),
        requires_llm: false
      });
    });

    document.querySelectorAll('area').forEach((area, index) => {
      const alt = area.getAttribute('alt');
      if (typeof alt === 'string') {
        return;
      }

      this.issues.push({
        type: 'area-missing-alt',
        element: area,
        severity: 'critical',
        criterion: this.wcagCriteria['text-alternatives'],
        message: `Área de mapa de imagem ${index + 1} sem alt`,
        element_html: area.outerHTML.substring(0, 100),
        requires_llm: false
      });
    });
  }

  hasAccessibleGraphicName(element) {
    const ariaLabel = element.getAttribute('aria-label');
    if (typeof ariaLabel === 'string' && ariaLabel.trim().length > 0) {
      return true;
    }

    if (element.getAttribute('role') === 'presentation' || element.getAttribute('role') === 'none') {
      return true;
    }

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy && labelledBy.split(/\s+/).some((id) => document.getElementById(id)?.textContent.trim())) {
      return true;
    }

    const title = element.querySelector('title');
    return !!(title && title.textContent.trim().length > 0);
  }

  evaluateTables() {
    document.querySelectorAll('table').forEach((table, index) => {
      if (!this.isVisible(table) || this.isAriaHidden(table) || table.closest('[aria-hidden="true"]')) {
        return;
      }

      if (table.getAttribute('role') === 'presentation' || table.getAttribute('role') === 'none') {
        return;
      }

      const rows = table.querySelectorAll('tr');
      if (rows.length < 2) {
        return;
      }

      const hasHeaders = table.querySelectorAll('th').length > 0;
      const hasScope = table.querySelectorAll('[scope]').length > 0;
      const hasHeadersAttr = table.querySelectorAll('[headers]').length > 0;

      if (!hasHeaders && !hasScope && !hasHeadersAttr) {
        this.issues.push({
          type: 'table-missing-headers',
          element: table,
          severity: 'critical',
          criterion: this.wcagCriteria['data-tables'],
          message: `Tabela ${index + 1} sem cabeçalhos semânticos (th)`,
          element_html: table.outerHTML.substring(0, 120),
          requires_llm: false,
          row_count: rows.length
        });
      }
    });
  }

  evaluateClickableNonSemantic() {
    document.querySelectorAll('[onclick]').forEach((element, index) => {
      const tag = element.tagName;
      if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'LABEL'].includes(tag)) {
        return;
      }

      if (!this.isVisible(element)) {
        return;
      }

      const tabindex = element.getAttribute('tabindex');
      const role = (element.getAttribute('role') || '').toLowerCase();
      const hasKeyboardSupport = tabindex !== null && tabindex !== '-1';
      const hasInteractiveRole = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'switch'].includes(role);

      if (hasKeyboardSupport && hasInteractiveRole) {
        return;
      }

      this.issues.push({
        type: 'clickable-non-semantic',
        element,
        severity: 'critical',
        criterion: this.wcagCriteria['keyboard-navigation'],
        message: `Elemento ${tag.toLowerCase()} ${index + 1} é clicável, mas não é acessível por teclado`,
        element_html: element.outerHTML.substring(0, 100),
        requires_llm: false
      });
    });
  }

  evaluateBypassBlocks() {
    const hasSkipLink = Array.from(document.querySelectorAll('a[href^="#"]')).some((link) => {
      const text = `${this.getAccessibleLinkText(link)} ${link.getAttribute('href') || ''}`.toLowerCase();
      return /pular|skip|ir para o conte[uú]do|jump to|main-content|conteudo-principal/.test(text);
    });
    const hasMain = !!document.querySelector('main, [role="main"]');

    if (!hasSkipLink && !hasMain) {
      this.issues.push({
        type: 'no-bypass-blocks',
        severity: 'warning',
        criterion: this.wcagCriteria['bypass-blocks'],
        message: 'Página sem skip link e sem região main para pular blocos repetidos',
        requires_llm: false
      });
    }
  }

  evaluateIframes() {
    document.querySelectorAll('iframe').forEach((iframe, index) => {
      const title = iframe.getAttribute('title');
      const ariaLabel = iframe.getAttribute('aria-label');
      const hasName = (typeof title === 'string' && title.trim().length > 0)
        || (typeof ariaLabel === 'string' && ariaLabel.trim().length > 0);

      if (!hasName) {
        this.issues.push({
          type: 'iframe-missing-title',
          element: iframe,
          severity: 'critical',
          criterion: this.wcagCriteria['iframe-title'],
          message: `iframe ${index + 1} sem título acessível`,
          element_html: iframe.outerHTML.substring(0, 100),
          requires_llm: false,
          iframe_src: iframe.getAttribute('src')
        });
      }
    });
  }

  evaluateColorOnlyLinks() {
    document.querySelectorAll('a[href]').forEach((link) => {
      if (!this.isVisible(link) || !link.closest('p, li, td, th, article, blockquote, dd')) {
        return;
      }

      const style = window.getComputedStyle(link);
      const parent = link.parentElement;
      if (!parent) {
        return;
      }

      const parentStyle = window.getComputedStyle(parent);
      const decoration = `${style.textDecorationLine || ''} ${style.textDecoration || ''}`.toLowerCase();
      const hasUnderline = decoration.includes('underline') || parseFloat(style.borderBottomWidth) > 0;
      const colorDiffers = style.color !== parentStyle.color;

      if (colorDiffers && !hasUnderline) {
        this.issues.push({
          type: 'color-only-link',
          element: link,
          severity: 'warning',
          criterion: this.wcagCriteria['use-of-color'],
          message: 'Link no texto distinguido apenas por cor',
          element_html: link.outerHTML.substring(0, 100),
          requires_llm: false
        });
      }
    });
  }

  evaluateDuplicateIds() {
    const seen = new Map();

    document.querySelectorAll('[id]').forEach((element) => {
      const id = element.id;
      if (!id) {
        return;
      }

      if (seen.has(id)) {
        this.issues.push({
          type: 'duplicate-id',
          element,
          severity: 'critical',
          criterion: this.wcagCriteria['duplicate-ids'],
          message: `ID duplicado: "${id}"`,
          element_html: element.outerHTML.substring(0, 100),
          requires_llm: false,
          id
        });
      } else {
        seen.set(id, element);
      }
    });
  }

  evaluateViewportZoom() {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      return;
    }

    const content = (viewport.getAttribute('content') || '').toLowerCase();
    const blocksZoom = /user-scalable\s*=\s*no/.test(content)
      || /user-scalable\s*=\s*0/.test(content)
      || /maximum-scale\s*=\s*1(\.0+)?(\s|,|$)/.test(content);

    if (blocksZoom) {
      this.issues.push({
        type: 'zoom-restricted',
        element: viewport,
        severity: 'critical',
        criterion: this.wcagCriteria['resize-text'],
        message: 'Viewport impede redimensionar texto (user-scalable=no ou maximum-scale=1)',
        element_html: viewport.outerHTML.substring(0, 120),
        requires_llm: false
      });
    }
  }

  evaluateInputPurpose() {
    const purposeMap = [
      { pattern: /(^|[_-])e-?mail($|[_-])/i, autocomplete: 'email', types: ['email', 'text'] },
      { pattern: /(^|[_-])(tel|phone|fone|celular)($|[_-])/i, autocomplete: 'tel', types: ['tel', 'text'] },
      { pattern: /(^|[_-])(name|nome)($|[_-])/i, autocomplete: 'name', types: ['text'] },
      { pattern: /(given-name|first[_-]?name|primeiro[_-]?nome)/i, autocomplete: 'given-name', types: ['text'] },
      { pattern: /(family-name|last[_-]?name|sobrenome)/i, autocomplete: 'family-name', types: ['text'] }
    ];

    const flagged = new Set();

    document.querySelectorAll('input').forEach((input) => {
      if (this.shouldIgnoreFormControl(input) || !this.isVisible(input) || flagged.has(input)) {
        return;
      }

      const type = (input.type || 'text').toLowerCase();
      const identity = `${input.getAttribute('name') || ''} ${input.id || ''}`;
      const currentAutocomplete = (input.getAttribute('autocomplete') || '').trim();

      if (currentAutocomplete) {
        return;
      }

      let suggested = null;
      if (type === 'email') {
        suggested = 'email';
      } else {
        const match = purposeMap.find(({ pattern, types }) => types.includes(type) && pattern.test(identity));
        suggested = match?.autocomplete || null;
      }

      if (!suggested) {
        return;
      }

      flagged.add(input);
      this.issues.push({
        type: 'missing-autocomplete',
        element: input,
        severity: 'warning',
        criterion: this.wcagCriteria['input-purpose'],
        message: `Campo provavelmente de ${suggested} sem autocomplete`,
        element_html: input.outerHTML.substring(0, 100),
        requires_llm: false,
        suggested_autocomplete: suggested
      });
    });
  }

  evaluateLabelInName() {
    document.querySelectorAll('[aria-label]').forEach((element) => {
      const visibleText = this.getRelevantElementText(element);
      const ariaLabel = this.normalizeComparableText(element.getAttribute('aria-label'));
      const visible = this.normalizeComparableText(visibleText);

      if (!visible || visible.length < 2 || !ariaLabel) {
        return;
      }

      if (!ariaLabel.includes(visible) && !visible.includes(ariaLabel)) {
        this.issues.push({
          type: 'label-in-name-mismatch',
          element,
          severity: 'warning',
          criterion: this.wcagCriteria['label-in-name'],
          message: `aria-label não contém o texto visível: "${visibleText.slice(0, 80)}"`,
          element_html: element.outerHTML.substring(0, 100),
          requires_llm: false,
          element_text: visibleText.slice(0, 160)
        });
      }
    });
  }

  evaluateNonTextContrast() {
    const controls = document.querySelectorAll('button, input, select, textarea, a[href], [role="button"]');
    let checkedCount = 0;

    controls.forEach((element) => {
      if (checkedCount > 80 || !this.isVisible(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const borderWidth = parseFloat(style.borderTopWidth) || 0;
      const ownBackground = style.backgroundColor;
      const hasOwnOpaqueBackground = this.isOpaqueColor(ownBackground);
      if (!hasOwnOpaqueBackground && borderWidth === 0) {
        return;
      }

      const background = hasOwnOpaqueBackground ? ownBackground : this.getEffectiveBackgroundColor(element);
      const parentBackground = element.parentElement
        ? this.getEffectiveBackgroundColor(element.parentElement)
        : 'rgb(255, 255, 255)';

      const backgroundContrast = this.calculateContrast(background, parentBackground);
      const borderColor = style.borderTopColor;
      const borderContrast = borderWidth > 0 ? this.calculateContrast(borderColor, parentBackground) : 0;
      const distinguishable = backgroundContrast >= 3 || borderContrast >= 3;

      if (!distinguishable && backgroundContrast > 0 && backgroundContrast < 3) {
        this.issues.push({
          type: 'low-non-text-contrast',
          element,
          severity: 'warning',
          criterion: this.wcagCriteria['non-text-contrast'],
          message: `Componente com contraste visual baixo (${backgroundContrast.toFixed(2)}:1, mínimo 3:1)`,
          element_html: element.outerHTML.substring(0, 100),
          requires_llm: false,
          contrast_ratio: backgroundContrast,
          minimum_contrast: 3,
          background_color: background,
          foreground_color: borderColor
        });
      }

      checkedCount++;
    });
  }

  evaluateReadingOrder() {
    const positioned = document.querySelectorAll('*');
    let flagged = 0;

    positioned.forEach((element) => {
      if (flagged > 20 || !this.isVisible(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const order = parseInt(style.order, 10);
      if (Number.isFinite(order) && order !== 0) {
        this.issues.push({
          type: 'css-order-mismatch',
          element,
          severity: 'warning',
          criterion: this.wcagCriteria['meaningful-sequence'],
          message: `CSS order=${order} pode inverter a sequência de leitura em relação ao DOM`,
          element_html: element.outerHTML.substring(0, 100),
          requires_llm: false
        });
        flagged++;
      }
    });
  }

  evaluateAutoplayMedia() {
    document.querySelectorAll('audio[autoplay], video[autoplay]').forEach((media, index) => {
      if (media.hasAttribute('muted') || media.muted) {
        return;
      }

      const isVideo = media.tagName === 'VIDEO';
      this.issues.push({
        type: 'autoplay-media-no-control',
        element: media,
        severity: 'critical',
        criterion: this.wcagCriteria['audio-control'],
        message: `${isVideo ? 'Vídeo' : 'Áudio'} ${index + 1} com autoplay e som, sem controles para pausar`,
        element_html: media.outerHTML.substring(0, 100),
        requires_llm: false,
        has_controls: media.hasAttribute('controls')
      });
    });
  }

  evaluateNewTabLinks() {
    document.querySelectorAll('a[target="_blank"][href]').forEach((link) => {
      const accessibleName = this.getAccessibleLinkText(link);
      const normalized = this.normalizeComparableText(accessibleName);

      if (!normalized || /nova aba|nova janela|new tab|new window|abre em/.test(normalized)) {
        return;
      }

      this.issues.push({
        type: 'new-tab-link-no-warning',
        element: link,
        severity: 'warning',
        criterion: this.wcagCriteria['link-text'],
        message: 'Link abre em nova aba sem avisar o usuário',
        element_html: link.outerHTML.substring(0, 100),
        requires_llm: false
      });
    });
  }

  hasAccessibleLandmarkLabel(element) {
    const ariaLabel = element.getAttribute('aria-label');
    if (typeof ariaLabel === 'string' && ariaLabel.trim().length > 0) {
      return true;
    }

    const labelledBy = element.getAttribute('aria-labelledby');
    if (!labelledBy) {
      return false;
    }

    return labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .some((id) => document.getElementById(id)?.textContent.trim().length > 0);
  }

  evaluateDuplicateLandmarks() {
    const groups = {
      navigation: document.querySelectorAll('nav, [role="navigation"]'),
      complementary: document.querySelectorAll('aside, [role="complementary"]')
    };

    Object.entries(groups).forEach(([roleName, elements]) => {
      if (elements.length < 2) {
        return;
      }

      elements.forEach((element, index) => {
        if (this.hasAccessibleLandmarkLabel(element)) {
          return;
        }

        this.issues.push({
          type: 'duplicate-landmark-no-label',
          element,
          index,
          severity: 'warning',
          criterion: this.wcagCriteria['page-regions'],
          message: `Landmark "${roleName}" repetido (${index + 1}/${elements.length}) sem aria-label para diferenciar`,
          element_html: element.outerHTML.substring(0, 100),
          requires_llm: false,
          landmark_role: roleName
        });
      });
    });
  }

  evaluateInfiniteAnimations() {
    const elements = document.querySelectorAll('*');
    let flagged = 0;

    elements.forEach((element) => {
      if (flagged > 20 || !this.isVisible(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const duration = this.parsePixelValue(style.animationDuration) || 0;
      const hasInfiniteAnimation = duration > 0
        && style.animationIterationCount
          .split(',')
          .some((value) => value.trim() === 'infinite');

      if (!hasInfiniteAnimation) {
        return;
      }

      this.issues.push({
        type: 'infinite-animation-no-reduced-motion',
        element,
        severity: 'warning',
        criterion: this.wcagCriteria['animation-control'],
        message: 'Animação CSS contínua (infinite) sem respeitar prefers-reduced-motion',
        element_html: element.outerHTML.substring(0, 100),
        requires_llm: false
      });
      flagged++;
    });
  }

  evaluateCaptcha() {
    const selectors = [
      'iframe[src*="recaptcha" i]',
      'iframe[src*="hcaptcha" i]',
      'iframe[title*="captcha" i]',
      '[class*="captcha" i]',
      '[id*="captcha" i]'
    ];
    const seen = new Set();

    document.querySelectorAll(selectors.join(', ')).forEach((element) => {
      if (seen.has(element) || !this.isVisible(element)) {
        return;
      }
      seen.add(element);

      this.issues.push({
        type: 'captcha-detected',
        element,
        severity: 'critical',
        criterion: this.wcagCriteria['captcha-alternative'],
        message: 'CAPTCHA detectado - requer alternativa acessível (ex.: áudio) e revisão manual',
        element_html: element.outerHTML.substring(0, 100),
        requires_llm: false
      });
    });
  }

  findNearbyErrorText(field) {
    const errorSelector = ':scope > [role="alert"], :scope > .error, :scope > .invalid-feedback, '
      + ':scope > .field-error, :scope > .error-message, :scope > small.error, :scope > span.error';
    const scopes = [field.parentElement, field.parentElement?.parentElement].filter(Boolean);

    for (const scope of scopes) {
      const candidate = scope.querySelector(errorSelector);
      if (candidate && candidate !== field && this.isVisible(candidate) && candidate.textContent.trim().length >= 3) {
        return candidate;
      }
    }

    const sibling = field.nextElementSibling;
    if (sibling) {
      const identity = `${sibling.className || ''} ${sibling.id || ''}`.toLowerCase();
      if (/error|invalid|erro|inv[aá]lid/.test(identity) && this.isVisible(sibling) && sibling.textContent.trim().length >= 3) {
        return sibling;
      }
    }

    return null;
  }

  evaluateUnlinkedFieldErrors() {
    document.querySelectorAll('input, textarea, select').forEach((field) => {
      if (this.shouldIgnoreFormControl(field) || !this.isVisible(field)) {
        return;
      }

      const errorElement = this.findNearbyErrorText(field);
      if (!errorElement) {
        return;
      }

      const describedBy = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      const alreadyLinked = errorElement.id && describedBy.includes(errorElement.id);
      if (alreadyLinked) {
        return;
      }

      this.issues.push({
        type: 'form-error-not-announced',
        element: field,
        severity: 'critical',
        criterion: this.wcagCriteria['form-labels'],
        message: 'Campo com mensagem de erro visível não associada via aria-describedby',
        element_html: field.outerHTML.substring(0, 100),
        requires_llm: false
      });
    });
  }

  evaluateMetaRefresh() {
    const meta = document.querySelector('meta[http-equiv="refresh" i]');
    if (!meta) {
      return;
    }

    const content = (meta.getAttribute('content') || '').trim();
    const delayMatch = content.match(/^(\d+)/);
    const delay = delayMatch ? parseInt(delayMatch[1], 10) : 0;

    if (delay <= 0) {
      return;
    }

    this.issues.push({
      type: 'meta-refresh-redirect',
      element: meta,
      severity: delay < 20 ? 'critical' : 'warning',
      criterion: this.wcagCriteria['timing-adjustable'],
      message: `Página redireciona/atualiza automaticamente após ${delay}s sem controle do usuário`,
      element_html: meta.outerHTML.substring(0, 120),
      requires_llm: false
    });
  }

  /**
   * Link para #algo cujo alvo (id ou <a name="algo">) não existe na página. Não dá
   * para adivinhar com segurança qual deveria ser o alvo certo, então isso é só
   * detectado (fica para revisão humana), nunca corrigido automaticamente.
   */
  evaluateBrokenSamePageLinks() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      const fragment = decodeURIComponent((link.getAttribute('href') || '').slice(1)).trim();
      if (!fragment) {
        return;
      }

      const hasTarget = !!document.getElementById(fragment)
        || !!document.querySelector(`a[name="${CSS.escape(fragment)}"]`);

      if (hasTarget) {
        return;
      }

      this.issues.push({
        type: 'broken-same-page-link',
        element: link,
        severity: 'warning',
        criterion: this.wcagCriteria['link-text'],
        message: `Link para #${fragment} não tem elemento correspondente na página`,
        element_html: link.outerHTML.substring(0, 100),
        requires_llm: false
      });
    });
  }

  /**
   * Texto sublinhado fora de um link pode ser confundido com link clicável (é
   * exatamente o motivo do sublinhado ser convenção de link). Diferente do link só
   * por cor (evaluateColorOnlyLinks, que adiciona sublinhado), aqui é o oposto:
   * remover o sublinhado de texto que não é link.
   */
  evaluateUnderlinedNonLinkText() {
    const candidates = document.querySelectorAll('u, span, strong, em, b, i, small, p, li, td, th, div, label');
    let flagged = 0;

    candidates.forEach((element) => {
      if (flagged > 30 || !this.isVisible(element)) {
        return;
      }

      if (element.closest('a, [role="link"], button, [role="button"], ins')) {
        return;
      }

      if (!this.hasDirectTextContent(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const decoration = `${style.textDecorationLine || ''} ${style.textDecoration || ''}`.toLowerCase();
      if (!decoration.includes('underline')) {
        return;
      }

      this.issues.push({
        type: 'underlined-non-link-text',
        element,
        severity: 'warning',
        criterion: this.wcagCriteria['use-of-color'],
        message: 'Texto sublinhado fora de um link pode ser confundido com link clicável',
        element_html: element.outerHTML.substring(0, 100),
        requires_llm: false
      });
      flagged++;
    });
  }

  /**
   * Agrupa problemas por tipo
   */
  groupIssuesByType() {
    const grouped = {};
    this.issues.forEach(issue => {
      if (!grouped[issue.type]) {
        grouped[issue.type] = [];
      }
      grouped[issue.type].push(issue);
    });
    return grouped;
  }

  /**
   * Retorna resumo dos problemas
   */
  getSummary() {
    const critical = this.issues.filter(i => i.severity === 'critical').length;
    const warnings = this.issues.filter(i => i.severity === 'warning').length;
    const requiresLLM = this.issues.filter(i => i.requires_llm).length;

    return {
      total: this.issues.length,
      critical,
      warnings,
      requiresLLM,
      issues: this.issues
    };
  }
}

// Exportar para uso em content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WCAGEvaluator;
}
