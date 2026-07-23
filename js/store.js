// Persistencia en localStorage: clave API, ajustes e historial de minutas.
import { DEFAULTS } from './config.js';

const K = {
  apiKey: 'minutasweb.apiKey',
  settings: 'minutasweb.settings',
  history: 'minutasweb.history',
};

export const store = {
  getApiKey() {
    return localStorage.getItem(K.apiKey) || '';
  },
  setApiKey(value) {
    if (value) localStorage.setItem(K.apiKey, value.trim());
    else localStorage.removeItem(K.apiKey);
  },
  hasApiKey() {
    return !!this.getApiKey();
  },

  // Token del Anotador de Polibio (para sincronizar minutas). Solo en el navegador.
  getPolibioToken() {
    return localStorage.getItem('minutasweb.polibioToken') || '';
  },
  setPolibioToken(value) {
    if (value) localStorage.setItem('minutasweb.polibioToken', value.trim());
    else localStorage.removeItem('minutasweb.polibioToken');
  },

  // Ajustes: se combinan con los valores por defecto.
  getSettings() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(K.settings) || '{}');
    } catch {
      saved = {};
    }
    return { ...DEFAULTS, ...saved };
  },
  setSettings(partial) {
    const merged = { ...this.getSettings(), ...partial };
    localStorage.setItem(K.settings, JSON.stringify(merged));
    return merged;
  },

  // Historial de minutas generadas.
  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(K.history) || '[]');
    } catch {
      return [];
    }
  },
  addToHistory(entry) {
    const list = this.getHistory();
    list.unshift(entry);
    localStorage.setItem(K.history, JSON.stringify(list.slice(0, 50)));
  },
};
