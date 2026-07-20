// Configuración por defecto de MinutasWeb.
// Los valores se pueden sobrescribir desde Ajustes (se guardan en localStorage).
export const DEFAULTS = {
  apiBase: 'https://api.openai.com/v1',
  transcribeModel: 'gpt-4o-mini-transcribe',
  chatModel: 'gpt-4o-mini',
  language: 'es',
  segmentSeconds: 12,
  // Nivel mínimo de audio (0-100) para considerar que un segmento tiene voz.
  // Evita mandar silencios a la API (y las alucinaciones típicas de Whisper).
  silenceThreshold: 4,
};

// Contexto que se pasa a Whisper para mejorar términos propios.
export const TRANSCRIBE_PROMPT =
  'Transcripción de una reunión de trabajo en español. Puede incluir términos técnicos, nombres de personas y anglicismos.';
