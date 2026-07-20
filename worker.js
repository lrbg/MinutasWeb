// Relay CORS para MinutasWeb (Cloudflare Worker).
//
// OpenAI no envía headers CORS, así que el navegador bloquea las llamadas
// directas. Este worker recibe la petición de la app, la reenvía tal cual a
// api.openai.com (incluida tu clave, que va en el header Authorization) y
// devuelve la respuesta añadiendo los headers CORS que faltan.
//
// El worker NO almacena ni lee tu clave: solo la pasa. Solo acepta peticiones
// desde los orígenes de la lista blanca (tu app), no es un proxy abierto.
//
// Despliegue: pega este archivo en un Worker de Cloudflare y publícalo.
// Luego copia la URL del worker (https://<algo>.workers.dev) en Ajustes.

const ALLOWED_ORIGINS = [
  'https://lrbg.github.io',
  'http://localhost:8777',
  'http://localhost:8000',
  'http://127.0.0.1:8777',
];

const UPSTREAM = 'https://api.openai.com';

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(allowOrigin) });
    }

    const url = new URL(request.url);
    const target = UPSTREAM + url.pathname + url.search;

    const headers = new Headers(request.headers);
    headers.delete('Host');
    headers.delete('Origin');

    const init = {
      method: request.method,
      headers,
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      init.body = request.body;
      init.duplex = 'half'; // requerido al reenviar body en streaming
    }

    let upstream;
    try {
      upstream = await fetch(target, init);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: { message: 'Proxy no pudo contactar a OpenAI: ' + err } }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...cors(allowOrigin) } }
      );
    }

    const out = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors(allowOrigin))) out.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
