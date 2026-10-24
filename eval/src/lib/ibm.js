import fs from 'node:fs';
import path from 'node:path';
import { EVAL_DIR } from './config.js';

const ENGINE_DIR = path.join(EVAL_DIR, 'node_modules', 'accessibility-checker-engine');
const LEVELS = ['violation', 'potentialviolation', 'recommendation', 'potentialrecommendation', 'manual'];
// Formato dos resultados guardados (chaves e campos de pareamento). Uma baseline gravada
// com outro formato não é comparada com um pós deste.
export const IBM_KEY_FORMAT = 3;
let engineSource = null;

/**
 * Nível do relatório a partir do valor da regra ([política, confiança]), com o mesmo
 * mapeamento do accessibility-checker: o motor sozinho não preenche `level`.
 */
export function ibmLevel([policy, confidence]) {
  if (confidence === 'PASS') {
    return 'pass';
  }
  if (policy === 'VIOLATION') {
    return { FAIL: 'violation', POTENTIAL: 'potentialviolation', MANUAL: 'manual' }[confidence] || 'information';
  }
  if (policy === 'RECOMMENDATION') {
    return { FAIL: 'recommendation', POTENTIAL: 'potentialrecommendation', MANUAL: 'manual' }[confidence] || 'information';
  }
  return 'information';
}

/**
 * Segundo avaliador do estudo (decisão D6): o motor do IBM Equal Access Accessibility
 * Checker (accessibility-checker-engine, Apache-2.0) no DOM pós. O motor é avaliado pelo
 * CDP (page.evaluate), então a CSP do replay (script-src 'none') não bloqueia a injeção.
 * Roda por último no run: deixa `ace` no escopo global da página. Avalia o documento
 * principal, os shadow roots abertos e os iframes da mesma origem (o motor entra em todo
 * iframe cujo documento consegue ler); iframes de outra origem ficam de fora (o axe entra
 * em todos os congelados).
 *
 * Uma regra pode devolver mais de um resultado para o mesmo elemento (um por atributo em
 * conflito, por exemplo): cada resultado conta. Para parear com a baseline, cada violação
 * leva a chave exata (regra, motivo, argumentos, XPath), o XPath sem os argumentos (eles
 * trazem valores medidos, como razão de contraste e tamanho da fonte, que mudam quando o
 * plugin mexe no estilo sem corrigir a violação), o trecho de HTML do elemento e um
 * caminho estrutural sem nomes de tag (o XPath do IBM muda quando o plugin troca a tag de
 * um ancestral, como td → th). Exceções de regras dentro do motor (que somem com os
 * resultados daquela regra no elemento) são contadas em ruleExceptions.
 */
export async function runIbm(page, ruleset) {
  engineSource = engineSource || fs.readFileSync(path.join(ENGINE_DIR, 'ace.js'), 'utf8');
  const ruleExceptions = [];
  const onConsole = (message) => {
    if (message.type() === 'error' && /RULE EXCEPTION/.test(message.text())) {
      ruleExceptions.push(message.text().slice(0, 300));
    }
  };
  page.on('console', onConsole);
  let report;
  try {
    await page.evaluate(`${engineSource};void 0`);
    report = await page.evaluate(async (policy) => {
      const result = await new ace.Checker().check(document, [policy]);
      // Caminho só com posições entre irmãos-elemento, atravessando shadow roots pelo host
      const structuralPath = (node) => {
        const parts = [];
        let current = node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
        while (current) {
          const parent = current.parentNode;
          if (!parent || parent.nodeType === Node.DOCUMENT_NODE) {
            parts.unshift('0');
            break;
          }
          parts.unshift(String(Array.prototype.indexOf.call(parent.children, current)));
          current = parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? parent.host : parent;
          if (parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            parts.unshift('#shadow');
          }
        }
        return parts.join('/');
      };
      const results = result.results || [];
      return {
        numExecuted: result.numExecuted ?? null,
        rulesWithResults: new Set(results.map((item) => item.ruleId)).size,
        ruleTime: result.ruleTime ?? null,
        results: results
          .filter((item) => item.value?.[1] !== 'PASS')
          .map((item) => ({
            ruleId: item.ruleId,
            reasonId: item.reasonId,
            messageArgs: item.messageArgs || [],
            value: item.value,
            xpath: item.path?.dom || null,
            snippet: typeof item.snippet === 'string' ? item.snippet.slice(0, 300) : null,
            structural: structuralPath(item.node)
          }))
      };
    }, ruleset);
  } finally {
    page.off('console', onConsole);
  }

  // Um conjunto de regras desconhecido não dá erro no motor: ele desliga todas as regras e
  // devolve zero resultados (nem os 'pass'), o que pareceria uma página perfeita
  if (!report.numExecuted) {
    throw new Error(`nenhum resultado do motor (conjunto de regras "${ruleset}" desconhecido?)`);
  }

  const byLevel = Object.fromEntries(LEVELS.map((level) => [level, 0]));
  const rules = {};
  const violations = [];
  const results = report.results.map((item) => ({ ...item, level: ibmLevel(item.value) }));
  results.forEach((item) => {
    if (item.level in byLevel) {
      byLevel[item.level] += 1;
    }
    if (item.level === 'violation') {
      rules[item.ruleId] = (rules[item.ruleId] || 0) + 1;
      const rule = `${item.ruleId}|${item.reasonId}`;
      violations.push({
        key: `${rule}|${JSON.stringify(item.messageArgs)}|${item.xpath}`,
        byXpath: `${rule}|${item.xpath}`,
        bySnippet: `${rule}|${item.snippet}`,
        byStructure: `${rule}|${item.structural}`
      });
    }
  });

  return {
    engine: { name: 'accessibility-checker-engine', version: ibmEngineVersion() },
    keyFormat: IBM_KEY_FORMAT,
    ruleset,
    numExecuted: report.numExecuted,
    rulesWithResults: report.rulesWithResults,
    ruleTime: report.ruleTime,
    ruleExceptions,
    byLevel,
    rules,
    keys: violations.map((violation) => violation.key),
    violations,
    results
  };
}

export function ibmEngineVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ENGINE_DIR, 'package.json'), 'utf8')).version;
  } catch (error) {
    return null;
  }
}

/**
 * Violações do pós que não existiam no baseline do mesmo snapshot. Pareamento em quatro
 * passadas, cada violação usada no máximo uma vez (multiconjunto): chave exata (regra,
 * motivo, argumentos, XPath); depois, entre as que sobraram, regra, motivo e XPath sem os
 * argumentos; depois o mesmo trecho de HTML; depois o mesmo caminho estrutural. byTarget
 * conta as do pós que ficaram sem par; byRule é o crescimento por regra, que não depende de
 * caminhos.
 */
export function newIbmViolations(baseline, post) {
  let leftBaseline = [...baseline.violations];
  let leftPost = [...post.violations];
  ['key', 'byXpath', 'bySnippet', 'byStructure'].forEach((field) => {
    const available = new Map();
    leftBaseline.forEach((violation, index) => {
      const list = available.get(violation[field]) || [];
      list.push(index);
      available.set(violation[field], list);
    });
    const usedBaseline = new Set();
    leftPost = leftPost.filter((violation) => {
      const list = available.get(violation[field]);
      if (list && list.length) {
        usedBaseline.add(list.shift());
        return false;
      }
      return true;
    });
    leftBaseline = leftBaseline.filter((violation, index) => !usedBaseline.has(index));
  });

  const byRule = {};
  Object.entries(post.rules).forEach(([rule, count]) => {
    const delta = count - (baseline.rules[rule] || 0);
    if (delta > 0) {
      byRule[rule] = delta;
    }
  });

  return { byTarget: leftPost.length, byRule };
}
