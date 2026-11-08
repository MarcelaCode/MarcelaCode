// Avalia a resposta "verbose_json" (formato OpenAI-compatível) de um serviço de transcrição.
function avaliarTranscricao(resp, { minChars = 3, maxNoSpeech = 0.6, minLogprob = -1.0 } = {}) {
  const texto = String((resp && resp.text) || '').trim();
  if (texto.replace(/[\s.,!?…-]/g, '').length < minChars) return { ok: false, motivo: 'vazio' };
  const segs = (resp && resp.segments) || [];
  if (segs.length) {
    const avg = k => segs.reduce((s, x) => s + (Number(x[k]) || 0), 0) / segs.length;
    if (avg('no_speech_prob') > maxNoSpeech) return { ok: false, motivo: 'sem_fala' };
    if (avg('avg_logprob') < minLogprob) return { ok: false, motivo: 'baixa_confianca' };
  }
  return { ok: true, texto };
}
module.exports = { avaliarTranscricao };
