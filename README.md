# MinutasWeb

Transcribe reuniones en vivo y genera minutas con IA, **todo en el navegador**. Sin instalar nada, sin servidor, sin proxy.

Es la versión web de una app de escritorio en Python/PyQt5: aquí no hay que instalar Python ni empaquetar nada. Abres una URL, la guardas como favorito y listo. Usa **Google Gemini**, que permite llamarse directamente desde el navegador (a diferencia de OpenAI, que requiere un proxy por su política CORS).

## Qué hace

- **Transcripción en vivo** de tu micrófono y del audio de una pestaña compartida (para capturar a los demás en Zoom/Meet/Teams del navegador). Cada fuente se muestra etiquetada ("Tú" / "Reunión").
- **Minuta automática**: un botón genera un resumen estructurado (título, participantes, puntos, decisiones, acciones, preguntas, conclusiones).
- **Detección de preguntas** por reglas y con IA, con respuestas generadas bajo demanda.
- **Traducción** de la minuta a inglés.
- **Exportar** la transcripción (`.txt`) y la minuta (`.md`), o copiarlas al portapapeles.

## Cómo se usa

1. Consigue una **clave API gratuita** en [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (empieza con `AIza...`).
2. Abre la app (ver *Publicar* abajo) → **Ajustes** → pega la clave. Se guarda **solo en tu navegador** (`localStorage`) y solo se envía a Google.
3. Elige las fuentes de audio y pulsa **Grabar**.
   - Para "Audio de pestaña", el navegador te pedirá elegir una pestaña y marcar **"Compartir audio"**.
4. Al terminar, pulsa **Generar minuta**.

## Requisitos y límites

- **Navegador**: Chrome o Edge (necesarios para capturar audio de pestaña con `getDisplayMedia`). El micrófono funciona en cualquiera.
- **Captura de "los demás"**: solo funciona si la reunión corre en una **pestaña del navegador**. Con la app **nativa** de Zoom/Teams, el navegador no puede tomar ese audio; ahí solo se transcribe tu micrófono.
- **Costo**: usa tu propia clave de Google AI Studio. El plan gratuito tiene un límite de peticiones por minuto; por eso la app transcribe en segmentos de ~15s (configurable). Si te topas con el límite, sube la duración del segmento en Ajustes.
- El texto aparece cada pocos segundos (por segmento), no palabra por palabra.

## Publicar (GitHub Pages)

Este repo es 100% estático. Para servirlo:

1. Sube estos archivos a la rama `main`.
2. En GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. La app queda en `https://lrbg.github.io/MinutasWeb/`. Guárdala como favorito o "Instalar app" (PWA).

Para probar en local basta un servidor estático (por ejemplo `python3 -m http.server`) porque los módulos ES no cargan con `file://`.

## Estructura

```
index.html            # UI
css/styles.css        # estilos (tema claro/oscuro automático)
js/
  main.js             # arranque
  config.js           # valores por defecto (modelo, idioma, segmento)
  store.js            # localStorage (clave, ajustes, historial)
  ui.js               # DOM y eventos
  api/gemini.js       # cliente de Google Gemini (transcribe + genera texto)
  audio/capture.js    # micrófono + pestaña, captura PCM y arma WAV, medidores
  features/
    transcription.js  # orquesta la sesión de transcripción
    minute.js         # genera la minuta
    questions.js      # detección de preguntas y respuestas
    translate.js      # traducción
manifest.json         # PWA
```

## Nota técnica

Gemini acepta audio en WAV/MP3/OGG/FLAC, pero no el `webm/opus` que graba Chrome por defecto. Por eso `capture.js` toma el audio crudo (PCM) con la Web Audio API a 16 kHz y arma un WAV por segmento antes de enviarlo.

## Privacidad

Tu clave API y tus transcripciones se guardan **solo en tu navegador**. Las peticiones van directas a la API de Google, sin intermediarios. No hay analítica ni base de datos.
