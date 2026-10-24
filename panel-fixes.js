/**
 * Correções que o painel soma às recomendações da IA antes de aplicar ("Aplicar" do
 * painel). Ficam aqui, fora do popup.js, para o painel e o gancho de automação (C11)
 * montarem exatamente o mesmo payload. Carregado pelo popup.html e, no service worker,
 * via importScripts. Só depende de analysisResult.summary.issues (sem DOM).
 */

class AccessifyPanelFixes {
  constructor(analysisResult) {
    this.analysisResult = analysisResult || null;
  }

  /**
   * Combina recomendações da IA com alt texts gerados para aplicação.
   */
  combineOptimizations(optimizations, imageAltResults) {
    // `origin` só alimenta o log estruturado (C10): quem aplica ignora o campo.
    const imageAlts = imageAltResults.map(({ index, alt, source }) => ({ index, alt, origin: source || 'llm' }));
    const textChanges = [...(optimizations?.textChanges || [])];
    const ariaLabels = [...(optimizations?.ariaLabels || [])];
    const structureChanges = [...(optimizations?.structureChanges || [])];

    this.buildDefaultSpacerImageFixes().forEach((fix) => {
      const hasImageAlt = imageAlts.some((imageAlt) => imageAlt.index === fix.index);
      if (!hasImageAlt) {
        imageAlts.push({ ...fix, origin: 'painel' });
      }
    });

    this.buildDefaultEmptyLinkFixes().forEach((fix) => {
      const hasTextChange = textChanges.some((change) => change.selector === fix.selector);
      if (!hasTextChange) {
        textChanges.push({
          selector: fix.selector,
          text: fix.text,
          reason: 'Fallback automático para link vazio',
          origin: 'painel'
        });
      }

      const hasAriaLabel = ariaLabels.some((label) => label.selector === fix.selector);
      if (!hasAriaLabel) {
        ariaLabels.push({
          selector: fix.selector,
          label: fix.text,
          role: null,
          origin: 'painel'
        });
      }
    });

    this.buildDefaultEmptyButtonFixes().forEach((fix) => {
      if (fix.text) {
        const hasTextChange = textChanges.some((change) => change.selector === fix.selector);
        if (!hasTextChange) {
          textChanges.push({
            selector: fix.selector,
            text: fix.text,
            reason: 'Fallback automático para botão vazio',
            origin: 'painel'
          });
        }
      }

      if (fix.attributes) {
        const hasStructureChange = structureChanges.some((change) => change.selector === fix.selector);
        if (!hasStructureChange) {
          structureChanges.push({
            selector: fix.selector,
            newTag: null,
            attributes: fix.attributes,
            reason: 'Fallback automático para botão vazio',
            origin: 'painel'
          });
        }
      }

      const hasAriaLabel = ariaLabels.some((label) => label.selector === fix.selector);
      if (!hasAriaLabel) {
        ariaLabels.push({
          selector: fix.selector,
          label: fix.label,
          role: null,
          origin: 'painel'
        });
      }
    });

    this.buildDefaultRedundantTitleFixes().forEach((fix) => {
      const hasStructureChange = structureChanges.some((change) => {
        return change.selector === fix.selector
          && change.attributes
          && Object.prototype.hasOwnProperty.call(change.attributes, 'title');
      });

      if (!hasStructureChange) {
        structureChanges.push({
          selector: fix.selector,
          newTag: null,
          attributes: { title: null },
          reason: 'Fallback automático para title redundante',
          origin: 'painel'
        });
      }
    });

    this.buildDefaultRedundantImageAltFixes().forEach((fix) => {
      const existingIndex = imageAlts.findIndex((imageAlt) => imageAlt.index === fix.index);
      if (existingIndex >= 0) {
        imageAlts.splice(existingIndex, 1, { ...fix, origin: 'painel' });
      } else {
        imageAlts.push({ ...fix, origin: 'painel' });
      }
    });

    this.buildDefaultMissingFormLabelFixes().forEach((fix) => {
      const hasStructureChange = structureChanges.some((change) => change.selector === fix.selector);
      if (!hasStructureChange) {
        structureChanges.push({
          selector: fix.selector,
          newTag: null,
          attributes: fix.attributes,
          reason: 'Fallback automático para campo sem label',
          origin: 'painel'
        });
      }

      const hasAriaLabel = ariaLabels.some((label) => label.selector === fix.selector);
      if (!hasAriaLabel) {
        ariaLabels.push({
          selector: fix.selector,
          label: fix.label,
          role: null,
          origin: 'painel'
        });
      }
    });

    this.buildDefaultAriaHiddenFixes().forEach((fix) => {
      const hasStructureChange = structureChanges.some((change) => {
        return change.selector === fix.selector
          && change.attributes
          && Object.prototype.hasOwnProperty.call(change.attributes, 'aria-hidden');
      });

      if (!hasStructureChange) {
        structureChanges.push({
          selector: fix.selector,
          newTag: null,
          attributes: fix.attributes,
          reason: 'Fallback automático para conteúdo aria-hidden',
          origin: 'painel'
        });
      }
    });

    const fallbackStyles = [
      this.buildDefaultJustifiedTextStyles(),
      this.buildDefaultSmallTextStyles(),
      this.buildDefaultAriaHiddenStyles(),
      this.buildDefaultLowContrastTextStyles()
    ]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .join('\n');

    const styles = [optimizations?.styles, fallbackStyles]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .join('\n');

    const hasAiStyles = typeof optimizations?.styles === 'string' && optimizations.styles.trim().length > 0;
    const hasFallbackStyles = fallbackStyles.length > 0;

    return {
      ...optimizations,
      imageAlts: [...(optimizations?.imageAlts || []), ...imageAlts],
      structureChanges,
      textChanges,
      ariaLabels,
      styles,
      stylesOrigin: hasAiStyles && hasFallbackStyles ? 'llm+painel' : (hasFallbackStyles ? 'painel' : 'llm')
    };
  }

  /**
   * Gera correções padrão para links vazios.
   */
  buildDefaultEmptyLinkFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'link-no-text' && issue.selector)
      .map((issue, index) => ({
        selector: issue.selector,
        text: `Abrir link ${index + 1}`
      }));
  }

  /**
   * Gera correções padrão para imagens espaçadoras.
   */
  buildDefaultSpacerImageFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'spacer-image-missing-alt' && Number.isInteger(issue.index))
      .map((issue) => ({
        index: issue.index,
        alt: ''
      }));
  }

  /**
   * Gera correções padrão para botões vazios.
   */
  buildDefaultEmptyButtonFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'empty-button' && issue.selector)
      .map((issue, index) => {
        const label = `Acionar botão ${index + 1}`;

        if (issue.tagName === 'input') {
          return {
            selector: issue.selector,
            label,
            attributes: { value: label }
          };
        }

        return {
          selector: issue.selector,
          label,
          text: label
        };
      });
  }

  buildDefaultRedundantTitleFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'redundant-title-text' && issue.selector)
      .map((issue) => ({ selector: issue.selector }));
  }

  buildDefaultRedundantImageAltFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'redundant-image-alt' && Number.isInteger(issue.index))
      .map((issue) => ({
        index: issue.index,
        alt: ''
      }));
  }

  buildDefaultJustifiedTextStyles() {
    const issues = this.analysisResult?.summary?.issues || [];
    const selectors = issues
      .filter((issue) => issue.type === 'justified-text' && issue.selector)
      .map((issue) => issue.selector);

    if (selectors.length === 0) {
      return '';
    }

    return [...new Set(selectors)]
      .map((selector) => `${selector} { text-align: left !important; }`)
      .join('\n');
  }

  buildDefaultSmallTextStyles() {
    const issues = this.analysisResult?.summary?.issues || [];
    const selectors = issues
      .filter((issue) => issue.type === 'small-text' && issue.selector)
      .map((issue) => issue.selector);

    if (selectors.length === 0) {
      return '';
    }

    return [...new Set(selectors)]
      .map((selector) => `${selector} { font-size: 14px !important; line-height: 1.5 !important; }`)
      .join('\n');
  }

  buildDefaultAriaHiddenFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'aria-hidden-content' && issue.selector)
      .map((issue) => ({
        selector: issue.selector,
        attributes: {
          'aria-hidden': null,
          hidden: null,
          inert: null
        }
      }));
  }

  buildDefaultAriaHiddenStyles() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'aria-hidden-content' && issue.selector)
      .map((issue) => this.buildAriaHiddenContrastRule(issue))
      .filter(Boolean)
      .join('\n');
  }

  buildAriaHiddenContrastRule(issue) {
    return `${issue.selector} { visibility: visible !important; opacity: 1 !important; color: rgb(0, 0, 0) !important; background-color: rgb(255, 255, 255) !important; font-size: 14px !important; line-height: 1.5 !important; padding: 0.12em 0.25em !important; box-decoration-break: clone; -webkit-box-decoration-break: clone; }`;
  }

  buildDefaultLowContrastTextStyles() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'low-color-contrast' && issue.selector)
      .map((issue) => this.buildLowContrastRule(issue))
      .filter(Boolean)
      .join('\n');
  }

  buildLowContrastRule(issue) {
    const declarations = [];
    const currentFontSize = this.parsePixelValue(issue.font_size);
    const currentForeground = this.parseCssColor(issue.foreground_color);

    if (Number.isFinite(currentFontSize) && currentFontSize < 18) {
      declarations.push('font-size: 18px !important;');
      declarations.push('line-height: 1.5 !important;');
    }

    const fallbackBackground = this.getBetterContrastBackground(issue.foreground_color, issue.minimum_contrast);
    if (currentForeground && this.isLightColor(currentForeground) && fallbackBackground) {
      declarations.push(`background-color: ${fallbackBackground} !important;`);
      declarations.push('padding: 0.12em 0.25em !important;');
      declarations.push('box-decoration-break: clone;');
      declarations.push('-webkit-box-decoration-break: clone;');
    }

    const fallbackColor = this.getBetterContrastColor(issue.background_color, issue.foreground_color, issue.minimum_contrast);
    if (fallbackColor && !(currentForeground && this.isLightColor(currentForeground) && fallbackBackground)) {
      declarations.push(`color: ${fallbackColor} !important;`);
    }

    if (declarations.length === 0) {
      return '';
    }

    return `${issue.selector} { ${declarations.join(' ')} }`;
  }

  parsePixelValue(value) {
    if (typeof value !== 'string') {
      return Number.NaN;
    }

    const match = value.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : Number.NaN;
  }

  getBetterContrastColor(backgroundColor, foregroundColor, minimumContrast) {
    const background = this.parseCssColor(backgroundColor);
    if (!background) {
      return '';
    }

    const threshold = Number.isFinite(minimumContrast) ? minimumContrast : 4.5;
    const candidates = [
      { css: 'rgb(0, 0, 0)', rgb: { r: 0, g: 0, b: 0 } },
      { css: 'rgb(255, 255, 255)', rgb: { r: 255, g: 255, b: 255 } }
    ];

    const current = this.parseCssColor(foregroundColor);
    if (current) {
      const currentContrast = this.calculateContrastRatio(current, background);
      if (currentContrast >= threshold) {
        return '';
      }
    }

    const bestCandidate = candidates
      .map((candidate) => ({
        ...candidate,
        contrast: this.calculateContrastRatio(candidate.rgb, background)
      }))
      .sort((left, right) => right.contrast - left.contrast)[0];

    return bestCandidate && bestCandidate.contrast >= threshold ? bestCandidate.css : (bestCandidate?.css || '');
  }

  getBetterContrastBackground(foregroundColor, minimumContrast) {
    const foreground = this.parseCssColor(foregroundColor);
    if (!foreground) {
      return '';
    }

    const threshold = Number.isFinite(minimumContrast) ? minimumContrast : 4.5;
    const candidates = [
      { css: 'rgb(0, 0, 0)', rgb: { r: 0, g: 0, b: 0 } },
      { css: 'rgb(24, 24, 24)', rgb: { r: 24, g: 24, b: 24 } },
      { css: 'rgb(32, 32, 32)', rgb: { r: 32, g: 32, b: 32 } }
    ];

    const bestCandidate = candidates
      .map((candidate) => ({
        ...candidate,
        contrast: this.calculateContrastRatio(foreground, candidate.rgb)
      }))
      .sort((left, right) => right.contrast - left.contrast)[0];

    return bestCandidate && bestCandidate.contrast >= threshold ? bestCandidate.css : '';
  }

  parseCssColor(color) {
    if (typeof color !== 'string' || color.trim().length === 0) {
      return null;
    }

    const normalized = color.trim().toLowerCase();

    if (normalized.startsWith('rgb')) {
      const values = normalized.match(/[\d.]+/g);
      if (!values || values.length < 3) {
        return null;
      }

      return {
        r: parseFloat(values[0]),
        g: parseFloat(values[1]),
        b: parseFloat(values[2])
      };
    }

    if (normalized.startsWith('#')) {
      return this.parseHexColor(normalized);
    }

    return null;
  }

  parseHexColor(color) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }

    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }

    return null;
  }

  calculateContrastRatio(colorA, colorB) {
    const luminanceA = this.getRelativeLuminance(colorA);
    const luminanceB = this.getRelativeLuminance(colorB);
    const lighter = Math.max(luminanceA, luminanceB);
    const darker = Math.min(luminanceA, luminanceB);

    return (lighter + 0.05) / (darker + 0.05);
  }

  getRelativeLuminance(rgb) {
    const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  isLightColor(rgb) {
    return this.getRelativeLuminance(rgb) >= 0.5;
  }

  /**
   * Gera correções padrão para campos sem label.
   */
  buildDefaultMissingFormLabelFixes() {
    const issues = this.analysisResult?.summary?.issues || [];

    return issues
      .filter((issue) => issue.type === 'form-field-no-label' && issue.selector)
      .map((issue, index) => {
        const label = this.deriveFormFieldLabel(issue, index);

        return {
          selector: issue.selector,
          label,
          attributes: { title: label }
        };
      });
  }

  deriveFormFieldLabel(issue, index) {
    const candidates = [issue.placeholder, issue.name, issue.id]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .map((value) => this.humanizeFieldText(value));

    if (candidates.length > 0) {
      return candidates[0];
    }

    if (issue.input_type === 'email') {
      return 'E-mail';
    }

    if (issue.input_type === 'password') {
      return 'Senha';
    }

    if (issue.tagName === 'textarea') {
      return `Campo de texto ${index + 1}`;
    }

    if (issue.tagName === 'select') {
      return `Selecione uma opção ${index + 1}`;
    }

    return `Campo do formulário ${index + 1}`;
  }

  humanizeFieldText(value) {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^./, (char) => char.toUpperCase());
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.AccessifyPanelFixes = AccessifyPanelFixes;
}
