const MAX_TENTATIVAS_FILA = 3;
const BACKOFF_MIN = [1, 5, 15];
function retentavel(status, codigo) {
  if (!status) return true; // erro de rede/timeout
  if ([408, 409, 425, 429].includes(Number(status))) return true;
  return Number(status) >= 500;
}
function proximaTentativa(tentativas, agoraMs) {
  if (tentativas >= MAX_TENTATIVAS_FILA) return null; // esgotado -> atendimento humano
  return new Date(agoraMs + BACKOFF_MIN[Math.min(tentativas, BACKOFF_MIN.length - 1)] * 60000).toISOString();
}
module.exports = { MAX_TENTATIVAS_FILA, retentavel, proximaTentativa };
