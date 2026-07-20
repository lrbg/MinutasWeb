// Cliente ligero de la API de OpenAI. Lee la clave y los modelos de la config
// guardada en el navegador. Nada de esto toca ningún backend propio.
import { store } from '../store.js';

function auth() {
  const key = store.getApiKey();
  if (!key) throw new Error('Falta la clave API. Ábrela en Ajustes.');
  return key;
}

/**
 * Transcribe un blob de audio con el modelo configurado.
 * @param {Blob} blob  audio (webm/mp4) de un segmento
 * @returns {Promise<string>} texto transcrito (puede ser cadena vacía)
 */
export async function transcribe(blob, { prompt } = {}) {
  const s = store.getSettings();
  const form = new FormData();
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  form.append('file', blob, `segment.${ext}`);
  form.append('model', s.transcribeModel);
  form.append('response_format', 'json');
  if (s.language) form.append('language', s.language);
  if (prompt) form.append('prompt', prompt);

  const res = await fetch(`${s.apiBase}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth()}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await safeError(res);
    throw new Error(`Transcripción falló (${res.status}): ${detail}`);
  }
  const data = await res.json();
  return (data.text || '').trim();
}

/**
 * Llama al endpoint de chat completions.
 * @param {Array<{role:string,content:string}>} messages
 * @returns {Promise<string>} contenido de la respuesta
 */
export async function chat(messages, { temperature = 0.5, maxTokens = 1500 } = {}) {
  const s = store.getSettings();
  const res = await fetch(`${s.apiBase}/chat/completions`, {
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
  });

  if (!res.ok) {
    const detail = await safeError(res);
    throw new Error(`La IA respondió con error (${res.status}): ${detail}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

// Valida la clave con una llamada barata al listado de modelos.
export async function validateKey() {
  const s = store.getSettings();
  const res = await fetch(`${s.apiBase}/models`, {
    headers: { Authorization: `Bearer ${auth()}` },
  });
  return res.ok;
}

async function safeError(res) {
  try {
    const j = await res.json();
    return j.error?.message || JSON.stringify(j).slice(0, 160);
  } catch {
    return res.statusText || 'sin detalle';
  }
}
