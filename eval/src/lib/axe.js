import { AxeBuilder } from '@axe-core/playwright';

/**
 * Roda o axe-core com as tags do estudo e resume por impacto. byImpact conta pares
 * (regra, nó): um elemento que falha em duas regras conta duas vezes, como nas contagens
 * do próprio axe. `elements` conta elementos distintos com alguma violação. `keys`
 * (regra + alvo) alimenta novos_erros_axe; a diferença por regra fica no JSON bruto.
 */
export async function runAxe(page, tags) {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const keys = [];
  const rules = {};
  const targets = new Set();

  results.violations.forEach((violation) => {
    rules[violation.id] = violation.nodes.length;
    violation.nodes.forEach((node) => {
      const impact = node.impact || violation.impact;
      if (impact in byImpact) {
        byImpact[impact] += 1;
      }
      const target = JSON.stringify(node.target);
      targets.add(target);
      keys.push(`${violation.id}|${target}`);
    });
  });

  return {
    engine: results.testEngine,
    byImpact,
    elements: targets.size,
    incomplete: results.incomplete.reduce((sum, item) => sum + item.nodes.length, 0),
    rules,
    keys,
    violations: results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      tags: violation.tags,
      targets: violation.nodes.map((node) => node.target)
    }))
  };
}

/**
 * Violações do pós que não existiam no baseline da mesma URL, por (regra, alvo) e por
 * regra. Como o plugin renomeia IDs, a contagem por alvo pode acusar "novos" erros que
 * são o mesmo elemento com outro seletor: por isso a diferença por regra vai junto.
 */
export function newViolations(baseline, post) {
  const baselineKeys = new Set(baseline.keys);
  const byRule = {};
  Object.entries(post.rules).forEach(([rule, count]) => {
    const delta = count - (baseline.rules[rule] || 0);
    if (delta > 0) {
      byRule[rule] = delta;
    }
  });

  return {
    byTarget: post.keys.filter((key) => !baselineKeys.has(key)).length,
    byRule
  };
}
