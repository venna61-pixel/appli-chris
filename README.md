# 🎵 Lecteur Audio Web

Lecteur audio web minimal avec playlist, modes aléatoire, boucle et silence entre les pistes.

---

## Structure du projet

```
audioplayer/
├── index.html          ← Point d'entrée de l'application
├── playlist.json       ← Liste de vos fichiers audio (à éditer)
├── css/
│   └── style.css       ← Tous les styles (thème sombre organique)
├── js/
│   ├── config.js       ← Configuration centrale (constantes)
│   ├── utils.js        ← Fonctions utilitaires pures et testées
│   ├── playlist.js     ← Gestion de l'état de la playlist
│   ├── silence.js      ← Module de silence entre les pistes
│   ├── player.js       ← Moteur audio (orchestre tout)
│   └── ui.js           ← Interface utilisateur (DOM uniquement)
├── audio/
│   └── README.md       ← Instructions pour ajouter des fichiers audio
└── tests/
    └── test-runner.html ← Tests unitaires (ouvrir dans le navigateur)
```

### Architecture modulaire

Chaque fichier a **une seule responsabilité** :

| Module | Rôle |
|--------|------|
| `config.js` | Constantes et configuration |
| `utils.js` | Fonctions pures (formatage, mélange, calculs) |
| `playlist.js` | État de la playlist, navigation, modes |
| `silence.js` | Timer de silence non-bloquant |
| `player.js` | Contrôle de l'élément `<audio>` |
| `ui.js` | Manipulation du DOM, événements |

---

## Ajouter vos fichiers audio

1. Copiez vos fichiers `.mp3` (ou `.ogg`, `.wav`, `.flac`) dans le dossier `audio/`
2. Éditez `playlist.json` à la racine :

```json
[
  {
    "id": "track-001",
    "title": "Nom de la piste",
    "artist": "Artiste",
    "file": "audio/votre-fichier.mp3",
    "duration": null
  }
]
```

> **Tip** : Le champ `duration` peut rester `null` — l'application le calcule automatiquement.

---

## Lancer le projet localement

Le projet nécessite un serveur local (les navigateurs bloquent `fetch()` sur `file://`).

### Option 1 — Python (recommandé, aucune installation)

```bash
cd audioplayer
python3 -m http.server 8080
# Ouvrir : http://localhost:8080
```

### Option 2 — Node.js

```bash
npx serve audioplayer
```

### Option 3 — Extension VS Code

Installez **Live Server** dans VS Code → clic droit sur `index.html` → *Open with Live Server*

---

## Lancer les tests

1. Démarrez le serveur local (voir ci-dessus)
2. Ouvrez : `http://localhost:8080/tests/test-runner.html`
3. Cliquez sur **▶ Lancer les tests**

Les tests couvrent :
- `Utils.formatTime` — formatage du temps
- `Utils.shuffle` / `shuffleAvoidFirst` — algorithme de mélange
- `Utils.computeAutoSilence` — formule d'interpolation linéaire
- `Utils.validateTrack` / `validatePlaylist` — validation et sécurité
- `Utils.clamp` — contrainte de valeur
- `PlaylistManager` — navigation, modes, boucle
- `SilenceManager` — modes, annulation, état
- `CONFIG` — immuabilité et valeurs

---

## Déployer sur GitHub Pages

1. Créez un dépôt GitHub
2. Poussez le contenu du dossier `audioplayer/` à la racine du dépôt
3. Dans les **Settings** du dépôt → **Pages** → choisissez la branche `main` et le dossier `/`
4. Votre application sera disponible à : `https://votre-nom.github.io/votre-repo/`

> **Important** : Les fichiers audio doivent être dans le dépôt. Si vos fichiers sont volumineux, GitHub Pages a une limite de 100 Mo par fichier et 1 Go au total.

---

## Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| ▶ Lecture / Pause | Bouton central ou touche `Espace` |
| ⏮ / ⏭ | Piste précédente / suivante (ou `←` / `→`) |
| Barre de progression | Clic ou drag pour se déplacer dans la piste |
| Volume | Slider de volume |
| 🔀 Aléatoire | Mélange Fisher-Yates, nouvelle permutation à chaque boucle |
| 🔁 Boucle | Redémarre la playlist à la fin |
| ⏸ Silence | 60 s fixe / 120 s fixe / Automatique (formule linéaire) |
| Playlist | Cliquable, piste active surlignée |

### Mode silence automatique

La durée est calculée par interpolation linéaire :

```
f(x) = 60 × [ 1 + (x − xmin) / (xmax − xmin) ]
```

Où `x` = durée de la piste actuelle, `xmin`/`xmax` = pistes la plus courte/longue.
Résultat : entre **60 s** (piste courte) et **120 s** (piste longue).

---

## Sécurité

- **Content Security Policy** dans `index.html` : seuls les scripts du projet sont autorisés
- **Validation stricte** de `playlist.json` : types, extensions, longueurs maximales
- **Pas d'`innerHTML`** avec des données utilisateur : protection XSS native
- **Clamping** de toutes les valeurs numériques critiques
- **Immuabilité** de la configuration (`Object.freeze`)
- **Limite** de 500 pistes maximum par playlist
