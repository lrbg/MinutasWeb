// Configuración por defecto de MinutasWeb.
// Los valores se pueden sobrescribir desde Ajustes (se guardan en localStorage).
export const DEFAULTS = {
  // Proxy same-origin (función de Vercel) hacia OpenAI. Ver api/[...path].js.
  apiBase: '/api/v1',
  // Modelo de transcripción (endpoint /audio/transcriptions).
  transcribeModel: 'gpt-4o-mini-transcribe',
  // Modelo de chat para minuta, preguntas y traducción.
  chatModel: 'gpt-4o-mini',
  language: 'es',
  segmentSeconds: 20,
  // Nivel mínimo de audio (0-100) para considerar que un segmento tiene voz.
  silenceThreshold: 4,
};
