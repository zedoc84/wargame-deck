// Tests du cœur du plugin (node scripts/tests.mjs après `npx tsc -p tsconfig.tests.json`).
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Dossier personnel isolé : le journal et les jeux sont écrits dans un répertoire temporaire.
const maison = mkdtempSync(path.join(os.tmpdir(), "compagnon-"));
process.env.HOME = maison;
process.env.USERPROFILE = maison;

const { analyser, lancer, lirePlage, chercherPlage, poignee } = await import("../build-tests/des.js");
const { normaliser, deplier, chargerJeux, longueurTour } = await import("../build-tests/jeux.js");
const { Etat } = await import("../build-tests/etat.js");
const { DOSSIER_JEUX, DOSSIER_JOURNAUX } = await import("../build-tests/journal.js");

const INTEGRES = path.resolve("com.paul.compagnon-wargame.sdPlugin/jeux");
let reussis = 0;
const test = async (nom, f) => {
	try {
		await f();
		reussis++;
		console.log(`  ok  ${nom}`);
	} catch (e) {
		console.error(`  ÉCHEC  ${nom}\n        ${e.message}`);
		process.exitCode = 1;
	}
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("Dés");
await test("expressions valides", () => {
	assert.equal(analyser("2d6").length, 1);
	assert.equal(analyser("d20")[0].nombre, 1);
	assert.equal(analyser("3d6-2").length, 2);
	assert.equal(analyser("1d6 + 1d4 + 1").length, 3);
	assert.equal(analyser("d%")[0].faces, 100);
});
await test("expressions invalides refusées", () => {
	assert.equal(analyser(" 2d6 + 1 ").length, 2, "espaces tolérés autour du signe");
	for (const mauvaise of ["", "2d", "d1", "abc", "2d6 3", "2d6++1", "200d6"]) assert.throws(() => analyser(mauvaise), mauvaise);
});
await test("bornes des lancers sur 20 000 jets", () => {
	const vus = new Set();
	for (let i = 0; i < 20000; i++) {
		const l = lancer("2d6+1");
		assert.ok(l.total >= 3 && l.total <= 13);
		assert.equal(l.des.length, 2);
		vus.add(l.total);
	}
	assert.equal(vus.size, 11, "toutes les valeurs 3 à 13 doivent sortir");
});
await test("poignée : nombre et faces", () => {
	const p = poignee(30, 6);
	assert.equal(p.length, 30);
	assert.ok(p.every((v) => v >= 1 && v <= 6));
});
await test("plages de table", () => {
	assert.deepEqual([lirePlage("3").min, lirePlage("3").max], [3, 3]);
	assert.deepEqual([lirePlage("2-4").min, lirePlage("2-4").max], [2, 4]);
	assert.equal(lirePlage("7+").max, Infinity);
	assert.equal(lirePlage("1-").min, -Infinity);
	assert.throws(() => lirePlage("deux"));
	const cles = ["1-", "2", "3", "4", "5", "6+"];
	assert.equal(chercherPlage(cles, -3), "1-");
	assert.equal(chercherPlage(cles, 4), "4");
	assert.equal(chercherPlage(cles, 9), "6+");
	assert.equal(chercherPlage(["2-3", "4-5"], 1), "2-3", "hors table en dessous : plage la plus proche");
	assert.equal(chercherPlage(["2-3", "4-5"], 8), "4-5", "hors table au-dessus : plage la plus proche");
});

console.log("Jeux");
await test("les jeux fournis se chargent sans erreur", async () => {
	const c = await chargerJeux(path.join(maison, "rien"), INTEGRES);
	assert.deepEqual(c.erreurs, []);
	assert.deepEqual([...c.jeux.keys()].sort(), ["divine-right-variante", "exemple-wargame"]);
});
await test("le modèle _modele.json est valide", () => {
	const brut = JSON.parse(readFileSync(path.join(INTEGRES, "_modele.json"), "utf8"));
	const jeu = normaliser(brut, "_modele.json", true);
	assert.equal(longueurTour(jeu), 1 + 2 * 2 + 1);
});
await test("séquence dépliée selon l'ordre des camps", async () => {
	const c = await chargerJeux(path.join(maison, "rien"), INTEGRES);
	const jeu = c.jeux.get("exemple-wargame");
	const etapes = deplier(jeu, ["Rouge", "Bleu"]);
	assert.deepEqual(
		etapes.map((e) => `${e.nom}${e.camp ? "/" + e.camp.nom : ""}`),
		["Météo", "Renforts/Rouge", "Mouvement/Rouge", "Combat/Rouge", "Renforts/Bleu", "Mouvement/Bleu", "Combat/Bleu", "Fin de tour"]
	);
});
await test("messages d'erreur lisibles", () => {
	const base = { id: "t", nom: "T", sequence: ["A"] };
	assert.throws(() => normaliser({ ...base, id: "a b" }, "x", false), /id/);
	assert.throws(() => normaliser({ ...base, sequence: { parCamp: ["A"] } }, "x", false), /camps/);
	assert.throws(
		() => normaliser({ ...base, tables: { c: { type: "colonnes", nom: "C", de: "1d6", colonnes: ["1:1", "2:1"], lignes: { "1-6": ["A"] } } } }, "x", false),
		/2 résultats attendus/
	);
	assert.throws(() => normaliser({ ...base, tables: { c: { type: "inconnu", nom: "C" } } }, "x", false), /type inconnu/);
});

console.log("Partie");
const sauvegardes = [];
const etat = new Etat({ charger: async () => ({}), sauver: async (e) => sauvegardes.push(JSON.parse(JSON.stringify(e))), log: () => {} }, INTEGRES);

await test("premier lancement : copie des jeux et choix d'un jeu", async () => {
	await etat.demarrer();
	const copies = readdirSync(DOSSIER_JEUX).sort();
	assert.ok(copies.includes("divine-right-variante.json") && copies.includes("_modele.json") && copies.includes("_LISEZMOI.md"));
	assert.ok(etat.jeu);
});

await test("séquence : avancer, changer de tour, reculer", () => {
	etat.nouvellePartie("exemple-wargame");
	const n = etat.etapes().length;
	assert.equal(n, 8);
	for (let i = 0; i < n - 1; i++) etat.changerPhase(1);
	assert.equal(etat.data.tour, 1);
	assert.equal(etat.etape.nom, "Fin de tour");
	etat.changerPhase(1);
	assert.equal(etat.data.tour, 2);
	assert.equal(etat.data.etape, 0);
	etat.changerPhase(-1);
	assert.equal(etat.data.tour, 1);
	assert.equal(etat.etape.nom, "Fin de tour");
	etat.changerPhase(1);
	// On ne recule pas avant le tour 1, phase 1.
	const vierge = new Etat({ charger: async () => ({}), sauver: async () => {}, log: () => {} }, INTEGRES);
	vierge.catalogue = etat.catalogue;
	vierge.nouvellePartie("exemple-wargame");
	vierge.changerPhase(-1);
	assert.deepEqual([vierge.data.tour, vierge.data.etape], [1, 0]);
});

await test("rappels : défilement et remise à zéro au changement de phase", () => {
	etat.changerPhase(1); // Renforts / Bleu
	assert.equal(etat.etape.rappels.length, 2);
	etat.rappel(1);
	etat.rappel(1);
	etat.rappel(1);
	assert.equal(etat.data.rappel, 2, "plafonné au nombre de rappels");
	etat.changerPhase(1);
	assert.equal(etat.data.rappel, 0);
});

await test("table à colonnes : bornes et cohérence du résultat", () => {
	const c = etat.combat("combat");
	assert.equal(c.colonne, 2, "colonne par défaut 1:1");
	etat.reglerCombat("combat", "colonne", 50);
	assert.equal(c.colonne, 7);
	etat.reglerCombat("combat", "colonne", -50);
	assert.equal(c.colonne, 0);
	etat.reglerCombat("combat", "mod", 10);
	assert.equal(c.mod, 3, "modificateur plafonné à +3");
	etat.reglerCombat("combat", "colonne", 4); // 5e colonne : 3:1
	for (let i = 0; i < 200; i++) {
		const r = etat.lancerCombat("combat");
		assert.equal(r.colonne, "3:1");
		assert.equal(r.total, r.jet + 3);
		const t = etat.table("combat", "colonnes");
		assert.equal(r.code, t.lignes[chercherPlage(Object.keys(t.lignes), r.total)][4]);
	}
	etat.reglerCombat("combat", "mod", "defaut");
	assert.equal(c.mod, 0);
	assert.equal(c.dernier, null, "un changement de réglage efface le dernier résultat");
});

await test("poignée : touches, critiques, rounds automatiques", () => {
	etat.reglerPoignee("assaut", "Attaquant", "des", 4); // 6 + 4 = 10 dés
	const a = etat.lancerPoignee("assaut", "Attaquant");
	assert.equal(a.valeurs.length, 10);
	assert.equal(a.touches, a.valeurs.filter((v) => v >= 5).length);
	assert.equal(a.critiques, a.valeurs.filter((v) => v >= 6).length);
	assert.deepEqual(a.valeurs, [...a.valeurs].sort((x, y) => y - x), "dés triés du plus fort au plus faible");
	assert.equal(a.round, 1);
	const d = etat.lancerPoignee("assaut", "Défenseur");
	assert.equal(d.round, 1, "le défenseur répond dans le même round");
	const a2 = etat.lancerPoignee("assaut", "Attaquant");
	assert.equal(a2.round, 2, "l'attaquant relance : round suivant");
	etat.nouvelleBataille("assaut");
	assert.equal(etat.data.bataille.round, 1);
	assert.equal(etat.poignee("assaut", "Attaquant").dernier, null);
});

await test("poignée : profils qui défilent puis reviennent au seuil de base", () => {
	const p = etat.poignee("assaut", "Défenseur");
	etat.reglerPoignee("assaut", "Défenseur", "seuil", 1);
	assert.deepEqual([etat.nomProfil("assaut", p), p.seuil], ["Élite", 4]);
	etat.reglerPoignee("assaut", "Défenseur", "seuil", 1);
	assert.deepEqual([etat.nomProfil("assaut", p), p.seuil], ["Recrues", 6]);
	etat.reglerPoignee("assaut", "Défenseur", "seuil", 1);
	assert.deepEqual([etat.nomProfil("assaut", p), p.seuil], [null, 5]);
	etat.reglerPoignee("assaut", "Défenseur", "seuil", -1);
	assert.equal(etat.nomProfil("assaut", p), "Recrues");
	etat.reglerPoignee("assaut", "Défenseur", "des", -100);
	assert.equal(p.des, 1, "au moins un dé");
});

await test("tables aléatoires et dés libres", () => {
	for (let i = 0; i < 100; i++) {
		const r = etat.tirer("evenements");
		assert.match(r.detail, /^2d6 = (\d+)$/);
		assert.ok(r.texte.length > 0);
	}
	const m = etat.tirer("meteo");
	assert.ok(["Beau temps", "Couvert", "Pluie, mouvement −1", "Tempête"].includes(m.court));
	etat.effacerTirage("meteo");
	assert.equal(etat.dernierTirage("meteo"), null);
	const l = etat.lancerDes("3d6+2", "Moral");
	assert.ok(l.total >= 5 && l.total <= 20);
	assert.throws(() => etat.lancerDes("trois dés"));
});

await test("ordre des camps tiré au sort et mémorisé par tour", () => {
	etat.nouvellePartie("divine-right-variante");
	const ordre1 = etat.ordre();
	assert.equal(ordre1.length, 4);
	assert.deepEqual(etat.ordre(), ordre1, "stable dans le tour");
	assert.equal(etat.etapes().length, 1 + 4 * 4 + 1);
	const ordres = new Set();
	for (let i = 0; i < 40; i++) {
		for (let j = 0; j < etat.etapes().length; j++) etat.changerPhase(1);
		ordres.add(etat.ordre().join());
	}
	assert.ok(ordres.size > 5, "l'ordre change d'un tour à l'autre");
});

await test("journal : en-têtes, phases différées, jets", async () => {
	etat.nouvellePartie("exemple-wargame");
	etat.changerPhase(1);
	etat.changerPhase(1);
	etat.changerPhase(-1); // aller-retour rapide : seule la phase finale doit être notée
	await attendre(2300);
	etat.lancerCombat("combat");
	etat.lancerPoignee("assaut", "Attaquant");
	etat.tirer("meteo");
	etat.changerPhase(1);
	etat.changerPhase(-1); // retour sur la même phase : pas de doublon
	await attendre(2300);
	const chemin = etat.cheminJournal();
	await attendre(200);
	const texte = readFileSync(chemin, "utf8");
	assert.match(texte, /^# Wargame classique \(exemple\)/);
	assert.match(texte, /## Tour 1 \/ 10/);
	assert.match(texte, /Phase : Renforts \(Bleu\)/);
	assert.doesNotMatch(texte, /Phase : Mouvement \(Bleu\)/, "les allers-retours ne sont pas notés");
	assert.equal(texte.match(/Phase : Renforts \(Bleu\)/g).length, 1, "une phase n'est notée qu'une fois");
	assert.match(texte, /Combat à 1:1 : jet \d → \*\*(AE|AR|EX|DR|DE)\*\*/);
	assert.match(texte, /Assaut, round 1 — Attaquant : 6d6 à 5\+ → \*\*\d+ touches?\*\*/);
	assert.match(texte, /Météo \(1d6 = \d\) : /);
	assert.ok(etat.data.entrees >= 4);
	console.log("\n--- extrait du journal ---\n" + texte.trim().split("\n").slice(0, 12).join("\n") + "\n---");
});

await test("jeu personnel : remplace l'intégré, erreurs signalées, rechargement", async () => {
	const perso = JSON.parse(readFileSync(path.join(DOSSIER_JEUX, "exemple-wargame.json"), "utf8"));
	perso.nom = "Mon exemple modifié";
	writeFileSync(path.join(DOSSIER_JEUX, "exemple-wargame.json"), JSON.stringify(perso));
	writeFileSync(path.join(DOSSIER_JEUX, "casse.json"), "{ \"id\": \"casse\", ");
	await etat.recharger();
	assert.equal(etat.catalogue.jeux.get("exemple-wargame").nom, "Mon exemple modifié");
	assert.equal(etat.catalogue.jeux.get("exemple-wargame").integre, false);
	assert.equal(etat.catalogue.erreurs.length, 1);
	assert.match(etat.catalogue.erreurs[0].message, /JSON mal formé/);
});

await test("reprise d'une partie sauvegardée", async () => {
	await attendre(400);
	const derniere = sauvegardes.at(-1);
	assert.ok(derniere && derniere.jeu === "exemple-wargame");
	const reprise = new Etat({ charger: async () => derniere, sauver: async () => {}, log: () => {} }, INTEGRES);
	await reprise.demarrer();
	assert.equal(reprise.data.tour, derniere.tour);
	assert.equal(reprise.data.journal, derniere.journal);
	reprise.arreter();
});

etat.arreter();
console.log(`\n${reussis} tests réussis${process.exitCode ? ", des échecs ci-dessus" : ""}. Journaux : ${DOSSIER_JOURNAUX}`);
process.exit(process.exitCode ?? 0);
