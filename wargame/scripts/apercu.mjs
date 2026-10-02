// Rend toutes les faces de touches et d'écrans en PNG pour relecture visuelle.
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
const R = await import("../build-tests/rendu.js");
const out = "apercu"; mkdirSync(out, { recursive: true });
const png = (nom, svg, l) => writeFileSync(`${out}/${nom}.png`, new Resvg(svg, { fitTo: { mode: "width", value: l }, font: { loadSystemFonts: true, sansSerifFamily: "Liberation Sans", defaultFontFamily: "Liberation Sans" } }).render().asPng());
const bleu = { nom: "Bleu", couleur: "#3F6FA8" }, j3 = { nom: "Joueur 3", couleur: "#C9A13B" };
const touches = {
 "01-partie": R.touchePartie("Divine Right", 3, 42),
 "02-phase": R.touchePhase({ tour: 3, tours: 10, nom: "Mouvement", camp: bleu, index: 2, total: 8, depasse: false }),
 "03-phase-longue": R.touchePhase({ tour: 12, tours: null, nom: "Batailles et sièges", camp: j3, index: 7, total: 18, depasse: false }),
 "04-phase-sanscamp": R.touchePhase({ tour: 11, tours: 10, nom: "Fin de tour", camp: null, index: 7, total: 8, depasse: true }),
 "05-rappel": R.toucheRappel("Combat", 0, 2, "Déclarer toutes les attaques avant de lancer"),
 "06-rappel-fini": R.toucheRappel("Combat", 2, 2, null),
 "07-combat": R.toucheCombat({ nom: "Combat", colonne: "3:1", mod: 1, dernier: null }),
 "08-combat-res": R.toucheCombat({ nom: "Combat", colonne: "3:1", mod: 1, dernier: { code: "DE", texte: "Défenseur éliminé", couleur: "#2F6B47", jet: 5, total: 6, mod: 1 } }),
 "09-combat-res2": R.toucheCombat({ nom: "Combat", colonne: "1:2", mod: 0, dernier: { code: "AR", texte: "Attaquant recule", couleur: "#C77D3A", jet: 2, total: 2, mod: 0 } }),
 "10-poignee": R.touchePoignee({ camp: "Attaquant", profil: null, des: 8, seuil: 4, faces: 6, critique: null, dernier: null }),
 "11-poignee-8": R.touchePoignee({ camp: "Attaquant", profil: "Nains", des: 8, seuil: 4, faces: 6, critique: 6, dernier: { valeurs: [6,6,5,4,3,2,2,1], touches: 4, critiques: 2, round: 2, seuil: 4 } }),
 "12-poignee-20": R.touchePoignee({ camp: "Défenseur", profil: null, des: 20, seuil: 5, faces: 6, critique: null, dernier: { valeurs: [6,6,6,5,5,5,5,4,4,4,3,3,3,3,2,2,2,1,1,1], touches: 7, critiques: 0, round: 1, seuil: 5 } }),
 "13-poignee-40": R.touchePoignee({ camp: "Garnison", profil: null, des: 40, seuil: 5, faces: 6, critique: null, dernier: { valeurs: Array.from({length:40},(_,i)=>6-(i%6)).sort((a,b)=>b-a), touches: 14, critiques: 0, round: 3, seuil: 5 } }),
 "14-ajuster-plus": R.toucheAjuster("Combat", "Colonne", 1, "3:1"),
 "15-ajuster-moins": R.toucheAjuster("Bataille, Attaquant", "Seuil", -1, "Nains 4+"),
 "16-aleatoire": R.toucheAleatoire("Événement", null),
 "17-aleatoire-res": R.toucheAleatoire("Événement", { court: "Convoi intercepté : pas de renforts ce tour", detail: "2d6 = 4" }),
 "18-des": R.toucheDes("2d6", null),
 "19-des-res": R.toucheDes("Moral", { total: 9, valeurs: [6,3], faces: 6 }),
 "20-des-d20": R.toucheDes("d20", { total: 17, valeurs: [17], faces: 20 }),
 "21-message": R.message("Aucun jeu", "Choisis un jeu dans les réglages de la touche"),
};
for (const [n, s] of Object.entries(touches)) png("t" + n, s, 144);
const ecrans = {
 "01-phase": R.ecranPhase({ tour: 3, tours: 10, nom: "Mouvement", camp: bleu, index: 2, total: 8, depasse: false }),
 "02-phase-long": R.ecranPhase({ tour: 4, tours: null, nom: "Batailles et sièges", camp: j3, index: 9, total: 18, depasse: false }),
 "03-combat": R.ecranCombat({ nom: "Combat", colonne: "3:1", mod: -1, dernier: null }),
 "04-combat-res": R.ecranCombat({ nom: "Combat", colonne: "3:1", mod: 1, dernier: { code: "EX", texte: "Échange de pertes", couleur: "#9A8F7A", jet: 4, total: 5, mod: 1 } }),
 "05-poignee": R.ecranPoignee({ camp: "Attaquant", profil: "Elfes", des: 9, seuil: 3, faces: 6, critique: 6, dernier: null }),
 "06-poignee-res": R.ecranPoignee({ camp: "Attaquant", profil: "Elfes", des: 9, seuil: 3, faces: 6, critique: 6, dernier: { valeurs: [6,5,5,4,3,3,2,1,1], touches: 6, critiques: 1, round: 2, seuil: 3 } }),
 "07-aleatoire-res": R.ecranAleatoire("Météo", { texte: "Tempête : mouvement divisé par deux, pas d'appui aérien", detail: "1d6 = 6" }),
 "08-message": R.ecranMessage("Pas de table", "Ce jeu n'a pas de table de bataille"),
};
for (const [n, s] of Object.entries(ecrans)) png("e" + n, s, 200);
console.log("ok");
