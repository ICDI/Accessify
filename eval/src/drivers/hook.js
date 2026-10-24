/**
 * Driver da v1.1.0: o gancho de automação (C11). A página dispara 'accessify:run' com a
 * configuração da condição e o resultado aparece em #accessify-result. O nó é lido e
 * removido antes de qualquer medição (é o único que o C11 acrescenta ao DOM).
 */
async function waitHookReady(page) {
  return page.evaluate(async () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const ready = await new Promise((resolve) => {
        const onReady = () => resolve(true);
        document.addEventListener('accessify:ready', onReady, { once: true });
        document.dispatchEvent(new CustomEvent('accessify:ping'));
        setTimeout(() => {
          document.removeEventListener('accessify:ready', onReady);
          resolve(false);
        }, 200);
      });
      if (ready) {
        return true;
      }
    }
    return false;
  });
}

export async function runHookDriver(page, condition, config, runId) {
  if (!(await waitHookReady(page))) {
    return { status: 'falha', errors: [{ stage: 'harness', message: 'O listener do gancho não respondeu em 10 s.' }] };
  }

  const hookConfig = {
    provider: 'local',
    model: condition.model,
    temperature: condition.temperature,
    reasoning: condition.reasoning || 'original',
    vision: condition.vision === true,
    apply: true,
    runId,
    timeoutMs: config.timeouts.hookMs
  };

  await page.evaluate((detail) => {
    document.dispatchEvent(new CustomEvent('accessify:run', { detail }));
  }, JSON.stringify(hookConfig));

  try {
    await page.waitForSelector('#accessify-result', { state: 'attached', timeout: config.timeouts.hookMs + 15000 });
  } catch (error) {
    return { status: 'falha', errors: [{ stage: 'harness', message: 'Sem #accessify-result dentro do prazo.' }] };
  }

  return page.evaluate(() => {
    const node = document.getElementById('accessify-result');
    const result = JSON.parse(node.textContent);
    node.remove();
    return result;
  });
}
