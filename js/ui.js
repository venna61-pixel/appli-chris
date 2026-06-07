/**
 * ui.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestion complète de l'interface utilisateur.
 * Ce module ne fait QUE mettre à jour le DOM et transmettre les actions
 * au Player. Zéro logique audio ici.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const UI = (() => {

  // ── Références DOM ────────────────────────────────────────────────────────
  // Toutes résolues une seule fois au init() pour les performances.

  let el = {};

  function _queryAll() {
    el = {
      // Infos piste
      trackTitle:    document.getElementById('track-title'),
      trackArtist:   document.getElementById('track-artist'),
      trackCurrent:  document.getElementById('time-current'),
      trackDuration: document.getElementById('time-duration'),

      // Contrôles
      btnPlay:       document.getElementById('btn-play'),
      btnPrev:       document.getElementById('btn-prev'),
      btnNext:       document.getElementById('btn-next'),

      // Barre de progression
      progressBar:   document.getElementById('progress-bar'),
      progressFill:  document.getElementById('progress-fill'),
      progressThumb: document.getElementById('progress-thumb'),

      // Volume
      volumeSlider:  document.getElementById('volume-slider'),

      // Modes
      btnShuffle:    document.getElementById('btn-shuffle'),
      btnLoop:       document.getElementById('btn-loop'),
      silenceSelect: document.getElementById('silence-select'),

      // Silence
      silenceOverlay:   document.getElementById('silence-overlay'),
      silenceCountdown: document.getElementById('silence-countdown'),
      silenceFill:      document.getElementById('silence-fill'),

      // Playlist
      playlistEl:    document.getElementById('playlist'),

      // Erreur
      errorBanner:   document.getElementById('error-banner'),
      errorMessage:  document.getElementById('error-message'),
      errorDismiss:  document.getElementById('error-dismiss'),

      // Ajout de fichiers
      fileInput:   document.getElementById('file-input'),
      btnAddFiles: document.getElementById('btn-add-files'),
      btnAddMore:  document.getElementById('btn-add-more'),
      dropZone:    document.getElementById('drop-zone'),
    };
  }

  // ── État UI interne ───────────────────────────────────────────────────────

  let _seekDragging = false;
  let _silenceAnimFrame = null;

  // ── Helpers d'affichage ───────────────────────────────────────────────────

  function _setProgressFill(ratio) {
    const pct = Utils.clamp(ratio, 0, 1) * 100;
    el.progressFill.style.width  = `${pct}%`;
    el.progressThumb.style.left  = `${pct}%`;
  }

  function _setActiveTrack(trackId) {
    document.querySelectorAll('.playlist-item').forEach(item => {
      item.classList.toggle('active', item.dataset.trackId === trackId);
      item.setAttribute('aria-current', item.dataset.trackId === trackId ? 'true' : 'false');
    });
  }

  function _setPlayIcon(isPlaying) {
    el.btnPlay.innerHTML = isPlaying
      ? `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5,3 19,12 5,21"/></svg>`;
    el.btnPlay.setAttribute('aria-label', isPlaying ? 'Pause' : 'Lecture');
  }

  // ── Gestion de la barre de progression (drag) ─────────────────────────────

  function _onProgressStart(e) {
    _seekDragging = true;
    _onProgressMove(e);
  }

  function _onProgressMove(e) {
    if (!_seekDragging) return;
    const rect  = el.progressBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Utils.clamp((clientX - rect.left) / rect.width, 0, 1);
    _setProgressFill(ratio);
  }

  function _onProgressEnd(e) {
    if (!_seekDragging) return;
    _seekDragging = false;
    const rect  = el.progressBar.getBoundingClientRect();
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const ratio = Utils.clamp((clientX - rect.left) / rect.width, 0, 1);
    Player.seek(ratio);
  }

  // ── Silence : animation du compte à rebours ───────────────────────────────

  function _animateSilenceBar() {
    const progress = Player.getSilenceProgress();
    if (progress === null) return;
    el.silenceFill.style.width = `${(1 - progress) * 100}%`;
    _silenceAnimFrame = requestAnimationFrame(_animateSilenceBar);
  }

  function _showSilence(remaining, total) {
    el.silenceOverlay.hidden = false;
    el.silenceCountdown.textContent = `${remaining}s`;
    el.silenceFill.style.width = '100%';
    if (_silenceAnimFrame) cancelAnimationFrame(_silenceAnimFrame);
    _silenceAnimFrame = requestAnimationFrame(_animateSilenceBar);
  }

  function _hideSilence() {
    el.silenceOverlay.hidden = true;
    if (_silenceAnimFrame) {
      cancelAnimationFrame(_silenceAnimFrame);
      _silenceAnimFrame = null;
    }
  }

  // ── Erreurs ───────────────────────────────────────────────────────────────

  function _showError(message) {
    el.errorMessage.textContent = message;
    el.errorBanner.hidden = false;
  }

  function _hideError() {
    el.errorBanner.hidden = true;
  }

  // ── Construction de la playlist dans le DOM ───────────────────────────────

  function _renderPlaylist() {
    const tracks = PlaylistManager.getOrderedTracks();
    const currentId = PlaylistManager.current()?.id;

    // Fragment pour performance — un seul reflow
    const frag = document.createDocumentFragment();

    tracks.forEach((track, idx) => {
      const li = document.createElement('li');
      li.className = 'playlist-item';
      li.dataset.trackId = track.id;
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-current', track.id === currentId ? 'true' : 'false');

      const numEl = document.createElement('span');
      numEl.className = 'playlist-num';
      numEl.textContent = String(idx + 1).padStart(2, '0');

      const infoEl = document.createElement('div');
      infoEl.className = 'playlist-info';

      const titleEl = document.createElement('span');
      titleEl.className = 'playlist-title';
      titleEl.textContent = track.title;  // textContent = sécurisé (pas d'injection XSS)

      const artistEl = document.createElement('span');
      artistEl.className = 'playlist-artist';
      artistEl.textContent = track.artist;

      infoEl.append(titleEl, artistEl);
      li.append(numEl, infoEl);

      // Durée si connue
      if (track.duration) {
        const durEl = document.createElement('span');
        durEl.className = 'playlist-duration';
        durEl.textContent = Utils.formatTime(track.duration);
        li.append(durEl);
      }

      // Clic → sauter à cette piste
      li.addEventListener('click', () => Player.jumpTo(track.id));
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          Player.jumpTo(track.id);
        }
      });

      if (track.id === currentId) li.classList.add('active');
      frag.append(li);
    });

    el.playlistEl.replaceChildren(frag);
  }

  // ── Initialisation des événements ─────────────────────────────────────────

  function _bindEvents() {
    // Contrôles principaux
    el.btnPlay.addEventListener('click', () => Player.togglePlay());
    el.btnPrev.addEventListener('click', () => Player.skipPrevious());
    el.btnNext.addEventListener('click', () => Player.skipNext());

    // Barre de progression — souris
    el.progressBar.addEventListener('mousedown',  _onProgressStart);
    document.addEventListener('mousemove', _onProgressMove);
    document.addEventListener('mouseup',   _onProgressEnd);

    // Barre de progression — tactile
    el.progressBar.addEventListener('touchstart', _onProgressStart, { passive: true });
    document.addEventListener('touchmove',  _onProgressMove, { passive: true });
    document.addEventListener('touchend',   _onProgressEnd);

    // Volume
    el.volumeSlider.addEventListener('input', () => {
      Player.setVolume(Number(el.volumeSlider.value) / 100);
    });

    // Modes
    el.btnShuffle.addEventListener('click', () => {
      const enabled = !PlaylistManager.isShuffled();
      Player.setShuffled(enabled);
      el.btnShuffle.classList.toggle('active', enabled);
      el.btnShuffle.setAttribute('aria-pressed', String(enabled));
    });

    el.btnLoop.addEventListener('click', () => {
      const enabled = !PlaylistManager.isLoop();
      Player.setLoop(enabled);
      el.btnLoop.classList.toggle('active', enabled);
      el.btnLoop.setAttribute('aria-pressed', String(enabled));
    });

    el.silenceSelect.addEventListener('change', () => {
      Player.setSilenceMode(el.silenceSelect.value);
    });

    // Fermeture de la bannière d'erreur
    el.errorDismiss.addEventListener('click', _hideError);

    // ── Ajout de fichiers ─────────────────────────────────────────────────
    const _openFilePicker = () => el.fileInput.click();
    el.btnAddFiles.addEventListener('click', _openFilePicker);
    el.btnAddMore.addEventListener('click',  _openFilePicker);

    el.fileInput.addEventListener('change', () => {
      if (el.fileInput.files.length > 0) {
        Player.loadFromFiles(el.fileInput.files);
        el.fileInput.value = ''; // reset pour pouvoir re-sélectionner les mêmes fichiers
      }
    });

    // Glisser-déposer
    el.dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      el.dropZone.classList.add('drag-over');
    });
    el.dropZone.addEventListener('dragleave', e => {
      if (!el.dropZone.contains(e.relatedTarget)) {
        el.dropZone.classList.remove('drag-over');
      }
    });
    el.dropZone.addEventListener('drop', e => {
      e.preventDefault();
      el.dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        Player.loadFromFiles(e.dataTransfer.files);
      }
    });

    // Raccourcis clavier globaux
    document.addEventListener('keydown', e => {
      // Ignorer si focus dans un input / select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === ' ')           { e.preventDefault(); Player.togglePlay(); }
      if (e.key === 'ArrowRight')  { Player.skipNext(); }
      if (e.key === 'ArrowLeft')   { Player.skipPrevious(); }
    });
  }

  // ── Callbacks du Player → mise à jour UI ─────────────────────────────────

  function _registerPlayerCallbacks() {

    Player.on('onStateChange', (state) => {
      const isPlaying = state === 'playing';
      _setPlayIcon(isPlaying);
      el.btnPlay.classList.toggle('playing', isPlaying);

      if (state !== 'silence') _hideSilence();
      if (state === 'ended') {
        el.trackCurrent.textContent  = '0:00';
        _setProgressFill(0);
      }
    });

    Player.on('onTrackChange', (track) => {
      el.trackTitle.textContent  = track?.title  ?? '—';
      el.trackArtist.textContent = track?.artist ?? '';
      _setActiveTrack(track?.id);
      _hideError();
    });

    Player.on('onTimeUpdate', ({ current, duration, progress }) => {
      if (_seekDragging) return; // ne pas écraser le drag
      el.trackCurrent.textContent  = Utils.formatTime(current);
      el.trackDuration.textContent = Utils.formatTime(duration);
      _setProgressFill(progress);
    });

    Player.on('onPlaylistChange', () => {
      _renderPlaylist();
      const hasTracks = PlaylistManager.size() > 0;
      el.dropZone.hidden  = hasTracks;
      el.btnAddMore.hidden = !hasTracks;
    });

    Player.on('onError', (message) => {
      _showError(message);
    });

    Player.on('onSilenceTick', ({ remaining, total }) => {
      _showSilence(remaining, total);
      el.silenceCountdown.textContent = `${remaining}s`;
    });
  }

  // ── Point d'entrée ────────────────────────────────────────────────────────

  async function init() {
    _queryAll();
    _bindEvents();
    _registerPlayerCallbacks();

    // Volume initial
    el.volumeSlider.value = Math.round(CONFIG.AUDIO.DEFAULT_VOLUME * 100);

    try {
      await Player.loadPlaylist();
    } catch {
      // L'erreur est déjà affichée via onError
    }
  }

  return Object.freeze({ init });

})();
