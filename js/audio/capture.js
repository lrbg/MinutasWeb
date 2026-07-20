// Captura de audio de dos fuentes (micrófono y pestaña) en segmentos
// independientes listos para mandar a transcribir.
//
// Cada fuente graba en ciclos: start() -> a los N segundos stop() -> el blob
// resultante es un archivo webm/mp4 válido por sí solo -> callback -> reinicia.
// Un AnalyserNode mide el nivel para (a) pintar el medidor y (b) descartar
// segmentos que fueron prácticamente silencio.

function pickMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  for (const t of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

class SourceRecorder {
  constructor({ stream, source, segmentMs, silenceThreshold, onSegment, onLevel }) {
    this.stream = stream;
    this.source = source;
    this.segmentMs = segmentMs;
    this.silenceThreshold = silenceThreshold;
    this.onSegment = onSegment;
    this.onLevel = onLevel;
    this.active = false;
    this.peak = 0;
    this.mimeType = pickMimeType();
    this._chunks = [];
    this._raf = null;
    this._timer = null;
  }

  start() {
    this.active = true;
    this._setupMeter();
    this._cycle();
  }

  _setupMeter() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      this._data = new Uint8Array(this.analyser.frequencyBinCount);
      this._tick();
    } catch {
      // Si el medidor falla, seguimos grabando sin él.
    }
  }

  _tick() {
    if (!this.active || !this.analyser) return;
    this.analyser.getByteTimeDomainData(this._data);
    let sum = 0;
    for (let i = 0; i < this._data.length; i++) {
      const v = (this._data[i] - 128) / 128;
      sum += v * v;
    }
    const level = Math.min(100, Math.round(Math.sqrt(sum / this._data.length) * 240));
    this.peak = Math.max(this.peak, level);
    if (this.onLevel) this.onLevel(this.source, level);
    this._raf = requestAnimationFrame(() => this._tick());
  }

  _cycle() {
    if (!this.active) return;
    this._chunks = [];
    this.peak = 0;
    this.recorder = new MediaRecorder(
      this.stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined
    );
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this._chunks.push(e.data);
    };
    this.recorder.onstop = () => {
      const hadVoice = this.peak >= this.silenceThreshold;
      if (this._chunks.length && hadVoice) {
        const blob = new Blob(this._chunks, { type: this.mimeType || 'audio/webm' });
        this.onSegment(blob, this.source);
      }
      if (this.active) this._cycle();
    };
    this.recorder.start();
    this._timer = setTimeout(() => {
      if (this.recorder && this.recorder.state === 'recording') this.recorder.stop();
    }, this.segmentMs);
  }

  stop() {
    this.active = false;
    clearTimeout(this._timer);
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.onLevel) this.onLevel(this.source, 0);
    try {
      if (this.recorder && this.recorder.state === 'recording') this.recorder.stop();
    } catch { /* noop */ }
    if (this.audioCtx) this.audioCtx.close().catch(() => {});
    this.stream.getTracks().forEach((t) => t.stop());
  }
}

export class AudioCapture {
  constructor({ segmentSeconds = 12, silenceThreshold = 4, onSegment, onLevel } = {}) {
    this.segmentMs = segmentSeconds * 1000;
    this.silenceThreshold = silenceThreshold;
    this.onSegment = onSegment;
    this.onLevel = onLevel || (() => {});
    this.recorders = [];
  }

  // Arranca el micrófono. Lanza si el usuario niega el permiso.
  async startMic() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    this._addSource(stream, 'mic');
  }

  // Arranca la captura de audio de una pestaña compartida.
  // El usuario debe elegir una pestaña y marcar "compartir audio".
  async startTab() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('No compartiste audio. Vuelve a intentar y marca "Compartir audio de la pestaña".');
    }
    // Descartamos el video: solo queremos el audio.
    stream.getVideoTracks().forEach((t) => t.stop());
    const audioOnly = new MediaStream(audioTracks);
    this._addSource(audioOnly, 'tab');
  }

  _addSource(stream, source) {
    const rec = new SourceRecorder({
      stream,
      source,
      segmentMs: this.segmentMs,
      silenceThreshold: this.silenceThreshold,
      onSegment: this.onSegment,
      onLevel: this.onLevel,
    });
    rec.start();
    this.recorders.push(rec);
  }

  stop() {
    this.recorders.forEach((r) => r.stop());
    this.recorders = [];
  }

  get sourceCount() {
    return this.recorders.length;
  }
}

export { pickMimeType };
