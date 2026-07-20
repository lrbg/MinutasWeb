# MinutasWeb

Transcribe reuniones en vivo y genera minutas con IA, **todo en el navegador**. Sin instalar nada, sin servidor propio.

Es la versión web de una app de escritorio en Python/PyQt5: aquí no hay que instalar Python, PyAudio ni empaquetar nada. Abres una URL, la guardas como favorito y listo.

## Qué hace

- **Transcripción en vivo** de tu micrófono y del audio de una pestaña compartida (para capturar a los demás en Zoom/Meet/Teams del navegador). Cada fuente se muestra etiquetada ("Tú" / "Reunión").
- **Minuta automática**: un botón genera un resumen estructurado (título, participantes, puntos, decisiones, acciones, preguntas, conclusiones).
- **Detección de preguntas** por reglas y con IA, con respuestas generadas bajo demanda.
- **Traducción** de la minuta a inglés.
- **Exportar** la transcripción (`.txt`) y la minuta (`.md`), o copiarlas al portapapeles.

## Cómo se usa

1. Abre la app (ver *Publicar* abajo) y entra a **Ajustes**.
2. Pega tu **clave API de OpenAI** (`sk-...`). Se guarda **solo en tu navegador** (`localStorage`) y solo se envía a `api.openai.com`. No hay backend intermedio.
3. Elige las fuentes de audio y pulsa **Grabar**.
   - Para "Audio de pestaña", el navegador te pedirá elegir una pestaña y marcar **"Compartir audio"**.
4. Al terminar, pulsa **Generar minuta**.

## Requisitos y límites

- **Navegador**: Chrome o Edge (necesarios para capturar audio de pestaña con `getDisplayMedia`). El micrófono funciona en cualquiera.
- **Captura de "los demás"**: solo funciona si la reunión corre en una **pestaña del navegador**. Con la app **nativa** de Zoom/Teams, el navegador no puede tomar ese audio; ahí solo se transcribe tu micrófono.
- **Costo**: usa tu propia cuota de OpenAI. La transcripción se cobra por minuto de audio; la minuta y las respuestas, por tokens.
- La transcripción se hace por segmentos (~12s configurable): el texto aparece cada pocos segundos, no palabra por palabra.

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
  config.js           # valores por defecto
  store.js            # localStorage (clave, ajustes, historial)
  ui.js               # DOM y eventos
  api/openai.js       # cliente de OpenAI (transcribe + chat)
  audio/capture.js    # micrófono + pestaña, segmentación y medidores
  features/
    transcription.js  # orquesta la sesión de transcripción
    minute.js         # genera la minuta
    questions.js      # detección de preguntas y respuestas
    translate.js      # traducción
manifest.json         # PWA
```

## Privacidad

Tu clave API y tus transcripciones **no salen de tu navegador** salvo las llamadas directas a OpenAI. No hay analítica ni servidor propio.
