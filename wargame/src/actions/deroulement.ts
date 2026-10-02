import { action, type Action } from "@elgato/streamdeck";
import { etat } from "../contexte.js";
import { ouvrir } from "../core/journal.js";
import { ecranMessage, ecranPhase, message, toucheRappel, touchePartie, touchePhase, type InfoPhase } from "../core/rendu.js";
import { ActionCompagnon, type Reglages } from "./base.js";

const AUCUN_JEU = ["Aucun jeu", "Choisis un jeu dans les réglages de la touche"] as const;

/** Touche « Partie » : appui = ouvrir le journal ; appui long (1,5 s) = nouvelle partie. */
@action({ UUID: "com.paul.compagnon-wargame.partie" })
export class Partie extends ActionCompagnon {
	protected override dureeAppuiLong = 1500;

	protected image(): string {
		const jeu = etat.jeu;
		if (!jeu) return message(...AUCUN_JEU);
		return touchePartie(jeu.abrege, etat.data.tour, etat.data.entrees);
	}

	protected override appuiCourt(a: Action<Reglages>): void {
		const chemin = etat.cheminJournal();
		if (!chemin) {
			if (a.isKey()) void a.showAlert();
			return;
		}
		void ouvrir(chemin);
	}

	protected override appuiLong(a: Action<Reglages>): void {
		if (!etat.jeu) return;
		etat.nouvellePartie();
		if (a.isKey()) void a.showOk();
	}
}

function infoPhase(): InfoPhase | null {
	const jeu = etat.jeu;
	const etape = etat.etape;
	if (!jeu || !etape) return null;
	return {
		tour: etat.data.tour,
		tours: jeu.tours,
		nom: etape.abrege,
		camp: etape.camp,
		index: etat.data.etape,
		total: etat.etapes().length,
		depasse: !!jeu.tours && etat.data.tour > jeu.tours
	};
}

/** Séquence de jeu : appui = phase suivante ; appui long = phase précédente ; molette = défiler. */
@action({ UUID: "com.paul.compagnon-wargame.sequence" })
export class Sequence extends ActionCompagnon {
	protected image(): string {
		const info = infoPhase();
		return info ? touchePhase(info) : message(...AUCUN_JEU);
	}

	protected override ecran(): string {
		const info = infoPhase();
		return info ? ecranPhase(info) : ecranMessage(...AUCUN_JEU);
	}

	protected override appuiCourt(): void {
		etat.changerPhase(1);
	}

	protected override appuiLong(): void {
		etat.changerPhase(-1);
	}

	protected override tourner(_a: Action<Reglages>, crans: number): void {
		etat.changerPhase(crans > 0 ? 1 : -1);
	}
}

/** Rappels de la phase en cours : appui = rappel suivant ; appui long = revenir au premier. */
@action({ UUID: "com.paul.compagnon-wargame.rappels" })
export class Rappels extends ActionCompagnon {
	protected image(): string {
		const etape = etat.etape;
		if (!etape) return message(...AUCUN_JEU);
		const total = etape.rappels.length;
		const i = etat.data.rappel;
		return toucheRappel(etape.abrege, i, total, i < total ? etape.rappels[i] : null);
	}

	protected override appuiCourt(): void {
		etat.rappel(1);
	}

	protected override appuiLong(): void {
		etat.rappel(0);
	}
}
