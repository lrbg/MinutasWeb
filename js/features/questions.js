// Detección de preguntas (por reglas y con IA) y generación de respuestas.
import { chat } from '../api/gemini.js';

const INTERROGATIVES = [
  'qué', 'que', 'quién', 'quien', 'cuándo', 'cuando', 'dónde', 'donde',
  'cómo', 'como', 'por qué', 'porqué', 'cuál', 'cual', 'cuánto', 'cuanto',
  'what', 'who', 'when', 'where', 'why', 'how', 'which',
];

// Heurística rápida en el navegador, sin llamar a la API.
export function looksLikeQuestion(text) {
  const t = (text || '').trim().toLowerCase();
  if (!t) return false;
  if (t.includes('?') || t.includes('¿')) return true;
  const first = t.split(/\s+/)[0];
  return INTERROGATIVES.includes(first);
}

// Revisa una lista de frases con IA: marca cuáles son preguntas y las reformula.
export async function analyzeQuestions(segments) {
  if (!segments.length) return [];
  const list = segments.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const content = await chat(
    [
      {
        role: 'system',
        content:
          'Detecta preguntas en frases de una transcripción (español o inglés), incluso implícitas o sin signo de interrogación. ' +
          'Devuelve SOLO un array JSON. Cada elemento: {"i": número, "is_question": bool, "reformulated": "pregunta con signos"}. ' +
          'Incluye únicamente las que sean preguntas.',
      },
      { role: 'user', content: `Frases:\n${list}` },
    ],
    { temperature: 0.1, maxTokens: 1200 }
  );

  const arr = extractJsonArray(content);
  return arr
    .filter((x) => x && x.is_question)
    .map((x) => ({
      original: segments[(x.i || 1) - 1] || '',
      question: x.reformulated || segments[(x.i || 1) - 1] || '',
    }));
}

// Responde una pregunta puntual.
export async function answerQuestion(question, language = 'es') {
  const instruction =
    language === 'en' ? 'Answer in English.' : 'Responde en español.';
  return chat(
    [
      {
        role: 'system',
        content: `Eres un asistente experto. Da respuestas claras y breves. ${instruction}`,
      },
      { role: 'user', content: question },
    ],
    { temperature: 0.7, maxTokens: 500 }
  );
}

function extractJsonArray(text) {
  try {
    return JSON.parse(text);
  } catch { /* intentar extraer del texto */ }
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch { /* noop */ }
  }
  return [];
}
