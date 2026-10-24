import http from 'node:http';

/**
 * POST JSON por node:http. O fetch do Node desiste sozinho se os cabeçalhos demoram mais
 * de 300 s, e o Ollama sem streaming só responde quando termina de gerar (as
 * recomendações da v1.0.0, com max_tokens alto e raciocínio, passam disso; carregar um
 * modelo na CPU também). Aqui o único prazo é o do chamador.
 */
export function postJson(url, payload, { timeoutMs, signal } = {}) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload));
    let timer = null;
    const request = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
      signal
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        clearTimeout(timer);
        resolve({ status: response.statusCode, text: Buffer.concat(chunks).toString('utf8') });
      });
      response.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    if (timeoutMs) {
      timer = setTimeout(() => request.destroy(new Error(`sem resposta em ${timeoutMs} ms`)), timeoutMs);
    }
    request.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    request.end(body);
  });
}

/**
 * GET JSON com prazo curto. Nunca lança: um erro vira { erro }.
 */
export async function getJson(url, timeoutMs = 10000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok ? await response.json() : { erro: `HTTP ${response.status}` };
  } catch (error) {
    return { erro: error.message };
  }
}
