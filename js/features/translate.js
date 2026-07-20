// Traducción de texto con GPT (ES <-> EN).
import { chat } from '../api/openai.js';

export async function translate(text, target = 'en') {
  const lang = target === 'en' ? 'inglés' : 'español';
  return chat(
    [
      {
        role: 'system',
        content: `Traduce el texto del usuario al ${lang}. Conserva el formato Markdown y los nombres propios. Devuelve solo la traducción.`,
      },
      { role: 'user', content: text },
    ],
    { temperature: 0.3, maxTokens: 2000 }
  );
}
