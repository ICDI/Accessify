// Aceite 6: equivalência que sustenta citar "v1.1.0" no artigo.
//  a) tag v1.1.0 x build, pelo mesmo caminho (SW, optimizer.runAutoOptimization(tab)) na
//     test-page, sem LLM: DOMs finais iguais, IDs aleatórios normalizados e
//     #accessify-result excluído;
//  b) o mesmo pelo painel real (Analisar → Aplicar);
//  c) D7: gancho C11 x painel no build (precisa do Ollama no ar só para a checagem do
//     modelo: a imagem sem alt da test-page é resolvida pela heurística, sem LLM);
//  d) payload do painel: combineOptimizations() do popup.js da tag x AccessifyPanelFixes
//     (panel-fixes.js), sem os campos aditivos de origem do C10.
// Uso: node aceites/6-equivalencia.js [--modelo qwen3:8b] [--saida pasta]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { runHookDriver } from '../src/drivers/hook.js';
import { runPanelDriver } from '../src/drivers/panel.js';
import { loadConfig, parseArgs } from '../src/lib/config.js';
import { NO_LLM_BASE_URL, OLLAMA_URL, REPO_DIR, buildCopy, createReport, finalDom, findTab, git, launchExtension, ollamaAvailable, openTarget, refCopy, serveFixtures, setLocalProvider } from './lib.js';

const args = parseArgs();
const config = loadConfig();
const model = typeof args.modelo === 'string' ? args.modelo : 'qwen3:8b';
const { report, check, finish, outDir } = createReport('6-equivalencia', args);

// Se os DOMs diferirem, os dois vão para a pasta de evidências, para o diff
function sameDom(label, left, right, [leftName, rightName]) {
  if (left !== right) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `6-equivalencia-${label}-${leftName}.html`), left);
    fs.writeFileSync(path.join(outDir, `6-equivalencia-${label}-${rightName}.html`), right);
  }
  return left === right;
}

// Preparados dentro do try: um erro aqui (tag ausente, git) vira uma verificação com
// falha e a evidência é gravada mesmo assim
let fixtures = null;
let testPage = null;
let build = null;
let tag = null;

async function withExtension(dir, label, fn) {
  const launched = await launchExtension(dir, label);
  try {
    return await fn(launched);
  } finally {
    await launched.close();
  }
}

async function autoOptimizationDom(dir, label) {
  return withExtension(dir, label, async ({ context, serviceWorker }) => {
    await setLocalProvider(serviceWorker, NO_LLM_BASE_URL, model);
    const page = await openTarget(context, testPage);
    const tab = await findTab(serviceWorker, testPage);
    const before = await finalDom(page);
    const job = await serviceWorker.evaluate(async (target) => {
      const result = await optimizer.runAutoOptimization(target);
      return { status: result?.status, appliedChanges: result?.appliedChanges ?? result?.applyResult?.appliedCount ?? null };
    }, tab);
    const dom = await finalDom(page);
    return { job, dom, changed: dom !== before };
  });
}

async function panelDom(dir, label) {
  return withExtension(dir, label, async ({ context, serviceWorker, extensionId }) => {
    await setLocalProvider(serviceWorker, NO_LLM_BASE_URL, model);
    const page = await openTarget(context, testPage);
    const panel = await runPanelDriver(context, extensionId, serviceWorker, page, config);
    return { panel: { status: panel.status, appliedChanges: panel.appliedChanges, errors: panel.errors }, dom: await finalDom(page) };
  });
}

let realPayload = null;
try {
  fixtures = await serveFixtures();
  testPage = fixtures.url('/test-page.html');
  build = buildCopy('aceite-equiv-build');
  tag = refCopy('v1.1.0', 'aceite-equiv-tag');
  report.build = { gitDescribe: build.gitDescribe, gitCommit: build.gitCommit, copySha256: build.copySha256 };
  report.tag = { ref: tag.ref, gitCommit: tag.gitCommit };

  // a) runAutoOptimization, sem LLM
  const autoTag = await autoOptimizationDom(tag.dir, 'equiv-auto-tag');
  const autoBuild = await autoOptimizationDom(build.dir, 'equiv-auto-build');
  report.autoOptimization = { tag: autoTag.job, build: autoBuild.job, domChars: [autoTag.dom.length, autoBuild.dom.length] };
  check('a) runAutoOptimization concluiu e mudou o DOM nas duas versões', autoTag.job.status === 'completed' && autoBuild.job.status === 'completed' && autoTag.changed && autoBuild.changed,
    `${autoTag.job.status} / ${autoBuild.job.status}, DOM mudou: ${autoTag.changed} / ${autoBuild.changed}`);
  check('a) DOM final da tag v1.1.0 = DOM do build (SW)', sameDom('auto', autoTag.dom, autoBuild.dom, ['tag', 'build']), `${autoTag.dom.length} x ${autoBuild.dom.length} caracteres`);

  // b) painel real, sem LLM
  const panelTag = await panelDom(tag.dir, 'equiv-painel-tag');
  const panelBuild = await panelDom(build.dir, 'equiv-painel-build');
  report.panel = { tag: panelTag.panel, build: panelBuild.panel };
  check('b) painel aplicou nas duas versões', panelTag.panel.status === 'ok' && panelBuild.panel.status === 'ok', `${panelTag.panel.appliedChanges} / ${panelBuild.panel.appliedChanges} alterações`);
  check('b) DOM final da tag v1.1.0 = DOM do build (painel)', sameDom('painel', panelTag.dom, panelBuild.dom, ['tag', 'build']), `${panelTag.dom.length} x ${panelBuild.dom.length} caracteres`);

  // c) D7: gancho x painel no build
  if (!(await ollamaAvailable(model))) {
    check(`c) Ollama em ${OLLAMA_URL} com ${model} (checagem do modelo do gancho)`, false, 'Ollama fora do ar ou modelo ausente');
  } else {
    const d7 = await withExtension(build.dir, 'equiv-d7', async ({ context, serviceWorker, extensionId }) => {
      await setLocalProvider(serviceWorker, `${OLLAMA_URL}/v1`, model);
      await serviceWorker.evaluate(async () => chrome.storage.local.set({ automationHookEnabled: true }));

      const hookPage = await openTarget(context, `${testPage}?gancho`);
      const condition = { model, temperature: 0, reasoning: 'original', vision: false };
      const hook = await runHookDriver(hookPage, condition, config, 'aceite_equivalencia_gancho');
      const hookTab = await findTab(serviceWorker, `${testPage}?gancho`);
      const job = await serviceWorker.evaluate(async (tabId) => optimizer.getAnalysisJob(tabId), hookTab.id);
      const hookDom = await finalDom(hookPage);

      const panelPage = await openTarget(context, `${testPage}?painel`);
      const panel = await runPanelDriver(context, extensionId, serviceWorker, panelPage, config);
      return {
        hook: { status: hook.status, appliedChanges: hook.appliedChanges, errors: hook.errors, llmCalls: hook.runLog?.llmCalls?.length ?? null },
        panel: { status: panel.status, appliedChanges: panel.appliedChanges, errors: panel.errors },
        payload: { analysisResult: job?.analysisResult, optimizations: job?.optimizations, imageAltResults: job?.imageAltResults },
        hookDom,
        panelDom: await finalDom(panelPage)
      };
    });
    realPayload = d7.payload;
    report.d7 = { hook: d7.hook, panel: d7.panel };
    check('c) gancho e painel aplicaram', d7.hook.status === 'ok' && d7.panel.status === 'ok', `${JSON.stringify(d7.hook.errors || [])} ${JSON.stringify(d7.panel.errors || [])}`);
    check('c) nenhuma chamada ao LLM na test-page (comparação sem texto gerado)', d7.hook.llmCalls === 0, String(d7.hook.llmCalls));
    check('c) D7: DOM do gancho = DOM do painel', sameDom('d7', d7.hookDom, d7.panelDom, ['gancho', 'painel']), `${d7.hookDom.length} x ${d7.panelDom.length} caracteres`);
    check('c) D7: mesmo número de alterações', d7.hook.appliedChanges === d7.panel.appliedChanges, `${d7.hook.appliedChanges} x ${d7.panel.appliedChanges}`);
  }
} catch (error) {
  check('a–c) rodaram até o fim', false, error.message.split('\n')[0]);
} finally {
  await fixtures?.close();
}

// d) payload do painel, fora do navegador
function loadClass(source, className) {
  const context = vm.createContext({ document: { addEventListener() {} }, chrome: {}, console, globalThis: {} });
  vm.runInContext(`${source}\n;globalThis.__exported = ${className};`, context);
  return context.globalThis.__exported;
}
let OldPopup = null;
let PanelFixes = null;
try {
  OldPopup = loadClass(git(['show', 'v1.1.0:popup.js'], { encoding: 'utf8' }), 'PopupController');
  PanelFixes = loadClass(fs.readFileSync(path.join(REPO_DIR, 'panel-fixes.js'), 'utf8'), 'AccessifyPanelFixes');
} catch (error) {
  check('d) classes do painel carregadas (tag v1.1.0 e panel-fixes.js)', false, error.message.split('\n')[0]);
  process.exit(finish());
}
const withoutOrigin = (value) => JSON.parse(JSON.stringify(value ?? null, (key, item) => (key === 'origin' || key === 'stylesOrigin' ? undefined : item)));

function samePayload(analysisResult, optimizations, imageAltResults) {
  try {
    const old = Object.create(OldPopup.prototype);
    old.analysisResult = analysisResult;
    const expected = old.combineOptimizations(optimizations, imageAltResults);
    const actual = new PanelFixes(analysisResult).combineOptimizations(optimizations, imageAltResults);
    return JSON.stringify(withoutOrigin(expected)) === JSON.stringify(withoutOrigin(actual));
  } catch (error) {
    report.payloadErrors = [...(report.payloadErrors || []), error.message.split('\n')[0]];
    return false;
  }
}

const issue = (type, extra = {}) => ({ type, severity: 'warning', ...extra });
const synthetic = {
  summary: {
    issues: [
      issue('link-no-text', { selector: 'a:nth-of-type(1)' }),
      issue('link-no-text', { selector: 'a:nth-of-type(2)' }),
      issue('empty-button', { selector: 'button#b1', tagName: 'button' }),
      issue('empty-button', { selector: 'input#i1', tagName: 'input' }),
      issue('spacer-image-missing-alt', { index: 3 }),
      issue('redundant-title-text', { selector: '#t1' }),
      issue('redundant-image-alt', { index: 4 }),
      issue('justified-text', { selector: 'p.j' }),
      issue('small-text', { selector: 'small' }),
      issue('aria-hidden-content', { selector: '#h1' }),
      issue('low-color-contrast', { selector: '#c1', font_size: '12px', foreground_color: 'rgb(200, 200, 200)', background_color: 'rgb(255, 255, 255)', minimum_contrast: 4.5 }),
      issue('low-color-contrast', { selector: '#c2', font_size: '20px', foreground_color: '#777', background_color: '#fff', minimum_contrast: 4.5 }),
      issue('form-field-no-label', { selector: '#f1', placeholder: 'seuNome_completo' }),
      issue('form-field-no-label', { selector: '#f2', input_type: 'email' }),
      issue('form-field-no-label', { selector: '#f3', tagName: 'textarea' }),
      issue('form-field-no-label', { selector: '#f5', input_type: 'password' }),
      issue('no-h1')
    ]
  }
};
const llmOptimizations = {
  optimizations: [{ type: 'text' }],
  structureChanges: [{ selector: '#f1', newTag: null, attributes: { title: 'x' } }],
  textChanges: [{ selector: 'a:nth-of-type(1)', text: 'Notícias' }],
  ariaLabels: [{ selector: 'button#b1', label: 'Buscar', role: null }],
  styles: 'body { color: black; }',
  imageAlts: [{ index: 9, alt: 'Logo' }]
};
const imageAlts = [{ index: 3, alt: 'Foto', success: true, source: 'llm' }, { index: 4, alt: 'Banner', success: true, source: 'heuristic' }];
const empty = { optimizations: [], structureChanges: [], ariaLabels: [], textChanges: [], styles: '', imageAlts: [] };

check('d) payload igual: problemas sintéticos, sem LLM', samePayload(synthetic, empty, []));
check('d) payload igual: problemas sintéticos, com sugestões do LLM', samePayload(synthetic, llmOptimizations, imageAlts));
check('d) payload igual: sem problemas', samePayload({ summary: { issues: [] } }, llmOptimizations, imageAlts));
check('d) payload igual: análise nula', samePayload(null, null, []));
if (realPayload?.analysisResult) {
  check('d) payload igual: análise real da test-page', samePayload(realPayload.analysisResult, realPayload.optimizations, realPayload.imageAltResults));
}

process.exit(finish());
