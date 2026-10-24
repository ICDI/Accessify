import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { prepareExtension } from './extensions.js';

/**
 * Um contexto de navegador por condição (decisão D3), com perfil novo a cada lote e só
 * a extensão daquela condição carregada (a baseline não carrega nenhuma).
 */
export async function launchCondition(condition, config) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), `.pw-profile-${condition.id}-`));
  const extension = condition.extension ? prepareExtension(config.dirs[condition.extension], condition.id) : null;

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: config.headless,
    viewport: config.viewport,
    locale: config.locale,
    args: extension ? [`--disable-extensions-except=${extension.dir}`, `--load-extension=${extension.dir}`] : []
  });

  try {
    let serviceWorker = null;
    let extensionId = null;
    if (extension) {
      [serviceWorker] = context.serviceWorkers();
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 20000 });
      }
      extensionId = new URL(serviceWorker.url()).host;

      const installType = await serviceWorker.evaluate(async () => (await chrome.management.getSelf()).installType);
      if (installType !== 'development') {
        throw new Error(`A extensão da condição ${condition.id} não carregou em modo desenvolvedor (${installType}).`);
      }
    }

    const browser = await browserVersion(context);
    const state = { closed: false };
    context.on('close', () => { state.closed = true; });

    return { context, serviceWorker, extensionId, extension, profileDir, browser, state };
  } catch (error) {
    // Um navegador aberto pela metade não pode ficar disputando memória com o Ollama
    await context.close().catch(() => {});
    throw error;
  }
}

/**
 * Opções salvas das extensões para o lote: provedor local e otimização automática
 * desligada. Na v1.0.0 a chave é um marcador (a v1.0.0 exige uma chave para chamar o
 * LLM); a rota do adaptador troca o destino para o Ollama e nunca envia esse valor.
 */
export async function configureExtensionStorage(serviceWorker, condition, config) {
  if (!serviceWorker) {
    return;
  }

  if (condition.extension === 'accessifyV1') {
    await serviceWorker.evaluate(async () => {
      await chrome.storage.sync.set({ apiKey: 'adaptador-local-sem-chave', autoOptimize: false });
    });
    return;
  }

  // automationHookEnabled é o opt-in do gancho de automação (C11): só este perfil, criado
  // pelo harness, liga o gancho; o navegador do dia a dia não tem a chave
  await serviceWorker.evaluate(async ({ baseUrl, model }) => {
    await chrome.storage.sync.set({ provider: 'local', localBaseUrl: baseUrl, localModel: model, autoOptimize: false });
    await chrome.storage.local.set({ automationHookEnabled: true });
  }, { baseUrl: `${config.ollama.baseUrl}/v1`, model: condition.model });
}

/**
 * Aba do snapshot pela URL. Se houver mais de uma (uma aba que vazou de uma tentativa
 * anterior), vale a mais nova, que é a que o run acabou de abrir.
 */
export async function findTabByUrl(serviceWorker, url) {
  return serviceWorker.evaluate(async (target) => {
    const tabs = (await chrome.tabs.query({})).filter((tab) => tab.url === target);
    return tabs.sort((a, b) => b.id - a.id)[0] || null;
  }, url);
}

/**
 * Versão completa do navegador (o userAgent do Chromium atual vem reduzido).
 */
export async function browserVersion(context) {
  const page = await context.newPage();
  try {
    const cdp = await context.newCDPSession(page);
    const version = await cdp.send('Browser.getVersion');
    return { product: version.product, revision: version.revision, userAgent: version.userAgent };
  } finally {
    await page.close().catch(() => {});
  }
}
