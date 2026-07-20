// Cliente de la API de Google Gemini (AI Studio).
// Gemini permite llamadas directas desde el navegador (envía headers CORS),
// así que NO hace falta ningún proxy. La clave va como parámetro ?key= y se
// lee de localStorage. Un mismo modelo multimodal transcribe audio y genera
// texto (minuta, preguntas, traducción).
import { store } from '../store.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

function apiKey() {
  const k = store.getApiKey();
  if (!k) throw new Error('Falta la clave API de Google. Ábrela en Ajustes.');
  return k;
}

const LANG_NAME = { es: 'español', en: 'inglés', pt: 'portugués', fr: 'francés' };

/**
 * Transcribe un blob de audio (WAV) con Gemini.
 * @param {Blob} blob audio del segmento
 * @returns {Promise<string>} texto transcrito (puede ser vacío)
 */
export async function transcribe(blob) {
  const s = store.getSettings();
  const lang = LANG_NAME[s.language] || 'el idioma que se hable';
  const b64 = await blobToBase64(blob);
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Transcribe literalmente este audio de una reunión en ${lang}. ` +
              'Devuelve SOLO el texto hablado, sin comentarios ni etiquetas. ' +
              'Si no hay voz clara, responde con una cadena vacía.',
          },
          { inline_data: { mime_type: blob.type || 'audio/wav', data: b64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  };
  const data = await call(s.model, body);
  return extractText(data).trim();
}

/**
 * Genera texto a partir de mensajes estilo OpenAI (role/content).
 * Se traduce internamente al formato de Gemini para no tocar las features.
 */
export async function chat(messages, { temperature = 0.5, maxTokens = 1500 } = {}) {
  const s = store.getSettings();
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (system) body.system_instruction = { parts: [{ text: system }] };

  const data = await call(s.model, body);
  return extractText(data).trim();
}

// Valida la clave con una llamada barata al listado de modelos.
export async function validateKey() {
  const res = await fetch(`${BASE}/models?key=${encodeURIComponent(apiKey())}`);
  return res.ok;
}

async function call(model, body) {
  const url = `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey())}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Gemini respondió con error (${res.status}): ${await safeError(res)}`);
  }
  return res.json();
}

function extractText(data) {
  const cand = data.candidates?.[0];
  if (!cand) return '';
  return (cand.content?.parts || []).map((p) => p.text || '').join('');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function safeError(res) {
  try {
    const j = await res.json();
    return j.error?.message || JSON.stringify(j).slice(0, 160);
  } catch {
    return res.statusText || 'sin detalle';
  }
}
