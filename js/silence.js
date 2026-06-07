/**
 * silence.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Module de silence entre les pistes.
 * Le silence est NON-BLOQUANT : il utilise setTimeout, pas de fichier audio.
 * L'interface reste totalement réactive pendant le silence.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const SilenceManager = (() => {

  // ── État interne ──────────────────────────────────────────────────────────

  let _mode          = 'off';   // 'off' | 'short' | 'long' | 'auto'
  let _timerId       = null;    // référence du setTimeout courant
  let _startTime     = null;    // Date.now() au début du silence
  let _totalDuration = 0;       // durée totale du silence en cours (ms)
  let _onEndCallback = null;    // appelée quand le silence se termine
  let _onTickCallback = null;   // appelée chaque seconde (pour afficher le compte à rebours)
  let _tickInterval  = null;    // référence du setInterval de tick

  // ── Helpers privés ────────────────────────────────────────────────────────

  /** Calcule la durée de silence en secondes selon le mode et la piste courante. */
  function _computeDuration(lastTrackDuration) {
    switch (_mode) {
      case 'short': return CONFIG.SILENCE.SHORT;
      case 'long':  return CONFIG.SILENCE.LONG;
      case 'auto': {
        const range = PlaylistManager.getDurationRange();
        if (!range) return CONFIG.SILENCE.DEFAULT;
        return Utils.computeAutoSilence(
          lastTrackDuration ?? CONFIG.SILENCE.DEFAULT,
          range.min,
          range.max
        );
      }
      default: return 0;
    }
  }

  /** Nettoie tous les timers en cours. */
  function _clearTimers() {
    if (_timerId !== null) {
      clearTimeout(_timerId);
      _timerId = null;
    }
    if (_tickInterval !== null) {
      clearInterval(_tickInterval);
      _tickInterval = null;
    }
  }

  // ── API publique ──────────────────────────────────────────────────────────

  /**
   * Définit le mode de silence.
   * @param {'off'|'short'|'long'|'auto'} mode
   */
  function setMode(mode) {
    if (!CONFIG.SILENCE.MODES.includes(mode)) {
      console.warn(`[Silence] Mode inconnu : "${mode}". Ignoré.`);
      return;
    }
    _mode = mode;
  }

  function getMode() { return _mode; }
  function isActive() { return _mode !== 'off'; }

  /**
   * Démarre le silence entre deux pistes.
   * @param {number|null} lastTrackDuration — durée de la piste qui vient de finir
   * @param {Function} onEnd  — appelée quand le silence est terminé
   * @param {Function} [onTick] — appelée chaque seconde avec { remaining, total }
   */
  function start(lastTrackDuration, onEnd, onTick) {
    if (_mode === 'off') {
      onEnd?.();
      return;
    }

    // Annuler un silence éventuellement en cours
    _clearTimers();

    const durationSec = _computeDuration(lastTrackDuration);
    const durationMs  = durationSec * 1000;

    _onEndCallback  = typeof onEnd  === 'function' ? onEnd  : null;
    _onTickCallback = typeof onTick === 'function' ? onTick : null;
    _startTime      = Date.now();
    _totalDuration  = durationMs;

    // Tick chaque seconde pour le compte à rebours
    if (_onTickCallback) {
      _tickInterval = setInterval(() => {
        const elapsed   = Date.now() - _startTime;
        const remaining = Math.max(0, durationSec - Math.floor(elapsed / 1000));
        _onTickCallback({ remaining, total: durationSec });
      }, 1000);
      // Premier tick immédiat
      _onTickCallback({ remaining: durationSec, total: durationSec });
    }

    _timerId = setTimeout(() => {
      _clearTimers();
      _onEndCallback?.();
    }, durationMs);
  }

  /**
   * Annule le silence en cours (ex : l'utilisateur passe à la piste suivante).
   */
  function cancel() {
    _clearTimers();
    _onEndCallback  = null;
    _onTickCallback = null;
  }

  /**
   * Retourne la progression du silence en cours (0–1), ou null si inactif.
   */
  function getProgress() {
    if (_timerId === null || _startTime === null) return null;
    const elapsed = Date.now() - _startTime;
    return Utils.clamp(elapsed / _totalDuration, 0, 1);
  }

  /**
   * Retourne les secondes restantes, ou null si inactif.
   */
  function getRemainingSeconds() {
    if (_timerId === null || _startTime === null) return null;
    const elapsed = Date.now() - _startTime;
    return Math.max(0, Math.ceil((_totalDuration - elapsed) / 1000));
  }

  return Object.freeze({
    setMode,
    getMode,
    isActive,
    start,
    cancel,
    getProgress,
    getRemainingSeconds,
  });

})();
