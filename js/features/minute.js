// Genera una minuta estructurada a partir de la transcripción, usando GPT.
import { chat } from '../api/openai.js';

const SYSTEM_PROMPT = `Eres un experto en redactar minutas a partir de transcripciones de reuniones.
Genera un resumen estructurado en formato Markdown que incluya, cuando aplique:

1. Título de la reunión (inferido del contenido)
2. Participantes (si se pueden identificar)
3. Puntos principales discutidos (organizados por temas)
4. Decisiones tomadas
5. Acciones a realizar (con responsable si se menciona)
6. Preguntas importantes planteadas
7. Conclusiones

La minuta debe ser objetiva, concisa y bien organizada. Usa encabezados y listas.
No inventes información que no esté en la transcripción.`;

const MAX_CHARS = 24000;

export async function generateMinute(transcript) {
  const text = (transcript || '').trim();
  if (text.length < 40) {
    throw new Error('La transcripción es muy corta para generar una minuta.');
  }
  // Si es muy larga, nos quedamos con la parte final (lo más reciente).
  const clipped = text.length > MAX_CHARS ? '…' + text.slice(-MAX_CHARS) : text;

  return chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Aquí está la transcripción de una reunión. Genera la minuta:\n\n${clipped}`,
      },
    ],
    { temperature: 0.4, maxTokens: 1800 }
  );
}
