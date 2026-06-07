/**
 * config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuration centrale de l'application.
 * Toutes les valeurs configurables sont ici — ne jamais les disperser dans le code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const CONFIG = Object.freeze({

  // ── Playlist ──────────────────────────────────────────────────────────────
  PLAYLIST_URL: 'playlist.json',

  // ── Silence entre les pistes ──────────────────────────────────────────────
  SILENCE: Object.freeze({
    // Durée fixe courte (secondes)
    SHORT:   60,
    // Durée fixe longue (secondes)
    LONG:    120,
    // Valeur de repli si toutes les pistes ont la même durée (mode auto)
    DEFAULT: 60,
    // Modes disponibles exposés à l'UI
    MODES: Object.freeze(['off', 'short', 'long', 'auto']),
  }),

  // ── Audio ─────────────────────────────────────────────────────────────────
  AUDIO: Object.freeze({
    // Formats acceptés (validation côté client)
    ALLOWED_EXTENSIONS: Object.freeze(['mp3', 'ogg', 'wav', 'flac', 'aac', 'm4a']),
    // Volume initial (0–1)
    DEFAULT_VOLUME: 0.8,
    // Tolérance de fin de piste (secondes) — pour éviter les micro-sauts
    END_THRESHOLD: 0.3,
  }),

  // ── Validation de la playlist JSON ───────────────────────────────────────
  PLAYLIST: Object.freeze({
    // Nombre maximum de pistes autorisées (sécurité)
    MAX_TRACKS: 500,
    // Longueur maximale d'un titre ou artiste
    MAX_STRING_LENGTH: 200,
  }),

  // ── Interface ─────────────────────────────────────────────────────────────
  UI: Object.freeze({
    // Fréquence de mise à jour de la barre de progression (ms)
    PROGRESS_UPDATE_MS: 250,
    // Durée des transitions CSS (ms) — doit correspondre au CSS
    TRANSITION_MS: 300,
  }),

});
