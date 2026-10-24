import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { sha256Dir } from './hash.js';

/**
 * Um contexto de navegador por condição (decisão D3), com perfil novo e só a extensão
 * daquela condição carregada (a baseline não carrega nenhuma). `extension` é a cópia
 * preparada uma vez por sessão (prepareExtension): um relançamento usa a mesma cópia, e
 * o hash dela é conferido para nada mudar no meio da condição.
 */
export async function launchCondition(condition, config, extension) {
  if (extension && sha256Dir(extension.dir) !== extension.copySha256) {
    throw new Error(`A cópia da extensão da condição ${condition.id} mudou no disco desde o início da sessão.`);
  }
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), `.pw-profile-${condition.id}-`));
  const removeProfile = () => fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });

  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      channel: 'chromium',
      headless: config.headless,
      viewport: config.viewport,
      locale: config.locale,
      // EVAL_CHROMIUM_ARGS: argumentos extras (separados por espaço) para diagnóstico, ex.: --disable-gpu
      args: [
        ...(extension ? [`--disable-extensions-except=${extension.dir}`, `--load-extension=${extension.dir}`] : []),
        ...(process.env.EVAL_CHROMIUM_ARGS ? process.env.EVAL_CHROMIUM_ARGS.split(/\s+/).filter(Boolean) : [])
      ]
    });
  } catch (error) {
    try {
      removeProfile();
    } catch (removeError) {
      // segue: o erro que importa é o da abertura
    }
    throw error;
  }

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
    // Fecha o contexto e apaga o perfil temporário (a cópia da extensão é da sessão)
    const dispose = async () => {
      await context.close().catch(() => {});
      try {
        removeProfile();
      } catch (error) {
        // perfil ainda preso pelo Chromium: fica no diretório temporário
      }
    };

    return { context, serviceWorker, extensionId, extension, profileDir, browser, state, dispose, launchedAt: new Date().toISOString() };
  } catch (error) {
    // Um navegador aberto pela metade não pode ficar disputando memória com o Ollama
    await context.close().catch(() => {});
    try {
      removeProfile();
    } catch (removeError) {
      // segue: o erro que importa é o da abertura
    }
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
