// Capa de presentación: conecta el DOM con las features.
import { store } from './store.js';
import { validateKey } from './api/openai.js';
import { TranscriptionSession } from './features/transcription.js';
import { generateMinute } from './features/minute.js';
import { analyzeQuestions, answerQuestion } from './features/questions.js';
import { translate } from './features/translate.js';

const $ = (sel) => document.querySelector(sel);

let session = null;
let lastMinute = '';

const el = {};

export function initUI() {
  cacheElements();
  loadSettingsIntoForm();
  refreshApiBadge();
  bindEvents();
}

function cacheElements() {
  el.apiBadge = $('#api-badge');
  el.btnSettings = $('#btn-settings');
  el.settingsModal = $('#settings-modal');
  el.inputApiKey = $('#input-apikey');
  el.inputLanguage = $('#input-language');
  el.inputSegment = $('#input-segment');
  el.inputTranscribeModel = $('#input-transcribe-model');
  el.inputChatModel = $('#input-chat-model');
  el.btnSaveSettings = $('#btn-save-settings');

  el.srcMic = $('#src-mic');
  el.srcTab = $('#src-tab');
  el.btnRecord = $('#btn-record');
  el.recordLabel = $('.btn-record-label');
  el.status = $('#status');
  el.lvlMic = $('#lvl-mic');
  el.lvlTab = $('#lvl-tab');

  el.transcript = $('#transcript');
  el.transcriptEmpty = $('#transcript-empty');
  el.btnMinute = $('#btn-minute');
  el.btnExport = $('#btn-export');
  el.btnCopy = $('#btn-copy');
  el.btnClear = $('#btn-clear');

  el.questions = $('#questions');
  el.btnAnalyzeQ = $('#btn-analyze-q');

  el.minuteModal = $('#minute-modal');
  el.minuteStatus = $('#minute-status');
  el.minuteOutput = $('#minute-output');
  el.btnMinuteTranslate = $('#btn-minute-translate');
  el.btnMinuteCopy = $('#btn-minute-copy');
  el.btnMinuteDownload = $('#btn-minute-download');

  el.toast = $('#toast');
}

function bindEvents() {
  el.btnSettings.addEventListener('click', () => openModal(el.settingsModal));
  el.btnSaveSettings.addEventListener('click', saveSettings);
  document.querySelectorAll('[data-close-modal]').forEach((b) =>
    b.addEventListener('click', (e) => closeModal(e.target.closest('.modal')))
  );
  document.querySelectorAll('.modal').forEach((m) =>
    m.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m);
    })
  );

  el.btnRecord.addEventListener('click', toggleRecording);
  el.btnMinute.addEventListener('click', doMinute);
  el.btnExport.addEventListener('click', exportTranscript);
  el.btnCopy.addEventListener('click', copyTranscript);
  el.btnClear.addEventListener('click', clearAll);
  el.btnAnalyzeQ.addEventListener('click', doAnalyzeQuestions);

  el.btnMinuteTranslate.addEventListener('click', translateMinute);
  el.btnMinuteCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(lastMinute);
    toast('Minuta copiada');
  });
  el.btnMinuteDownload.addEventListener('click', downloadMinute);
}

/* ---------- Ajustes ---------- */
function loadSettingsIntoForm() {
  const s = store.getSettings();
  el.inputApiKey.value = store.getApiKey();
  el.inputLanguage.value = s.language;
  el.inputSegment.value = s.segmentSeconds;
  el.inputTranscribeModel.value = s.transcribeModel;
  el.inputChatModel.value = s.chatModel;
}

async function saveSettings() {
  store.setApiKey(el.inputApiKey.value);
  store.setSettings({
    language: el.inputLanguage.value,
    segmentSeconds: Math.max(5, Math.min(30, Number(el.inputSegment.value) || 12)),
    transcribeModel: el.inputTranscribeModel.value.trim() || 'gpt-4o-mini-transcribe',
    chatModel: el.inputChatModel.value.trim() || 'gpt-4o-mini',
  });
  closeModal(el.settingsModal);
  refreshApiBadge();
  toast('Ajustes guardados');

  if (store.hasApiKey()) {
    try {
      const ok = await validateKey();
      if (!ok) toast('La clave API parece inválida', true);
    } catch { /* la validación es best-effort */ }
  }
}

function refreshApiBadge() {
  if (store.hasApiKey()) {
    el.apiBadge.textContent = 'Clave API lista';
    el.apiBadge.className = 'badge badge-ok';
  } else {
    el.apiBadge.textContent = 'Sin clave API';
    el.apiBadge.className = 'badge badge-warn';
  }
}

/* ---------- Grabación ---------- */
async function toggleRecording() {
  if (session && session.running) {
    stopRecording();
    return;
  }
  if (!store.hasApiKey()) {
    toast('Primero agrega tu clave API en Ajustes', true);
    openModal(el.settingsModal);
    return;
  }
  const mic = el.srcMic.checked;
  const tab = el.srcTab.checked;
  if (!mic && !tab) {
    toast('Elige al menos una fuente de audio', true);
    return;
  }

  session = new TranscriptionSession({
    onEntry: renderEntry,
    onLevel: renderLevel,
    onError: (err) => toast(err.message, true),
  });

  setStatus('Solicitando permisos…');
  try {
    await session.start({ mic, tab });
  } catch (err) {
    toast(err.message, true);
    setStatus('Listo');
    session = null;
    return;
  }

  el.btnRecord.classList.add('recording');
  el.recordLabel.textContent = 'Detener';
  setStatus('Grabando…');
  setToolButtons(true);
}

function stopRecording() {
  if (session) session.stop();
  el.btnRecord.classList.remove('recording');
  el.recordLabel.textContent = 'Grabar';
  renderLevel('mic', 0);
  renderLevel('tab', 0);
  const n = session ? session.entries.length : 0;
  setStatus(n ? `Detenido · ${n} segmentos` : 'Detenido');
}

/* ---------- Render de transcripción ---------- */
function renderEntry(entry) {
  if (el.transcriptEmpty) {
    el.transcriptEmpty.remove();
    el.transcriptEmpty = null;
  }
  const div = document.createElement('div');
  div.className = `entry ${entry.source}${entry.isQuestion ? ' is-question' : ''}`;
  const t = entry.ts.toLocaleTimeString('es-MX', { hour12: false });
  const who = entry.source === 'mic' ? 'Tú' : 'Reunión';
  div.innerHTML =
    `<span class="ts">${t}</span>` +
    `<span class="who">${who}</span>` +
    `<span class="text"></span>`;
  div.querySelector('.text').textContent = entry.text;
  el.transcript.appendChild(div);
  el.transcript.scrollTop = el.transcript.scrollHeight;

  if (entry.isQuestion) addRuleQuestion(entry.text);
}

function renderLevel(source, level) {
  const bar = source === 'mic' ? el.lvlMic : el.lvlTab;
  if (bar) bar.style.width = `${level}%`;
}

function setStatus(text) {
  el.status.textContent = text;
}

function setToolButtons(hasData) {
  [el.btnMinute, el.btnExport, el.btnCopy, el.btnClear, el.btnAnalyzeQ].forEach(
    (b) => (b.disabled = !hasData)
  );
}

/* ---------- Preguntas ---------- */
const seenQuestions = new Set();
function addRuleQuestion(text) {
  const key = text.trim().toLowerCase();
  if (seenQuestions.has(key)) return;
  seenQuestions.add(key);
  clearQuestionsEmpty();

  const item = document.createElement('div');
  item.className = 'q-item';
  item.innerHTML =
    `<div class="q-text"></div>` +
    `<button class="btn btn-ghost btn-sm btn-answer" type="button">Responder con IA</button>` +
    `<div class="q-answer" hidden></div>`;
  item.querySelector('.q-text').textContent = text;
  const answerBox = item.querySelector('.q-answer');
  item.querySelector('.btn-answer').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Pensando…';
    try {
      const ans = await answerQuestion(text, store.getSettings().language || 'es');
      answerBox.textContent = ans;
      answerBox.hidden = false;
      btn.remove();
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = 'Responder con IA';
    }
  });
  el.questions.appendChild(item);
}

function clearQuestionsEmpty() {
  const empty = el.questions.querySelector('.empty');
  if (empty) empty.remove();
}

async function doAnalyzeQuestions() {
  if (!session || !session.entries.length) return;
  el.btnAnalyzeQ.disabled = true;
  el.btnAnalyzeQ.textContent = 'Analizando…';
  try {
    const segments = session.entries.map((e) => e.text);
    const found = await analyzeQuestions(segments);
    found.forEach((q) => addRuleQuestion(q.question));
    toast(found.length ? `${found.length} preguntas detectadas` : 'Sin preguntas nuevas');
  } catch (err) {
    toast(err.message, true);
  } finally {
    el.btnAnalyzeQ.disabled = false;
    el.btnAnalyzeQ.textContent = 'Analizar con IA';
  }
}

/* ---------- Minuta ---------- */
async function doMinute() {
  if (!session || !session.entries.length) {
    toast('No hay transcripción todavía', true);
    return;
  }
  openModal(el.minuteModal);
  el.minuteStatus.hidden = false;
  el.minuteStatus.textContent = 'Generando minuta…';
  el.minuteOutput.innerHTML = '';
  try {
    const md = await generateMinute(session.getTranscript());
    lastMinute = md;
    el.minuteStatus.hidden = true;
    el.minuteOutput.innerHTML = mdToHtml(md);
    store.addToHistory({ date: new Date().toISOString(), minute: md });
  } catch (err) {
    el.minuteStatus.hidden = true;
    el.minuteOutput.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
  }
}

async function translateMinute() {
  if (!lastMinute) return;
  el.btnMinuteTranslate.disabled = true;
  el.btnMinuteTranslate.textContent = 'Traduciendo…';
  try {
    const en = await translate(lastMinute, 'en');
    lastMinute = en;
    el.minuteOutput.innerHTML = mdToHtml(en);
    toast('Minuta traducida');
  } catch (err) {
    toast(err.message, true);
  } finally {
    el.btnMinuteTranslate.disabled = false;
    el.btnMinuteTranslate.textContent = 'Traducir a inglés';
  }
}

function downloadMinute() {
  if (!lastMinute) return;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
  download(`minuta_${stamp}.md`, lastMinute);
}

/* ---------- Exportar / limpiar ---------- */
function exportTranscript() {
  if (!session || !session.entries.length) return;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
  download(`transcripcion_${stamp}.txt`, session.getTranscript());
}

function copyTranscript() {
  if (!session) return;
  navigator.clipboard.writeText(session.getTranscript());
  toast('Transcripción copiada');
}

function clearAll() {
  if (session && session.running) {
    toast('Detén la grabación primero', true);
    return;
  }
  if (session) session.clear();
  seenQuestions.clear();
  el.transcript.innerHTML =
    '<p class="empty" id="transcript-empty">La transcripción aparecerá aquí en cuanto empieces a grabar.</p>';
  el.transcriptEmpty = $('#transcript-empty');
  el.questions.innerHTML = '<p class="empty">Las preguntas del diálogo aparecerán aquí.</p>';
  setToolButtons(false);
  setStatus('Listo');
}

/* ---------- Utilidades ---------- */
function openModal(m) { m.hidden = false; }
function closeModal(m) { if (m) m.hidden = true; }

let toastTimer = null;
function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.className = `toast${isError ? ' err' : ''}`;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.toast.hidden = true), 3200);
}

function download(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// Markdown mínimo: encabezados, listas, negritas y párrafos.
function mdToHtml(md) {
  const lines = escapeHtml(md).split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };

  for (const raw of lines) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^###\s+/.test(line)) { closeList(); html += `<h3>${line.replace(/^###\s+/, '')}</h3>`; }
    else if (/^##\s+/.test(line)) { closeList(); html += `<h2>${line.replace(/^##\s+/, '')}</h2>`; }
    else if (/^#\s+/.test(line)) { closeList(); html += `<h1>${line.replace(/^#\s+/, '')}</h1>`; }
    else if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${line.replace(/^\s*[-*]\s+/, '')}</li>`;
    }
    else if (/^\s*\d+\.\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${line.replace(/^\s*\d+\.\s+/, '')}</li>`;
    }
    else if (line.trim() === '') { closeList(); }
    else { closeList(); html += `<p>${line}</p>`; }
  }
  closeList();
  return html;
}
