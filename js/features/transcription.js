// Orquesta una sesión de transcripción: captura -> segmentos -> Whisper -> texto.
import { AudioCapture } from '../audio/capture.js';
import { transcribe } from '../api/openai.js';
import { store } from '../store.js';
import { TRANSCRIBE_PROMPT } from '../config.js';
import { looksLikeQuestion } from './questions.js';

export class TranscriptionSession {
  constructor({ onEntry, onLevel, onError } = {}) {
    this.onEntry = onEntry || (() => {});
    this.onLevel = onLevel || (() => {});
    this.onError = onError || (() => {});
    this.entries = [];
    this.pending = 0;
    this.running = false;
  }

  async start({ mic = true, tab = true } = {}) {
    if (this.running) return;
    const s = store.getSettings();
    this.capture = new AudioCapture({
      segmentSeconds: s.segmentSeconds,
      silenceThreshold: s.silenceThreshold,
      onSegment: (blob, source) => this._handleSegment(blob, source),
      onLevel: this.onLevel,
    });

    // El micrófono primero (permiso simple); la pestaña después (elige ventana).
    if (mic) await this.capture.startMic();
    if (tab) await this.capture.startTab();

    if (this.capture.sourceCount === 0) {
      throw new Error('No se activó ninguna fuente de audio.');
    }
    this.running = true;
  }

  async _handleSegment(blob, source) {
    this.pending++;
    try {
      const text = await transcribe(blob, { prompt: TRANSCRIBE_PROMPT });
      if (text) {
        const entry = {
          text,
          source,
          ts: new Date(),
          isQuestion: looksLikeQuestion(text),
        };
        this.entries.push(entry);
        this.onEntry(entry);
      }
    } catch (err) {
      this.onError(err);
    } finally {
      this.pending--;
    }
  }

  stop() {
    if (this.capture) this.capture.stop();
    this.running = false;
  }

  // Texto plano de toda la sesión, con hora y hablante.
  getTranscript() {
    return this.entries
      .map((e) => {
        const t = e.ts.toLocaleTimeString('es-MX', { hour12: false });
        const who = e.source === 'mic' ? 'Tú' : 'Reunión';
        return `[${t}] ${who}: ${e.text}`;
      })
      .join('\n');
  }

  getQuestions() {
    return this.entries.filter((e) => e.isQuestion).map((e) => e.text);
  }

  clear() {
    this.entries = [];
  }
}
