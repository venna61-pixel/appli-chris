/**
 * player.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Moteur audio de l'application.
 * Orchestre PlaylistManager, SilenceManager et l'élément <audio> natif.
 * N'interagit PAS avec le DOM — c'est le rôle de ui.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const Player = (() => {

  // ── Élément audio natif ───────────────────────────────────────────────────
  const _audio = new Audio();
  _audio.preload = 'metadata';
  _audio.volume  = CONFIG.AUDIO.DEFAULT_VOLUME;

  // ── État interne ──────────────────────────────────────────────────────────
  let _state = 'idle';        // 'idle' | 'loading' | 'playing' | 'paused' | 'silence' | 'ended'
  let _lastTrackDuration = null;

  // ── Callbacks vers l'UI ───────────────────────────────────────────────────
  const _listeners = {
    onStateChange:    null,   // (state) => void
    onTrackChange:    null,   // (track) => void
    onTimeUpdate:     null,   // ({ current, duration, progress }) => void
    onPlaylistChange: null,   // () => void
    onError:          null,   // (message) => void
    onSilenceTick:    null,   // ({ remaining, total }) => void
  };

  // ── Helpers privés ────────────────────────────────────────────────────────

  function _setState(newState) {
    _state = newState;
    _listeners.onStateChange?.(newState);
  }

  function _emitError(message) {
    console.error('[Player]', message);
    _listeners.onError?.(message);
  }

  /** Charge et joue la piste courante dans PlaylistManager. */
  function _loadAndPlay() {
    const track = PlaylistManager.current();
    if (!track) {
      _setState('ended');
      return;
    }

    _setState('loading');
    _listeners.onTrackChange?.(track);
    _listeners.onPlaylistChange?.();

    _audio.src = track.file;
    _audio.load();

    const playPromise = _audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => _setState('playing'))
        .catch(err => {
          // Autoplay bloqué par le navigateur — normal au premier chargement
          if (err.name === 'NotAllowedError') {
            _setState('paused');
          } else {
            _emitError(`Impossible de lire "${track.title}" : ${err.message}`);
            _setState('paused');
          }
        });
    }
  }

  /** Démarre le silence puis joue la piste suivante. */
  function _startSilenceThenNext() {
    _setState('silence');
    SilenceManager.start(
      _lastTrackDuration,
      () => {
        // Silence terminé → piste suivante
        const { track } = PlaylistManager.next();
        if (track) {
          _loadAndPlay();
        } else {
          _setState('ended');
        }
      },
      (tickData) => {
        _listeners.onSilenceTick?.(tickData);
      }
    );
  }

  // ── Événements de l'élément <audio> ──────────────────────────────────────

  _audio.addEventListener('loadedmetadata', () => {
    const track = PlaylistManager.current();
    if (track && _audio.duration > 0) {
      PlaylistManager.setTrackDuration(track.id, _audio.duration);
    }
  });

  _audio.addEventListener('timeupdate', () => {
    if (_state !== 'playing' && _state !== 'paused') return;
    const cur  = _audio.currentTime;
    const dur  = _audio.duration || 0;
    const prog = dur > 0 ? cur / dur : 0;
    _listeners.onTimeUpdate?.({ current: cur, duration: dur, progress: prog });
  });

  _audio.addEventListener('ended', () => {
    _lastTrackDuration = _audio.duration || null;

    if (SilenceManager.isActive()) {
      _startSilenceThenNext();
    } else {
      const { track } = PlaylistManager.next();
      if (track) {
        _loadAndPlay();
      } else {
        _setState('ended');
      }
    }
  });

  _audio.addEventListener('error', () => {
    const track = PlaylistManager.current();
    const name  = track?.title ?? 'inconnue';
    _emitError(`Erreur audio sur la piste "${name}". Vérifiez le fichier.`);
    _setState('paused');
  });

  // ── API publique ──────────────────────────────────────────────────────────

  /** Enregistre les callbacks de l'UI. */
  function on(event, callback) {
    if (event in _listeners && typeof callback === 'function') {
      _listeners[event] = callback;
    }
  }

  /**
   * Charge la playlist depuis playlist.json et initialise le lecteur.
   * @returns {Promise<void>}
   */
  async function loadPlaylist() {
    try {
      const response = await fetch(CONFIG.PLAYLIST_URL, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} — impossible de charger playlist.json`);
      }

      // Vérification du Content-Type
      const ct = response.headers.get('Content-Type') ?? '';
      if (!ct.includes('json') && !ct.includes('text')) {
        // Sur GitHub Pages le Content-Type peut varier — on continue quand même
        console.warn('[Player] Content-Type inattendu :', ct);
      }

      const raw    = await response.json();
      const tracks = Utils.validatePlaylist(raw);

      if (tracks.length === 0) {
        throw new Error('Aucune piste valide trouvée dans playlist.json.');
      }

      PlaylistManager.load(tracks);
      _setState('idle');
      _listeners.onTrackChange?.(PlaylistManager.current());
      _listeners.onPlaylistChange?.();

    } catch {
      // Pas de serveur ou pas de playlist.json — l'utilisateur ajoutera ses fichiers
      _setState('idle');
    }
  }

  /**
   * Charge des fichiers audio sélectionnés depuis l'ordinateur.
   * @param {FileList} files
   */
  function loadFromFiles(files) {
    if (!files || files.length === 0) return;

    const tracks = [];
    Array.from(files).forEach((file, i) => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!CONFIG.AUDIO.ALLOWED_EXTENSIONS.includes(ext)) return;

      const title = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim();

      tracks.push({
        id:       `local-${Date.now()}-${i}`,
        title:    title.slice(0, CONFIG.PLAYLIST.MAX_STRING_LENGTH) || `Piste ${i + 1}`,
        artist:   '',
        file:     URL.createObjectURL(file),
        duration: null,
      });
    });

    if (tracks.length === 0) {
      _emitError('Aucun fichier valide. Formats acceptés : MP3, WAV, FLAC, OGG, AAC, M4A.');
      return;
    }

    PlaylistManager.load(tracks);
    _setState('idle');
    _listeners.onTrackChange?.(PlaylistManager.current());
    _listeners.onPlaylistChange?.();
  }

  /** Lecture / Pause. */
  function togglePlay() {
    if (_state === 'silence') {
      // Pendant le silence : annuler et reprendre
      SilenceManager.cancel();
      _loadAndPlay();
      return;
    }

    if (_state === 'idle' || _state === 'ended') {
      _loadAndPlay();
      return;
    }

    if (_state === 'playing') {
      _audio.pause();
      _setState('paused');
    } else if (_state === 'paused' || _state === 'loading') {
      _audio.play()
        .then(() => _setState('playing'))
        .catch(err => _emitError(err.message));
    }
  }

  /** Piste suivante. */
  function skipNext() {
    SilenceManager.cancel();
    const { track } = PlaylistManager.next();
    if (track) {
      _loadAndPlay();
    } else {
      _setState('ended');
    }
  }

  /** Piste précédente. */
  function skipPrevious() {
    SilenceManager.cancel();
    // Si on est à plus de 3 secondes : retour au début de la piste courante
    if (_audio.currentTime > 3) {
      _audio.currentTime = 0;
      return;
    }
    PlaylistManager.previous();
    _loadAndPlay();
  }

  /**
   * Saute à une piste spécifique.
   * @param {string} trackId
   */
  function jumpTo(trackId) {
    SilenceManager.cancel();
    const track = PlaylistManager.jumpTo(trackId);
    if (track) _loadAndPlay();
  }

  /**
   * Déplace la tête de lecture.
   * @param {number} ratio — entre 0 et 1
   */
  function seek(ratio) {
    if (_state === 'silence') return; // pas de seek pendant le silence
    const dur = _audio.duration;
    if (!Number.isFinite(dur) || dur === 0) return;
    _audio.currentTime = Utils.clamp(ratio, 0, 1) * dur;
  }

  /** Modifie le volume. @param {number} v — 0 à 1 */
  function setVolume(v) {
    _audio.volume = Utils.clamp(v, 0, 1);
  }

  // ── Setters de mode (délèguent aux modules) ───────────────────────────────

  function setShuffled(enabled) {
    PlaylistManager.setShuffled(enabled);
    _listeners.onPlaylistChange?.();
  }

  function setLoop(enabled) {
    PlaylistManager.setLoop(enabled);
  }

  function setSilenceMode(mode) {
    SilenceManager.setMode(mode);
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  function getState()           { return _state; }
  function getCurrentTrack()    { return PlaylistManager.current(); }
  function getVolume()          { return _audio.volume; }
  function getSilenceProgress() { return SilenceManager.getProgress(); }
  function getSilenceRemaining(){ return SilenceManager.getRemainingSeconds(); }

  return Object.freeze({
    on,
    loadPlaylist,
    loadFromFiles,
    togglePlay,
    skipNext,
    skipPrevious,
    jumpTo,
    seek,
    setVolume,
    setShuffled,
    setLoop,
    setSilenceMode,
    getState,
    getCurrentTrack,
    getVolume,
    getSilenceProgress,
    getSilenceRemaining,
  });

})();
