/**
 * WCAG Accessibility Evaluator
 * Avalia a página contra as diretrizes WCAG 2.1
 */

class WCAGEvaluator {
  constructor() {
    this.issues = [];
    this.wcagCriteria = {
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
      }
    };
  }

  evaluate() {
    this.issues = [];
    this.evaluateImages();
    this.evaluateHeadings();
    this.evaluateForms();
    this.evaluateLinks();
    this.evaluateButtons();
    this.evaluateTitleAttributes();
    this.evaluateColorContrast();
    this.evaluateTextPresentation();
    this.evaluatePageRegions();
    this.evaluateSemanticHTML();
    this.evaluateAriaHidden();
    this.evaluateAriaReferences();
    this.evaluateLanguage();
    this.evaluatePageTitle();
    this.evaluateKeyboardNavigation();
    this.evaluateFocusIndicators();
    return this.issues;
  }

  evaluateImages() {
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
      const hasAltAttribute = img.hasAttribute('alt');
      const alt = img.getAttribute('alt');
      const normalizedAlt = typeof alt === 'string' ? alt.trim() : '';

      if (!hasAltAttribute) {
        if (this.isSpacerImage(img)) {
          this.issues.push({
            type: 'spacer-image-missing-alt',
            element: img,
            index,
            severity: 'warning',
            criterion: this.wcagCriteria['text-alternatives'],
            message: `Imagem espaçadora ${index + 1} sem alt vazio`,
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
      } else if (normalizedAlt.length > 100) {
        this.issues.push({
          type: 'image-alt-too-long',
          element: img,
          severity: 'warning',
          criterion: this.wcagCriteria['text-alternatives'],
          message: `Alt text da imagem é muito longo (${normalizedAlt.length} caracteres)`,
          element_html: img.outerHTML.substring(0, 100),
          requires_llm: true,
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
          requires_llm: true,
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
    }
  }

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
          requires_llm: false
        });
      }
    });
  }

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

      if (text && (text === 'clique aqui' || text === 'leia mais' || text === 'saiba mais')) {
        this.issues.push({
          type: 'link-generic-text',
          element: link,
          severity: 'warning',
          criterion: this.wcagCriteria['link-text'],
          message: `Link com texto genérico: "${text}"`,
          element_html: link.outerHTML.substring(0, 100),
          requires_llm: true
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

  evaluateColorContrast() {
    const elements = document.querySelectorAll('*');
    let checkedCount = 0;
    elements.forEach((element) => {
      if (checkedCount > 100) return;

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
          requires_llm: true,
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

  evaluateAriaReferences() {
    const elements = document.querySelectorAll('[aria-labelledby], [aria-describedby]');

    elements.forEach((element) => {
      ['aria-labelledby', 'aria-describedby'].forEach((attributeName) => {
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
    const title = input.getAttribute('title');

    if (typeof title === 'string' && title.trim().length > 0) {
      return true;
    }

    if (this.hasAssociatedLabelElement(input)) {
      return true;
    }

    return this.hasAriaLabelledByText(input);
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

  getLuminance(rgb) {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

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

  evaluateFocusIndicators() {
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

  checkForOutlineRemoval() {
    const sheets = document.styleSheets;
    try {
      for (let sheet of sheets) {
        const rules = sheet.cssRules || sheet.rules;
        for (let rule of rules) {
          if (rule.selectorText && rule.selectorText.includes(':focus')) {
            if (rule.style.outline === 'none' || rule.style.outline === '0') {
              return true;
            }
          }
        }
      }
    } catch (e) {}
    return false;
  }

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

/**
 * Content Script - Executado no contexto da página
 */

class AccessibilityAnalyzer {
  constructor() {
    this.evaluator = null;
    this.issues = [];
    this.optimizationSteps = [];
    this.currentStep = 0;
  }

  /**
   * Inicia a análise da página
   */
  async analyzePageForAccessibility() {
    try {
      // Criar instância do avaliador
      const evaluator = new WCAGEvaluator();
      this.evaluator = evaluator;
      
      // Executar avaliação
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
   * Extrai conteúdo relevante da página
   */
  extractPageContent() {
    return {
      title: document.title,
      url: window.location.href,
      html: document.documentElement.outerHTML.substring(0, 50000), // Limitar tamanho
      language: document.documentElement.getAttribute('lang') || 'pt-BR',
      images: Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.getAttribute('alt'),
        title: img.getAttribute('title')
      }))
    };
  }

  /**
   * Converte issues em objetos serializáveis e ricos em contexto.
   */
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
    }

    return serializedIssue;
  }

  /**
   * Gera um resumo serializável das issues detectadas.
   */
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

  /**
   * Gera seletor CSS estável para o elemento analisado.
   */
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

  /**
   * Extrai imagens para processamento
   */
  extractImages() {
    const images = [];
    const evaluator = this.evaluator || new WCAGEvaluator();
    document.querySelectorAll('img').forEach((img, index) => {
      if (evaluator.isSpacerImage(img)) {
        return;
      }

      if (!img.hasAttribute('alt')) {
        images.push({
          index,
          src: img.src,
          currentAlt: img.getAttribute('alt') || '',
          element: img
        });
      }
    });
    return images;
  }

  /**
   * Aplica otimizações à página
   */
  async applyOptimizations(optimizations) {
    try {
      let appliedCount = 0;
      const evaluator = this.evaluator || new WCAGEvaluator();

      document.querySelectorAll('img').forEach((img) => {
        if (evaluator.isSpacerImage(img) && !img.hasAttribute('alt')) {
          img.setAttribute('alt', '');
          appliedCount++;
        }
      });

      // Aplicar alt text em imagens
      if (optimizations.imageAlts) {
        optimizations.imageAlts.forEach(({ index, alt }) => {
          const images = document.querySelectorAll('img');
          if (images[index]) {
            images[index].setAttribute('alt', alt);
            images[index].setAttribute('role', 'img');
            appliedCount++;
          }
        });
      }

      // Aplicar melhorias de estrutura
      if (optimizations.structureChanges) {
        optimizations.structureChanges.forEach(change => {
          const element = this.resolveSelector(change.selector);
          if (element) {
            if (change.newTag) {
              const newElement = document.createElement(change.newTag);
              newElement.innerHTML = element.innerHTML;
              Object.keys(change.attributes || {}).forEach(key => {
                newElement.setAttribute(key, change.attributes[key]);
              });
              element.replaceWith(newElement);
              appliedCount++;
            } else if (change.attributes) {
              Object.keys(change.attributes).forEach(key => {
                const value = change.attributes[key];
                if (value === null || value === undefined) {
                  element.removeAttribute(key);
                } else {
                  element.setAttribute(key, value);
                }
              });
              appliedCount++;
            }
          }
        });
      }

      // Aplicar mudanças de texto visível
      if (optimizations.textChanges) {
        optimizations.textChanges.forEach(({ selector, text }) => {
          const element = this.resolveSelector(selector);
          if (element && typeof text === 'string' && text.trim().length > 0) {
            element.textContent = text;
            appliedCount++;
          }
        });
      }

      // Aplicar estilos de acessibilidade
      if (optimizations.styles) {
        const existingStyles = document.querySelectorAll('style[data-accessibility="true"]');
        existingStyles.forEach((style) => style.remove());

        const style = document.createElement('style');
        style.textContent = optimizations.styles;
        style.setAttribute('data-accessibility', 'true');
        document.head.appendChild(style);
        appliedCount++;
      }

      // Aplicar ARIA labels
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

      if (appliedCount === 0) {
        return {
          success: false,
          error: 'Nenhuma alteração aplicável foi encontrada para a página atual.'
        };
      }

      return { success: true, appliedCount };
    } catch (error) {
      console.error('Erro ao aplicar otimizações:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cria overlay de acessibilidade
   */
  createAccessibilityOverlay() {
    // Criar container para overlay
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

    // Adicionar conteúdo
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

    // Adicionar event listeners
    document.getElementById('wcag-close-overlay').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('wcag-cancel-btn').addEventListener('click', () => {
      overlay.remove();
    });

    return overlay;
  }

  /**
   * Atualiza display de etapas
   */
  updateStepsDisplay(steps) {
    const container = document.getElementById('wcag-steps-container');
    if (!container) return;

    container.innerHTML = '';
    steps.forEach((step, index) => {
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

  /**
   * Atualiza resumo
   */
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

// Criar instância global
window.accessibilityAnalyzer = new AccessibilityAnalyzer();

// Escutar mensagens do background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeAccessibility') {
    window.accessibilityAnalyzer.analyzePageForAccessibility()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indica que a resposta será enviada de forma assíncrona
  }

  if (request.action === 'extractImages') {
    sendResponse(window.accessibilityAnalyzer.extractImages());
    return false;
  }

  if (request.action === 'applyOptimizations') {
    window.accessibilityAnalyzer.applyOptimizations(request.optimizations)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
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
