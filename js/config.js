// Configuración por defecto de MinutasWeb.
// Los valores se pueden sobrescribir desde Ajustes (se guardan en localStorage).
export const DEFAULTS = {
  // Proxy same-origin (función de Vercel) hacia OpenAI. Ver api/[...path].js.
  apiBase: '/api/v1',
  // Modelo de transcripción (endpoint /audio/transcriptions).
  // whisper-1 es el que usa la app de escritorio original y está en toda cuenta.
  transcribeModel: 'whisper-1',
  // Modelo de chat para minuta, preguntas y traducción.
  chatModel: 'gpt-4o-mini',
  language: 'es',
  // La app de escritorio usa 5s; aquí 10s como equilibrio con dos fuentes.
  segmentSeconds: 10,
  // Nivel mínimo de audio (0-100) para considerar que un segmento tiene voz.
  silenceThreshold: 4,
};
