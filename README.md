# Compagnon de wargame

## Beware Attention ALPHA VERSION

**[English](#english) · [Français](#français)**

A Stream Deck plugin that runs the bookkeeping of a tabletop wargame played on a real table.
Un plugin Stream Deck qui tient la mécanique d'un wargame joué sur une vraie table.

---

## English

Compagnon de wargame turns a Stream Deck into a game assistant for physical wargames and board games. It tracks the turn sequence, shows phase reminders, rolls on combat tables and dice pools, draws from random tables, and keeps a timestamped game log. Each game is described in a JSON file you can edit, so the plugin adapts to any game without code changes.

> The plugin's interface, key faces, and game file fields are in French.

### Requirements

- Stream Deck app 7.1 or later
- macOS 12+ or Windows 10+
- Any Stream Deck model. Dials and touch screens are supported on Stream Deck +.

### Quick start

1. Double-click `com.paul.compagnon-wargame.streamDeckPlugin`. The actions appear under the **Compagnon de wargame** category.
2. Drag a **Partie**, a **Séquence de tour** and a **Dés** action onto your Stream Deck.
3. Open the settings of any of these keys and pick a game. The bundled example, *Wargame classique (exemple)*, uses every feature.
4. Press **Séquence de tour** to move through the phases, then press **Partie** to open the game log.

On first launch the plugin creates `Documents/Compagnon de wargame/` with two folders:

| Folder | Contents |
|---|---|
| `jeux/` | Editable copies of the bundled games, the `_modele.json` template, and the format guide `_LISEZMOI.md` |
| `journaux/` | One Markdown log file per game |

### Actions

| Action (name in the app) | Press | Long press | Dial (Stream Deck +) |
|---|---|---|---|
| **Partie** (game) | Open the log | Start a new game (hold 1.5 s) | |
| **Séquence de tour** (turn sequence) | Next phase | Previous phase | Turn: scroll through phases |
| **Rappels de phase** (phase reminders) | Next reminder | Back to the first | |
| **Table de combat** (combat results table) | Roll | Next odds column | Turn: column; turn while pressed: modifier |
| **Bataille** (dice pool) | Roll the pool | New battle | Turn: number of dice; turn while pressed: target number or profile |
| **Ajuster (+/−)** (adjust) | Apply +1 or −1 | Reset to default | |
| **Table aléatoire** (random table) | Draw | Clear | Turn: switch table |
| **Dés** (dice) | Roll | Clear | |

**Ajuster** gives keys-only Stream Decks the controls a dial would offer: one key per setting and direction (column, modifier, number of dice, target number).

### What happens automatically

- A phase is written to the log only after it has stayed unchanged for 2 seconds, so scrolling back and forth does not clutter the log.
- In a dice-pool battle, the round advances when a side rolls again after already rolling in the current round.
- With `"ordreCamps": "aleatoire"`, the order of play is randomised every turn and recorded at the top of that turn in the log.
- The plugin reloads the `jeux/` folder as soon as a file changes. A broken file is reported in the key settings with its name and the exact cause.
- The game state is saved continuously and restored when Stream Deck restarts.

### Writing a game file

Copy `_modele.json` to a new name that does not start with `_`, change its `id`, and save. The plugin picks it up immediately. Files starting with `_` are ignored. A file in your `jeux/` folder replaces a bundled game with the same `id`.

```json
{
  "id": "my-game",
  "nom": "My Game",
  "camps": ["Blue", "Red"],
  "sequence": {
    "debut": ["Weather"],
    "parCamp": [{ "nom": "Movement", "rappels": ["Zones of control stop movement"] }, "Combat"],
    "fin": ["End of turn"]
  },
  "tables": {
    "melee": { "type": "poignee", "nom": "Melee", "des": 6, "seuil": 4, "camps": ["Attacker", "Defender"] }
  },
  "des": ["2d6"]
}
```

Three table types are available:

| Type | Use | Key fields |
|---|---|---|
| `colonnes` | Classic odds-based combat results table | `de`, `colonnes`, `lignes`, `resultats`, `modificateur` |
| `poignee` | One die per unit, each die at or above the target hits | `faces`, `des`, `desMax`, `seuil`, `critique`, `profils`, `camps` |
| `aleatoire` | Events, weather, encounters | `de` with ranged `entrees`, or a plain list drawn uniformly |

Die ranges are written `"3"`, `"2-4"`, `"7+"` or `"1-"`. When a modified roll falls outside the table, the closest row applies. The full format is documented in `jeux/_LISEZMOI.md`.

### Bundled games

| File | Description |
|---|---|
| `exemple-wargame.json` | Complete example: two sides, odds table, dice pool with profiles, weather and event tables |
| `divine-right-variante.json` | Skeleton for a Divine Right house-rules variant. Sides, target numbers, profiles and events are placeholders. |
| `_modele.json` | Starting template, ignored by the loader |

### Development

```bash
npm install
npm run build        # compile src/ to com.paul.compagnon-wargame.sdPlugin/bin/plugin.js
npm test             # 20 logic tests: dice, tables, sequence, battles, log, save and restore
npm run integration  # run the compiled plugin against a simulated Stream Deck app
npm run apercu       # render every key face to PNG in apercu/
npm run pack         # validate and build dist/com.paul.compagnon-wargame.streamDeckPlugin
```

To work live on a connected Stream Deck, run `npx streamdeck link com.paul.compagnon-wargame.sdPlugin`, then `npm run watch`.

| Path | Role |
|---|---|
| `src/core/des.ts` | Dice expressions and table ranges |
| `src/core/jeux.ts` | Game file format, validation with readable errors, folder loading |
| `src/core/etat.ts` | Game state and every operation on it; no SDK dependency, testable on its own |
| `src/core/journal.ts` | Log writing and opening files |
| `src/core/rendu.ts` | SVG drawing of keys (144 px) and touch screens (200 × 100) |
| `src/actions/` | The eight actions; `base.ts` handles long presses and dials |
| `com.paul.compagnon-wargame.sdPlugin/ui/` | Settings page shared by all actions |

Built with TypeScript, the official Elgato SDK (`@elgato/streamdeck` 3.x) and Rollup.

### Known limitations

- Tested with the official SDK and a simulated Stream Deck app, not yet on physical hardware.
- On a Stream Deck MK.2 (72 px keys), long phase names get small. Set a short `abrege` on the phase.
- Above about fifteen dice, a pool is shown as a count per face instead of die by die.
- French only for now.

---

## Français

Compagnon de wargame transforme un Stream Deck en assistant de partie pour les wargames et jeux de plateau physiques. Il suit la séquence de tour, affiche les rappels de phase, lance sur les tables de combat et les poignées de dés, tire dans les tables aléatoires et tient un journal de partie horodaté. Chaque jeu est décrit dans un fichier JSON modifiable : le plugin s'adapte à n'importe quel jeu sans toucher au code.

### Prérequis

- Application Stream Deck 7.1 ou plus récente
- macOS 12+ ou Windows 10+
- Tous les modèles de Stream Deck. Les molettes et écrans tactiles du Stream Deck + sont pris en charge.

### Démarrage rapide

1. Double-cliquez sur `com.paul.compagnon-wargame.streamDeckPlugin`. Les actions apparaissent dans la catégorie **Compagnon de wargame**.
2. Glissez une action **Partie**, une **Séquence de tour** et une **Dés** sur votre Stream Deck.
3. Ouvrez les réglages de l'une de ces touches et choisissez un jeu. L'exemple fourni, *Wargame classique (exemple)*, utilise toutes les fonctions.
4. Appuyez sur **Séquence de tour** pour avancer dans les phases, puis sur **Partie** pour ouvrir le journal.

Au premier lancement, le plugin crée `Documents/Compagnon de wargame/` avec deux dossiers :

| Dossier | Contenu |
|---|---|
| `jeux/` | Copies modifiables des jeux fournis, le modèle `_modele.json` et le guide du format `_LISEZMOI.md` |
| `journaux/` | Un fichier Markdown par partie |

### Les actions

| Action | Appui | Appui long | Molette (Stream Deck +) |
|---|---|---|---|
| **Partie** | Ouvrir le journal | Nouvelle partie (1,5 s) | |
| **Séquence de tour** | Phase suivante | Phase précédente | Tourner : défiler les phases |
| **Rappels de phase** | Rappel suivant | Revenir au premier | |
| **Table de combat** | Lancer | Colonne suivante | Tourner : colonne ; en appuyant : modificateur |
| **Bataille** | Lancer la poignée | Nouvelle bataille | Tourner : nombre de dés ; en appuyant : seuil ou profil |
| **Ajuster (+/−)** | Appliquer +1 ou −1 | Valeur par défaut | |
| **Table aléatoire** | Tirer | Effacer | Tourner : changer de table |
| **Dés** | Lancer | Effacer | |

**Ajuster** donne aux Stream Deck sans molette les réglages qu'offrirait une molette : une touche par réglage et par sens (colonne, modificateur, nombre de dés, seuil).

### Ce qui se passe tout seul

- Une phase n'est notée au journal qu'après 2 secondes sans changement : les allers-retours ne l'encombrent pas.
- Dans une bataille à poignée de dés, le round avance quand un camp relance alors qu'il a déjà lancé dans le round en cours.
- Avec `"ordreCamps": "aleatoire"`, l'ordre de jeu est tiré au sort à chaque tour et noté en tête du tour dans le journal.
- Le plugin relit le dossier `jeux/` dès qu'un fichier change. Un fichier en erreur est signalé dans les réglages des touches, avec son nom et la cause exacte.
- L'état de la partie est sauvegardé en continu et restauré au redémarrage de Stream Deck.

### Écrire un fichier de jeu

Copiez `_modele.json` sous un nom qui ne commence pas par `_`, changez son `id` et enregistrez : le plugin le prend en compte aussitôt. Les fichiers qui commencent par `_` sont ignorés. Un fichier de votre dossier `jeux/` remplace le jeu fourni qui porte le même `id`.

```json
{
  "id": "mon-jeu",
  "nom": "Mon jeu",
  "camps": ["Bleu", "Rouge"],
  "sequence": {
    "debut": ["Météo"],
    "parCamp": [{ "nom": "Mouvement", "rappels": ["Les zones de contrôle arrêtent le mouvement"] }, "Combat"],
    "fin": ["Fin de tour"]
  },
  "tables": {
    "melee": { "type": "poignee", "nom": "Mêlée", "des": 6, "seuil": 4, "camps": ["Attaquant", "Défenseur"] }
  },
  "des": ["2d6"]
}
```

Trois types de tables sont disponibles :

| Type | Usage | Champs principaux |
|---|---|---|
| `colonnes` | Table de résultats classique au rapport de forces | `de`, `colonnes`, `lignes`, `resultats`, `modificateur` |
| `poignee` | Un dé par unité, chaque dé qui atteint le seuil touche | `faces`, `des`, `desMax`, `seuil`, `critique`, `profils`, `camps` |
| `aleatoire` | Événements, météo, rencontres | `de` avec des `entrees` par plages, ou une simple liste tirée au hasard |

Les plages de dés s'écrivent `"3"`, `"2-4"`, `"7+"` ou `"1-"`. Quand un jet modifié sort de la table, la ligne la plus proche s'applique. Le format complet est décrit dans `jeux/_LISEZMOI.md`.

### Jeux fournis

| Fichier | Description |
|---|---|
| `exemple-wargame.json` | Exemple complet : deux camps, table au rapport de forces, poignée de dés avec profils, tables de météo et d'événements |
| `divine-right-variante.json` | Squelette pour une variante maison de Divine Right. Camps, seuils, profils et événements sont provisoires. |
| `_modele.json` | Modèle de départ, ignoré au chargement |

### Développement

```bash
npm install
npm run build        # compile src/ vers com.paul.compagnon-wargame.sdPlugin/bin/plugin.js
npm test             # 20 tests de logique : dés, tables, séquence, batailles, journal, sauvegarde
npm run integration  # lance le plugin compilé face à un logiciel Stream Deck simulé
npm run apercu       # rend toutes les faces de touches en PNG dans apercu/
npm run pack         # valide et produit dist/com.paul.compagnon-wargame.streamDeckPlugin
```

Pour travailler en direct sur un Stream Deck branché : `npx streamdeck link com.paul.compagnon-wargame.sdPlugin`, puis `npm run watch`.

| Chemin | Rôle |
|---|---|
| `src/core/des.ts` | Expressions de dés et plages de tables |
| `src/core/jeux.ts` | Format des fichiers de jeu, validation avec messages lisibles, chargement des dossiers |
| `src/core/etat.ts` | État de la partie et toutes ses opérations ; sans dépendance au SDK, testable seul |
| `src/core/journal.ts` | Écriture du journal et ouverture des fichiers |
| `src/core/rendu.ts` | Dessin SVG des touches (144 px) et des écrans tactiles (200 × 100) |
| `src/actions/` | Les huit actions ; `base.ts` gère les appuis longs et les molettes |
| `com.paul.compagnon-wargame.sdPlugin/ui/` | Page de réglages commune à toutes les actions |

Réalisé en TypeScript avec le SDK officiel d'Elgato (`@elgato/streamdeck` 3.x) et Rollup.

### Limites connues

- Testé avec le SDK officiel et un logiciel Stream Deck simulé, pas encore sur un appareil réel.
- Sur un Stream Deck MK.2 (touches de 72 px), les longs noms de phase deviennent petits. Donnez un `abrege` court à la phase.
- Au-delà d'une quinzaine de dés, une poignée s'affiche en résumé par face plutôt que dé par dé.
- Interface en français uniquement pour l'instant.
