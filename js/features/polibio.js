// Envío de minutas al "Anotador de Reuniones" de PolibioDesk.
// Llama a la edge function ingest-minuta, que valida el token y registra la
// minuta en el proyecto RAG. El token vive solo en el navegador (Ajustes).
import { store } from '../store.js';

const POLIBIO_URL = 'https://hyylhendjtwdtflzsjdx.supabase.co/functions/v1/ingest-minuta';
const POLIBIO_ANON = 'sb_publishable_naAJyt5EoAiP2bZvGBgLvQ_L__8FeBN'; // clave pública de Polibio (no secreta)

export function polibioConfigured() {
  return !!store.getPolibioToken();
}

/**
 * Envía un texto (minuta o transcripción) al Anotador de Polibio.
 * Si no hay token configurado, no hace nada (devuelve {skipped:true}).
 */
export async function sendToPolibio(text, filename) {
  const token = store.getPolibioToken();
  if (!token) return { skipped: true };
  if (!text || text.trim().length < 10) return { skipped: true };

  const res = await fetch(POLIBIO_URL, {
    method: 'POST',
    headers: { apikey: POLIBIO_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, filename, token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `Polibio respondió ${res.status}`);
  return data;
}
