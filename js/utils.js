/**
 * utils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fonctions utilitaires pures (sans effets de bord, sans état).
 * Chaque fonction est testable indépendamment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const Utils = (() => {

  // ── Formatage du temps ────────────────────────────────────────────────────

  /**
   * Convertit des secondes en chaîne "mm:ss".
   * @param {number} seconds — nombre de secondes (peut être NaN / Infinity)
   * @returns {string}
   */
  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  }

  // ── Algorithme de mélange ─────────────────────────────────────────────────

  /**
   * Fisher-Yates shuffle — mélange équitable, ne modifie pas le tableau source.
   * @param {Array} array
   * @returns {Array} nouveau tableau mélangé
   */
  function shuffle(array) {
    if (!Array.isArray(array)) return [];
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Mélange en garantissant que le premier élément ≠ firstExcluded.
   * Utile pour éviter qu'une boucle commence par la même piste que la précédente.
   * @param {Array} array
   * @param {*} firstExcluded — valeur à ne pas mettre en première position
   * @returns {Array}
   */
  function shuffleAvoidFirst(array, firstExcluded) {
    if (!Array.isArray(array) || array.length <= 1) return shuffle(array);
    let result;
    let attempts = 0;
    const MAX_ATTEMPTS = 10; // sécurité anti-boucle infinie
    do {
      result = shuffle(array);
      attempts++;
    } while (result[0] === firstExcluded && attempts < MAX_ATTEMPTS);
    return result;
  }

  // ── Calcul du silence ─────────────────────────────────────────────────────

  /**
   * Calcule la durée de silence dynamique par interpolation linéaire.
   *
   * Formule : f(x) = 60 × [ 1 + (x − xmin) / (xmax − xmin) ]
   *   → résultat entre 60 s (piste la plus courte) et 120 s (piste la plus longue)
   *
   * Cas limite : si xmin === xmax (toutes les pistes ont la même durée),
   *   retourne DEFAULT_SILENCE (60 s).
   *
   * @param {number} trackDuration   — durée de la piste actuelle (secondes)
   * @param {number} minDuration     — durée de la piste la plus courte
   * @param {number} maxDuration     — durée de la piste la plus longue
   * @returns {number} durée de silence en secondes
   */
  function computeAutoSilence(trackDuration, minDuration, maxDuration) {
    if (
      !Number.isFinite(trackDuration) ||
      !Number.isFinite(minDuration)   ||
      !Number.isFinite(maxDuration)
    ) {
      return CONFIG.SILENCE.DEFAULT;
    }

    // Cas limite : toutes les pistes ont la même durée
    if (maxDuration === minDuration) {
      return CONFIG.SILENCE.DEFAULT;
    }

    const ratio = (trackDuration - minDuration) / (maxDuration - minDuration);
    const silence = 60 * (1 + ratio);

    // Clamping de sécurité : jamais en dehors de [60, 120]
    return Math.min(120, Math.max(60, silence));
  }

  // ── Validation de la playlist ─────────────────────────────────────────────

  /**
   * Valide et assainit une entrée de playlist provenant du JSON.
   * Retourne null si l'entrée est invalide.
   * @param {*} raw — valeur brute du JSON
   * @param {number} index — index dans le tableau (pour les messages d'erreur)
   * @returns {{ id, title, artist, file, duration } | null}
   */
  function validateTrack(raw, index) {
    if (typeof raw !== 'object' || raw === null) {
      console.warn(`[Playlist] Piste #${index} ignorée : pas un objet.`);
      return null;
    }

    // Champ obligatoire : file
    if (typeof raw.file !== 'string' || raw.file.trim() === '') {
      console.warn(`[Playlist] Piste #${index} ignorée : champ "file" manquant.`);
      return null;
    }

    // Vérification de l'extension
    const ext = raw.file.split('.').pop().toLowerCase();
    if (!CONFIG.AUDIO.ALLOWED_EXTENSIONS.includes(ext)) {
      console.warn(`[Playlist] Piste #${index} ignorée : extension ".${ext}" non supportée.`);
      return null;
    }

    // Sanitisation des chaînes — on n'accepte que des chaînes, on coupe si trop long
    const sanitizeString = (val, fallback) => {
      if (typeof val !== 'string') return fallback;
      return val.trim().slice(0, CONFIG.PLAYLIST.MAX_STRING_LENGTH) || fallback;
    };

    return {
      id:       sanitizeString(raw.id, `track-${index}`),
      title:    sanitizeString(raw.title, `Piste ${index + 1}`),
      artist:   sanitizeString(raw.artist, ''),
      file:     raw.file.trim(),
      duration: typeof raw.duration === 'number' && raw.duration > 0
                  ? raw.duration
                  : null,
    };
  }

  /**
   * Valide un tableau de pistes JSON entier.
   * @param {*} raw — valeur brute parsée du JSON
   * @returns {Array} tableau de pistes valides (peut être vide)
   */
  function validatePlaylist(raw) {
    if (!Array.isArray(raw)) {
      throw new Error('La playlist doit être un tableau JSON.');
    }
    if (raw.length > CONFIG.PLAYLIST.MAX_TRACKS) {
      console.warn(`[Playlist] Tronquée à ${CONFIG.PLAYLIST.MAX_TRACKS} pistes.`);
      raw = raw.slice(0, CONFIG.PLAYLIST.MAX_TRACKS);
    }
    return raw.map(validateTrack).filter(Boolean);
  }

  // ── Clamp ─────────────────────────────────────────────────────────────────

  /**
   * Contraint une valeur entre min et max.
   */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // ── API publique ──────────────────────────────────────────────────────────
  return Object.freeze({
    formatTime,
    shuffle,
    shuffleAvoidFirst,
    computeAutoSilence,
    validateTrack,
    validatePlaylist,
    clamp,
  });

})();
