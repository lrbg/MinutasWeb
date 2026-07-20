// Proxy de OpenAI como Edge Function de Vercel.
//
// Se despliega junto con la web (mismo origen), así que la app llama a rutas
// relativas /api/v1/... y NO hay problema de CORS. Solo reenvía la petición a
// api.openai.com pasando la clave del header Authorization; no la almacena.
//
// Edge runtime: usa Request/Response estándar y reenvía el cuerpo en streaming,
// así que el audio (multipart) pasa intacto.
export const config = { runtime: 'edge' };

const UPSTREAM = 'https://api.openai.com';

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, ''); // v1/audio/transcriptions, etc.
  const target = `${UPSTREAM}/${path}${url.search}`;

  const headers = new Headers();
  const auth = request.headers.get('authorization');
  const ct = request.headers.get('content-type');
  if (auth) headers.set('authorization', auth);
  if (ct) headers.set('content-type', ct);

  const init = { method: request.method, headers };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body;
    init.duplex = 'half'; // requerido al reenviar un body en streaming
  }

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: 'El proxy no pudo contactar a OpenAI: ' + err } }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
