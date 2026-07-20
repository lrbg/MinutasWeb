// Cliente de la API de OpenAI a través del proxy same-origin (/api/v1).
// La clave se lee de localStorage y viaja en el header Authorization hacia el
// proxy de Vercel, que la reenvía a OpenAI. No hay CORS porque la app y el
// proxy están en el mismo origen.
import { store } from '../store.js';

function auth() {
  const key = store.getApiKey();
  if (!key) throw new Error('Falta la clave API de OpenAI. Ábrela en Ajustes.');
  return key;
}

function base() {
  return store.getSettings().apiBase || '/api/v1';
}

/**
 * Transcribe un blob de audio (WAV) con el modelo configurado.
 * @param {Blob} blob audio del segmento
 * @returns {Promise<string>} texto transcrito (puede ser vacío)
 */
export async function transcribe(blob) {
  const s = store.getSettings();
  const form = new FormData();
  form.append('file', blob, 'segment.wav');
  form.append('model', s.transcribeModel);
  form.append('response_format', 'json');
  if (s.language) form.append('language', s.language);

  const res = await withRetry(() =>
    fetch(`${base()}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth()}` },
      body: form,
    })
  );
  if (!res.ok) throw await errorFrom(res, 'Transcripción');
  const data = await res.json();
  return (data.text || '').trim();
}

/**
 * Chat completions con mensajes estilo OpenAI (role/content).
 */
export async function chat(messages, { temperature = 0.5, maxTokens = 1500 } = {}) {
  const s = store.getSettings();
  const res = await withRetry(() =>
    fetch(`${base()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: s.chatModel,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })
  );
  if (!res.ok) throw await errorFrom(res, 'La IA');
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

// Valida la clave con una llamada barata.
export async function validateKey() {
  const res = await fetch(`${base()}/models`, {
    headers: { Authorization: `Bearer ${auth()}` },
  });
  return res.ok;
}

// Reintenta ante 429 (rate limit) respetando el header Retry-After si viene.
async function withRetry(doFetch, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    const res = await doFetch();
    if (res.status !== 429 || attempt >= retries) return res;
    const retryAfter = Number(res.headers.get('retry-after'));
    const delay = retryAfter ? retryAfter * 1000 : Math.min(20000, 1500 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, delay));
  }
}

async function errorFrom(res, label) {
  let detail = res.statusText || 'sin detalle';
  try {
    const j = await res.json();
    detail = j.error?.message || detail;
  } catch {
    /* noop */
  }
  if (res.status === 429) {
    return new Error(
      `${label}: límite o saldo de OpenAI (429). ${detail}. Revisa tu crédito en platform.openai.com.`
    );
  }
  return new Error(`${label} respondió con error (${res.status}): ${detail}`);
}
