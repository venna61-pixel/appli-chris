/**
 * playlist.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Gère l'état de la playlist : ordre de lecture, navigation, modes.
 * N'interagit PAS avec l'audio ni le DOM — responsabilité unique.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const PlaylistManager = (() => {

  // ── État interne ──────────────────────────────────────────────────────────

  let _tracks        = [];   // pistes originales (ordre source)
  let _order         = [];   // indices dans _tracks dans l'ordre de lecture courant
  let _position      = -1;   // position courante dans _order
  let _isShuffled    = false;
  let _isLoop        = false;
  // Dernière piste jouée (pour éviter de répéter en début de boucle)
  let _lastTrackId   = null;

  // ── Helpers privés ────────────────────────────────────────────────────────

  /** Reconstruit _order en séquentiel. */
  function _buildSequential() {
    _order = _tracks.map((_, i) => i);
  }

  /** Reconstruit _order en aléatoire, en évitant de commencer par _lastTrackId. */
  function _buildShuffled() {
    const indices = _tracks.map((_, i) => i);
    const lastIdx = _lastTrackId !== null
      ? _tracks.findIndex(t => t.id === _lastTrackId)
      : -1;
    _order = Utils.shuffleAvoidFirst(indices, lastIdx === -1 ? undefined : lastIdx);
  }

  /** Met à jour _lastTrackId avec la piste à la position courante. */
  function _recordLast() {
    if (_position >= 0 && _position < _order.length) {
      _lastTrackId = _tracks[_order[_position]]?.id ?? null;
    }
  }

  // ── API publique ──────────────────────────────────────────────────────────

  /**
   * Charge une liste de pistes validées.
   * @param {Array} tracks — résultat de Utils.validatePlaylist()
   */
  function load(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      throw new Error('Impossible de charger une playlist vide.');
    }
    _tracks     = tracks;
    _position   = 0;
    _lastTrackId = null;
    _buildSequential();
  }

  /** Retourne la piste à la position courante, ou null. */
  function current() {
    if (_order.length === 0 || _position < 0 || _position >= _order.length) return null;
    return _tracks[_order[_position]] ?? null;
  }

  /** Retourne toutes les pistes dans l'ordre de lecture courant. */
  function getOrderedTracks() {
    return _order.map(i => _tracks[i]);
  }

  /** Retourne toutes les pistes dans l'ordre source. */
  function getAllTracks() {
    return [..._tracks];
  }

  /** Retourne la position courante dans _order (0-based). */
  function getPosition() { return _position; }

  /** Retourne le nombre de pistes. */
  function size() { return _tracks.length; }

  /**
   * Avance à la piste suivante.
   * @returns {{ track: Object|null, cycleCompleted: boolean }}
   *   cycleCompleted = true si on vient de passer la fin de la playlist (boucle).
   */
  function next() {
    if (_tracks.length === 0) return { track: null, cycleCompleted: false };

    _recordLast();
    const nextPos = _position + 1;

    if (nextPos < _order.length) {
      _position = nextPos;
      return { track: current(), cycleCompleted: false };
    }

    // Fin de la playlist
    if (_isLoop) {
      // Nouvelle permutation si mode aléatoire
      if (_isShuffled) _buildShuffled();
      _position = 0;
      return { track: current(), cycleCompleted: true };
    }

    // Pas de boucle : on reste à la fin
    return { track: null, cycleCompleted: false };
  }

  /**
   * Recule à la piste précédente.
   * @returns {Object|null}
   */
  function previous() {
    if (_tracks.length === 0) return null;
    if (_position > 0) {
      _position--;
      return current();
    }
    // Déjà au début
    if (_isLoop) {
      _position = _order.length - 1;
      return current();
    }
    return current(); // reste sur la première
  }

  /**
   * Saute directement à une piste par son id.
   * @param {string} trackId
   * @returns {Object|null}
   */
  function jumpTo(trackId) {
    const orderIdx = _order.findIndex(i => _tracks[i]?.id === trackId);
    if (orderIdx === -1) return null;
    _position = orderIdx;
    return current();
  }

  // ── Setters de mode ───────────────────────────────────────────────────────

  function setShuffled(enabled) {
    _isShuffled = Boolean(enabled);
    if (_isShuffled) {
      _recordLast();
      _buildShuffled();
      // Repositionner sur la piste actuellement jouée dans le nouvel ordre
      const currentId = _lastTrackId;
      const newPos = _order.findIndex(i => _tracks[i]?.id === currentId);
      _position = newPos !== -1 ? newPos : 0;
    } else {
      const currentId = current()?.id;
      _buildSequential();
      if (currentId) {
        const newPos = _order.findIndex(i => _tracks[i]?.id === currentId);
        _position = newPos !== -1 ? newPos : 0;
      }
    }
  }

  function setLoop(enabled) {
    _isLoop = Boolean(enabled);
  }

  function isShuffled() { return _isShuffled; }
  function isLoop()     { return _isLoop; }

  // ── Durées (pour le calcul de silence automatique) ────────────────────────

  /**
   * Calcule min/max des durées connues dans la playlist.
   * Ignore les pistes dont la durée n'est pas encore connue.
   * @returns {{ min: number, max: number } | null}
   */
  function getDurationRange() {
    const durations = _tracks
      .map(t => t.duration)
      .filter(d => typeof d === 'number' && d > 0);
    if (durations.length === 0) return null;
    return {
      min: Math.min(...durations),
      max: Math.max(...durations),
    };
  }

  /**
   * Met à jour la durée d'une piste (renseignée une fois chargée dans l'audio).
   * @param {string} trackId
   * @param {number} duration
   */
  function setTrackDuration(trackId, duration) {
    const track = _tracks.find(t => t.id === trackId);
    if (track && Number.isFinite(duration) && duration > 0) {
      track.duration = duration;
    }
  }

  return Object.freeze({
    load,
    current,
    getOrderedTracks,
    getAllTracks,
    getPosition,
    size,
    next,
    previous,
    jumpTo,
    setShuffled,
    setLoop,
    isShuffled,
    isLoop,
    getDurationRange,
    setTrackDuration,
  });

})();
