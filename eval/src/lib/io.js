export const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const TRANSIENT = ['EPERM', 'EBUSY', 'EACCES', 'EAGAIN'];

/**
 * Repete uma operação de arquivo que falhou por bloqueio passageiro: no Windows, antivírus
 * e indexador seguram por instantes arquivos recém-fechados (troca de nome e remoção são as
 * vítimas mais comuns). Outros erros sobem na hora.
 */
export function withIoRetries(action, attempts = 5) {
  for (let attemptNumber = 1; ; attemptNumber++) {
    try {
      return action();
    } catch (error) {
      if (attemptNumber >= attempts || !TRANSIENT.includes(error.code)) {
        throw error;
      }
      sleepSync(200 * attemptNumber);
    }
  }
}
