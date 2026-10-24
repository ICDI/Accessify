/**
 * Rótulos genéricos de fallback no DOM ("Abrir link N", "Acionar botão N", alt "Imagem"
 * etc.), contados pelo harness do mesmo jeito em todas as condições: a v1.0.0 não tem o
 * log estruturado (C10). rotulos_genericos = depois - antes, por tipo.
 */
export async function countGenericLabels(page) {
  return page.evaluate(() => {
    const matchesAttribute = (selector, attribute, pattern) => Array.from(document.querySelectorAll(selector))
      .filter((element) => pattern.test((element.getAttribute(attribute) || '').trim()));
    const matchesText = (selector, pattern) => Array.from(document.querySelectorAll(selector))
      .filter((element) => pattern.test((element.textContent || '').replace(/\s+/g, ' ').trim()));
    const unique = (...groups) => new Set(groups.flat()).size;

    const linkPattern = /^Abrir link \d+$/;
    const buttonPattern = /^Acionar botão \d+$/;
    const fieldPattern = /^(Campo do formulário|Campo de texto|Selecione uma opção) \d+$/;

    return {
      link: unique(matchesAttribute('[aria-label]', 'aria-label', linkPattern), matchesText('a', linkPattern)),
      button: unique(
        matchesAttribute('[aria-label]', 'aria-label', buttonPattern),
        matchesAttribute('input[value]', 'value', buttonPattern),
        matchesText('button', buttonPattern)
      ),
      field: unique(matchesAttribute('[aria-label]', 'aria-label', fieldPattern), matchesAttribute('[title]', 'title', fieldPattern)),
      image: document.querySelectorAll('img[alt="Imagem"]').length,
      graphic: document.querySelectorAll('svg[aria-label="Gráfico"]').length,
      iframe: document.querySelectorAll('iframe[title="Conteúdo incorporado"]').length,
      inputImage: document.querySelectorAll('input[type="image"][alt="Enviar"]').length,
      area: document.querySelectorAll('area[alt="Área do mapa"]').length,
      pageTitle: document.title === 'Página da web' ? 1 : 0
    };
  });
}

export function diffGenericLabels(before, after) {
  const byKind = {};
  let total = 0;
  Object.keys(after).forEach((kind) => {
    byKind[kind] = Math.max(0, (after[kind] || 0) - (before[kind] || 0));
    total += byKind[kind];
  });
  return { total, byKind };
}

/**
 * DOM pós para o JSON bruto, com o doctype real (uma página BackCompat continua
 * BackCompat se for reaberta) e os shadow roots, que o axe também avalia.
 */
export async function serializeDom(page) {
  return page.evaluate(() => {
    const shadowRoots = [];
    const collect = (root) => root.querySelectorAll('*').forEach((element) => {
      if (element.shadowRoot) {
        shadowRoots.push(element.shadowRoot);
        collect(element.shadowRoot);
      }
    });
    collect(document);
    const doctype = document.doctype ? new XMLSerializer().serializeToString(document.doctype) : '';
    const attributes = Array.from(document.documentElement.attributes)
      .map((attribute) => ` ${attribute.name}="${attribute.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
      .join('');
    const inner = typeof document.documentElement.getHTML === 'function'
      ? document.documentElement.getHTML({ serializableShadowRoots: true, shadowRoots })
      : document.documentElement.innerHTML;
    return `${doctype}${doctype ? '\n' : ''}<html${attributes}>${inner}</html>`;
  });
}
