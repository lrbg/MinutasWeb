// Configuración por defecto de MinutasWeb.
// Los valores se pueden sobrescribir desde Ajustes (se guardan en localStorage).
export const DEFAULTS = {
  // Modelo de Gemini (multimodal: transcribe audio y genera texto).
  model: 'gemini-2.5-flash',
  language: 'es',
  // Segmentos algo largos para no pasarse del límite de peticiones por minuto
  // del plan gratuito de Gemini.
  segmentSeconds: 15,
  // Nivel mínimo de audio (0-100) para considerar que un segmento tiene voz.
  // Evita mandar silencios a la API.
  silenceThreshold: 4,
};
