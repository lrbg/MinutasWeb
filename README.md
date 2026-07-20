# MinutasWeb

Transcribe reuniones en vivo y genera minutas con IA, desde el navegador. Es la versión web de una app de escritorio en Python/PyQt5: no hay que instalar nada, se abre una URL y se guarda como favorito.

Usa **OpenAI** (Whisper para transcribir, GPT para las minutas). Como OpenAI no permite llamadas directas desde el navegador (política CORS), la app se sirve **junto con un pequeño proxy** en Vercel, en el mismo dominio: así no hay CORS ni configuración de por medio.

## Qué hace

- **Transcripción en vivo** de tu micrófono y del audio de una pestaña compartida (para capturar a los demás en Zoom/Meet/Teams del navegador). Cada fuente aparece etiquetada ("Tú" / "Reunión").
- **Minuta automática**: un botón genera un resumen estructurado (título, participantes, puntos, decisiones, acciones, preguntas, conclusiones).
- **Detección de preguntas** por reglas y con IA, con respuestas bajo demanda.
- **Traducción** de la minuta a inglés.
- **Exportar** transcripción (`.txt`) y minuta (`.md`), o copiarlas.

## Puesta en marcha (una vez)

La app necesita el proxy, así que se despliega en **Vercel** (gratis). GitHub Pages no sirve porque no ejecuta el proxy.

1. Entra a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de **GitHub**.
2. **Add New… → Project** → importa el repo **`lrbg/MinutasWeb`**.
3. No hace falta configurar nada (framework: *Other*, sin build). Pulsa **Deploy**.
4. Vercel te da una URL, por ejemplo `https://minutasweb.vercel.app`. **Esa** es la que usas y guardas como favorito.

## Cómo se usa

1. Abre tu URL de Vercel → **Ajustes**.
2. Pega tu **clave API de OpenAI** (`sk-...`, de [platform.openai.com](https://platform.openai.com/api-keys)). Se guarda solo en tu navegador y viaja a OpenAI a través del proxy del propio sitio.
3. Elige las fuentes de audio y pulsa **Grabar**.
   - Para "Audio de pestaña", el navegador te pedirá elegir una pestaña y marcar **"Compartir audio"**.
4. Al terminar, pulsa **Generar minuta**.

## Requisitos y límites

- **Navegador**: Chrome o Edge (para capturar audio de pestaña con `getDisplayMedia`). El micrófono funciona en cualquiera.
- **Captura de "los demás"**: solo si la reunión corre en una **pestaña del navegador**. Con la app **nativa** de Zoom/Teams, solo se transcribe tu micrófono.
- **Costo**: usa tu saldo de OpenAI (Whisper se cobra por minuto de audio; las minutas, por tokens). Es de pago, pero sin los límites de cuota gratuita.

## Estructura

```
index.html            # UI
css/styles.css        # estilos (tema claro/oscuro automático)
api/[...path].js      # proxy a OpenAI (Edge Function de Vercel)
js/
  main.js             # arranque
  config.js           # valores por defecto (proxy, modelos, idioma)
  store.js            # localStorage (clave, ajustes, historial)
  ui.js               # DOM y eventos
  api/openai.js       # cliente de OpenAI vía el proxy same-origin
  audio/capture.js    # micrófono + pestaña, captura PCM y arma WAV, medidores
  features/
    transcription.js  # orquesta la sesión de transcripción
    minute.js         # genera la minuta
    questions.js      # detección de preguntas y respuestas
    translate.js      # traducción
manifest.json         # PWA
```

## Nota técnica

Whisper acepta WAV, así que `capture.js` toma el audio crudo (PCM) con la Web Audio API a 16 kHz y arma un WAV por segmento. El proxy (`api/[...path].js`) reenvía cada petición a `api.openai.com` añadiendo tu clave; no la guarda.

## Privacidad

Tu clave y tus transcripciones se guardan **solo en tu navegador**. El proxy solo reenvía a OpenAI, sin almacenar nada. No hay analítica ni base de datos.
