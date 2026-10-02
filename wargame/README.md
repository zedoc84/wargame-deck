# Compagnon de wargame

Plugin Stream Deck qui sert d'assistant de partie pour les wargames et jeux de plateau joués sur une vraie table : séquence de tour, rappels, tables de combat, poignées de dés, tables aléatoires et journal de partie. Chaque jeu est décrit dans un fichier JSON que tu modifies toi-même.

Il faut l'application Stream Deck 7.1 ou plus récente, sur macOS 12+ ou Windows 10+.

## Installation

Double-clique sur `com.paul.compagnon-wargame.streamDeckPlugin`. Les actions apparaissent dans la catégorie « Compagnon de wargame ».

Au premier lancement, le plugin crée `Documents/Compagnon de wargame/` avec deux dossiers :

- `jeux/` contient une copie modifiable des jeux fournis, le modèle `_modele.json` et la documentation du format `_LISEZMOI.md`.
- `journaux/` reçoit un fichier Markdown par partie.

## Les actions

| Action | Appui | Appui long | Molette (Stream Deck +) |
|---|---|---|---|
| Partie | Ouvrir le journal | Nouvelle partie (1,5 s) | |
| Séquence de tour | Phase suivante | Phase précédente | Tourner : défiler les phases |
| Rappels de phase | Rappel suivant | Revenir au premier | |
| Table de combat | Lancer | Colonne suivante | Tourner : colonne ; appuyée : modificateur |
| Bataille | Lancer la poignée | Nouvelle bataille | Tourner : nombre de dés ; appuyée : seuil ou profil |
| Ajuster (+/−) | Appliquer | Valeur par défaut | |
| Table aléatoire | Tirer | Effacer | Tourner : changer de table |
| Dés | Lancer | Effacer | |

Une disposition qui marche bien sur un Stream Deck classique : Partie, Séquence, Rappels sur la première rangée ; une touche Bataille par camp avec deux touches Ajuster (dés + et −) ; les tables aléatoires et les dés sur la dernière.

Le jeu se choisit dans les réglages de n'importe quelle touche. Changer de jeu clôt la partie en cours, son journal reste dans `journaux/`.

### Ce qui se passe tout seul

- La phase n'est notée au journal qu'après 2 secondes sans changement : tourner la molette dans un sens puis dans l'autre ne remplit pas le journal.
- Dans une bataille, le round avance quand un camp relance alors qu'il a déjà lancé dans le round en cours.
- Avec `"ordreCamps": "aleatoire"`, l'ordre de jeu est retiré au sort à chaque tour et noté en tête du tour.
- Le plugin relit le dossier `jeux/` dès qu'un fichier change. Une erreur de syntaxe s'affiche dans les réglages avec le nom du fichier et la cause.
- La partie est sauvegardée en continu et reprend où elle en était au redémarrage.

## Écrire un jeu

Le format complet est décrit dans `jeux/_LISEZMOI.md`. Pour démarrer, copie `_modele.json` sous un autre nom (sans `_` au début) et change son `id`.

Le fichier `divine-right-variante.json` est un squelette : les phases suivent les choix de ta variante, mais les camps, les seuils, les profils par race ou type et les événements sont provisoires.

## Développement

```bash
npm install
npm run build        # compile src/ vers com.paul.compagnon-wargame.sdPlugin/bin/plugin.js
npm test             # 20 tests de logique (dés, tables, séquence, batailles, journal)
npm run integration  # lance le vrai plugin face à un faux logiciel Stream Deck
npm run apercu       # rend toutes les faces de touches en PNG dans apercu/
npm run pack         # valide et produit dist/com.paul.compagnon-wargame.streamDeckPlugin
```

Pour travailler en direct sur ton Stream Deck : `npx streamdeck link com.paul.compagnon-wargame.sdPlugin`, puis `npm run watch`.

### Organisation du code

- `src/core/des.ts` : expressions de dés, plages de table.
- `src/core/jeux.ts` : format JSON, validation avec messages lisibles, chargement des dossiers.
- `src/core/etat.ts` : la partie en cours et toutes ses opérations, sans dépendance au SDK (testable seul).
- `src/core/journal.ts` : écriture du journal et ouverture des fichiers.
- `src/core/rendu.ts` : dessin SVG des touches (144 px) et des écrans tactiles (200 × 100).
- `src/actions/` : les huit actions ; `base.ts` gère appuis longs et molettes.
- `com.paul.compagnon-wargame.sdPlugin/ui/` : les réglages, une seule page pour toutes les actions.

## Limites connues

- Testé avec le SDK officiel et un simulateur du logiciel Stream Deck, pas encore sur un appareil réel.
- Le texte des touches utilise Arial ; sur un Stream Deck MK.2 (72 px par touche), les très longs noms de phase deviennent petits. Le champ `abrege` d'une phase règle ce problème.
- Au-delà d'une quinzaine de dés, une poignée s'affiche en résumé par face (« 6 ×7 ») plutôt que dé par dé.
