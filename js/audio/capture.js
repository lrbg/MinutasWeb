// Captura de audio de dos fuentes (micrófono y pestaña) en segmentos WAV.
//
// Gemini acepta WAV/MP3/OGG/FLAC pero NO el webm/opus que produce MediaRecorder
// en Chrome. Por eso capturamos el PCM con Web Audio (a 16 kHz mono) y armamos
// un WAV por segmento. Un medidor de nivel sirve para pintar la barra y para
// descartar segmentos que fueron prácticamente silencio.

// Convierte muestras Float32 mono a un Blob WAV PCM 16-bit.
function pcmToWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
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
    this.chunks = [];
    this.samplesInSegment = 0;
    this.peak = 0;
  }

  start() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    this.sampleRate = this.ctx.sampleRate; // puede no ser exactamente 16000
    this.segmentSamples = Math.floor((this.sampleRate * this.segmentMs) / 1000);

    this.srcNode = this.ctx.createMediaStreamSource(this.stream);

    // ── Cadena de limpieza de voz (antes de encodear) ──
    // Pasa-altos: elimina rumble/zumbido de baja frecuencia (aire, ventilador, golpes).
    this.highpass = this.ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 90;
    // Pasa-bajos suave: recorta siseo muy agudo sin sonar telefónico.
    this.lowpass = this.ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 7500;
    // Compresor: nivela la dinámica y realza la voz baja sobre el ruido de fondo.
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -40;
    this.comp.knee.value = 30;
    this.comp.ratio.value = 12;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.25;
    // Ganancia de realce tras el compresor.
    this.makeup = this.ctx.createGain();
    this.makeup.gain.value = 1.6;

    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.active) return;
      const input = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));
      this.samplesInSegment += input.length;

      // Nivel (RMS) para el medidor y la detección de silencio.
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      const level = Math.min(100, Math.round(Math.sqrt(sum / input.length) * 300));
      this.peak = Math.max(this.peak, level);
      this.onLevel(this.source, level);

      if (this.samplesInSegment >= this.segmentSamples) this._flush();
    };

    // El nodo debe estar conectado para procesar; un gain a 0 evita el eco.
    this.mute = this.ctx.createGain();
    this.mute.gain.value = 0;
    // source → highpass → lowpass → compresor → realce → processor → mute(0) → destino
    this.srcNode.connect(this.highpass);
    this.highpass.connect(this.lowpass);
    this.lowpass.connect(this.comp);
    this.comp.connect(this.makeup);
    this.makeup.connect(this.processor);
    this.processor.connect(this.mute);
    this.mute.connect(this.ctx.destination);

    this.active = true;
  }

  _flush() {
    const total = this.samplesInSegment;
    if (total === 0) return;
    const merged = new Float32Array(total);
    let off = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, off);
      off += chunk.length;
    }
    const hadVoice = this.peak >= this.silenceThreshold;
    this.chunks = [];
    this.samplesInSegment = 0;
    this.peak = 0;

    if (hadVoice) {
      // Normalizar el segmento: sube la voz baja a buen volumen (con tope de
      // amplificación para no inflar el ruido de fondo cuando casi no hay señal).
      let peakAmp = 0;
      for (let i = 0; i < merged.length; i++) {
        const a = merged[i] < 0 ? -merged[i] : merged[i];
        if (a > peakAmp) peakAmp = a;
      }
      if (peakAmp > 0.002) {
        const gain = Math.min(4, 0.95 / peakAmp);
        for (let i = 0; i < merged.length; i++) merged[i] *= gain;
      }
      this.onSegment(pcmToWav(merged, this.sampleRate), this.source);
    }
  }

  stop() {
    this.active = false;
    this._flush(); // envía lo que quede del último segmento
    if (this.onLevel) this.onLevel(this.source, 0);
    try {
      for (const n of [this.processor, this.mute, this.makeup, this.comp, this.lowpass, this.highpass, this.srcNode]) {
        if (n) n.disconnect();
      }
      if (this.ctx) this.ctx.close();
    } catch {
      /* noop */
    }
    this.stream.getTracks().forEach((t) => t.stop());
  }
}

export class AudioCapture {
  constructor({ segmentSeconds = 15, silenceThreshold = 4, onSegment, onLevel } = {}) {
    this.segmentMs = segmentSeconds * 1000;
    this.silenceThreshold = silenceThreshold;
    this.onSegment = onSegment;
    this.onLevel = onLevel || (() => {});
    this.recorders = [];
  }

  // Arranca el micrófono. Lanza si el usuario niega el permiso.
  async startMic() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this._addSource(stream, 'mic');
  }

  // Arranca la captura de audio de una pestaña compartida.
  async startTab() {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('No compartiste audio. Vuelve a intentar y marca "Compartir audio de la pestaña".');
    }
    stream.getVideoTracks().forEach((t) => t.stop());
    this._addSource(new MediaStream(audioTracks), 'tab');
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
