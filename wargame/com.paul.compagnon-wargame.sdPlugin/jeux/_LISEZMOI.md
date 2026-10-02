# Écrire un fichier de jeu

Chaque jeu est un fichier `.json` dans ce dossier. Le plugin relit le dossier dès qu'un fichier change : enregistre, et les touches se mettent à jour.

Les fichiers dont le nom commence par `_` sont ignorés (comme `_modele.json`, qui sert de point de départ). Un fichier de ce dossier remplace le jeu intégré qui a le même `id`.

Si un fichier contient une erreur, le message exact apparaît dans les réglages de n'importe quelle touche du plugin.

## Le jeu

| Champ | Obligatoire | Rôle |
|---|---|---|
| `id` | oui | Identifiant unique, lettres, chiffres et tirets |
| `nom` | oui | Nom affiché dans les réglages et en tête du journal |
| `abrege` | non | Nom court affiché sur la touche Partie |
| `tours` | non | Nombre de tours prévu ; la touche Séquence affiche « Tour 3 /12 » |
| `camps` | non | Liste de camps : `"Rouge"` ou `{ "nom": "Rouge", "couleur": "#B5473A" }` |
| `ordreCamps` | non | `"fixe"` (par défaut) ou `"aleatoire"` : ordre retiré au sort à chaque tour et noté au journal |
| `sequence` | oui | Les phases du tour (voir plus bas) |
| `tables` | non | Tables de combat, de bataille et aléatoires, chacune sous un identifiant |
| `des` | non | Expressions proposées pour la touche Dés, la première sert par défaut |

## La séquence de tour

Forme simple, une liste de phases :

```json
"sequence": ["Mouvement", "Combat", { "nom": "Ravitaillement", "abrege": "Ravito", "rappels": ["Vérifier les lignes"] }]
```

Forme avec camps : `debut` et `fin` sont joués une fois, `parCamp` est répété pour chaque camp, dans l'ordre du tour.

```json
"sequence": {
  "debut": ["Événements"],
  "parCamp": ["Mouvement", "Combat"],
  "fin": ["Fin de tour"]
}
```

Une phase peut avoir un `abrege` (texte affiché sur la touche) et des `rappels`, que la touche Rappels fait défiler.

## Plages de dés

Partout où une table attend une valeur de dé : `"3"` (exactement 3), `"2-4"`, `"7+"` (7 ou plus), `"1-"` (1 ou moins). Si un jet modifié sort de la table, c'est la ligne la plus proche qui s'applique.

## Table à colonnes (`"type": "colonnes"`)

Le rapport de forces des wargames classiques. Champs : `nom`, `de` (ex. `"1d6"`), `colonnes`, `colonneDefaut` (numéro de colonne en partant de 0), `modificateur` (`{ "min": -3, "max": 3 }`), `lignes` (une ligne par plage de dés, un résultat par colonne) et `resultats`, qui associe chaque code à un texte et une couleur.

## Poignée de dés (`"type": "poignee"`)

Un dé par unité, chaque dé qui atteint le seuil touche. Champs : `nom`, `faces` (6 par défaut), `des` (nombre de départ), `desMax`, `seuil`, `critique` (valeur à partir de laquelle un dé compte comme critique, facultatif), `camps` (ex. `["Attaquant", "Défenseur"]`) et `profils`, une liste `{ "nom": "Nains", "seuil": 4 }` que la touche Ajuster ou la molette font défiler.

Les rounds se comptent tout seuls : quand un camp relance alors qu'il a déjà lancé dans le round, le round suivant commence. Un appui long sur la touche Bataille ouvre une nouvelle bataille.

## Table aléatoire (`"type": "aleatoire"`)

Avec un dé : `de` et `entrees` sous forme d'objet de plages. Sans dé : `entrees` sous forme de liste, tirée de façon uniforme (comme une pioche). Chaque entrée est un texte, ou `{ "texte": "…", "court": "…" }` : le texte court s'affiche sur la touche, le texte complet va au journal.
