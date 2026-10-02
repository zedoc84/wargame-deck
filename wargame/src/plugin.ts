import streamDeck from "@elgato/streamdeck";
import { Ajuster, Bataille, Combat } from "./actions/combat.js";
import { Partie, Rappels, Sequence } from "./actions/deroulement.js";
import { Aleatoire, Des } from "./actions/hasard.js";
import { etat } from "./contexte.js";
import { DOSSIER_JEUX, ouvrir } from "./core/journal.js";

streamDeck.logger.setLevel("info");

for (const a of [new Partie(), new Sequence(), new Rappels(), new Combat(), new Bataille(), new Ajuster(), new Aleatoire(), new Des()]) {
	streamDeck.actions.registerAction(a);
}

/* ───────────── Dialogue avec l'interface de réglages (property inspector) ───────────── */

function instantane() {
	const jeu = etat.jeu;
	return {
		type: "etat",
		jeux: [...etat.catalogue.jeux.values()].map((j) => ({ id: j.id, nom: j.nom, perso: !j.integre })),
		jeu: jeu?.id ?? null,
		tour: etat.data.tour,
		entrees: etat.data.entrees,
		tables: Object.entries(jeu?.tables ?? {}).map(([id, t]) => ({
			id,
			nom: t.nom,
			type: t.type,
			camps: t.type === "poignee" ? (t.camps ?? []) : [],
			profils: t.type === "poignee" ? (t.profils ?? []).map((p) => `${p.nom} (${p.seuil}+)`) : []
		})),
		des: jeu?.des ?? [],
		erreurs: etat.catalogue.erreurs,
		dossier: DOSSIER_JEUX
	};
}

let envoiPrevu: NodeJS.Timeout | null = null;
function envoyerEtat(): void {
	if (envoiPrevu) clearTimeout(envoiPrevu);
	envoiPrevu = setTimeout(() => {
		if (streamDeck.ui.action) void streamDeck.ui.sendToPropertyInspector(instantane());
	}, 150);
}

streamDeck.ui.onDidAppear(() => envoyerEtat());

streamDeck.ui.onSendToPlugin<{ type?: string; id?: string }>(async (ev) => {
	const demande = ev.payload ?? {};
	switch (demande.type) {
		case "choisirJeu":
			if (demande.id && demande.id !== etat.data.jeu) etat.nouvellePartie(demande.id);
			break;
		case "nouvellePartie":
			etat.nouvellePartie();
			break;
		case "recharger":
			await etat.recharger();
			break;
		case "ouvrirDossier":
			await ouvrir(DOSSIER_JEUX);
			break;
		case "ouvrirJournal": {
			const chemin = etat.cheminJournal();
			if (chemin) await ouvrir(chemin);
			break;
		}
	}
	envoyerEtat();
});

etat.abonner(envoyerEtat);

/* ───────────── Démarrage ───────────── */

await streamDeck.connect();
await etat.demarrer();
