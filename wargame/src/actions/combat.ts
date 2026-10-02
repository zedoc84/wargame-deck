import { action, type Action } from "@elgato/streamdeck";
import { etat } from "../contexte.js";
import { C, ecranCombat, ecranMessage, ecranPoignee, message, toucheAjuster, toucheCombat, touchePoignee, type InfoCombat, type InfoPoignee } from "../core/rendu.js";
import { ActionCompagnon, type Reglages } from "./base.js";

/** Table de combat choisie, ou la première du bon type dans le jeu actif. */
function tableChoisie(id: string | undefined, type: "colonnes" | "poignee"): string | null {
	if (id && etat.table(id, type)) return id;
	return etat.tablesDuType(type)[0]?.[0] ?? null;
}

const manque = (type: "colonnes" | "poignee"): [string, string] =>
	etat.jeu
		? ["Pas de table", type === "colonnes" ? "Ce jeu n'a pas de table de combat à colonnes" : "Ce jeu n'a pas de table de bataille"]
		: ["Aucun jeu", "Choisis un jeu dans les réglages"];

/* ───────────── Table de combat à colonnes (rapport de forces) ───────────── */

type ReglagesCombat = Reglages & { table?: string };

function infoCombat(id: string): InfoCombat | null {
	const t = etat.table(id, "colonnes");
	const c = etat.combat(id);
	if (!t || !c) return null;
	return { nom: t.nom, colonne: t.colonnes[c.colonne], mod: c.mod, dernier: c.dernier };
}

@action({ UUID: "com.paul.compagnon-wargame.combat" })
export class Combat extends ActionCompagnon<ReglagesCombat> {
	private id(a: Action<ReglagesCombat>) {
		return tableChoisie(this.r(a).table, "colonnes");
	}

	protected image(a: Action<ReglagesCombat>): string {
		const id = this.id(a);
		const info = id ? infoCombat(id) : null;
		return info ? toucheCombat(info) : message(...manque("colonnes"), C.sang);
	}

	protected override ecran(a: Action<ReglagesCombat>): string {
		const id = this.id(a);
		const info = id ? infoCombat(id) : null;
		return info ? ecranCombat(info) : ecranMessage(...manque("colonnes"), C.sang);
	}

	protected override appuiCourt(a: Action<ReglagesCombat>): void {
		const id = this.id(a);
		if (id) etat.lancerCombat(id);
	}

	/** Touche : colonne suivante (en boucle). Écran tactile maintenu : modificateur remis à zéro. */
	protected override appuiLong(a: Action<ReglagesCombat>): void {
		const id = this.id(a);
		const t = id ? etat.table(id, "colonnes") : null;
		const c = id ? etat.combat(id) : null;
		if (!id || !t || !c) return;
		if (a.isDial()) etat.reglerCombat(id, "mod", "defaut");
		else etat.reglerCombat(id, "colonne", c.colonne >= t.colonnes.length - 1 ? -c.colonne : 1);
	}

	protected override tourner(a: Action<ReglagesCombat>, crans: number, appuye: boolean): void {
		const id = this.id(a);
		if (id) etat.reglerCombat(id, appuye ? "mod" : "colonne", Math.sign(crans));
	}
}

/* ───────────── Poignée de dés : un dé par unité, touche à X+ ───────────── */

type ReglagesBataille = Reglages & { table?: string; camp?: string };

function infoPoignee(id: string, camp: string | undefined): InfoPoignee | null {
	const t = etat.table(id, "poignee");
	const p = etat.poignee(id, camp);
	if (!t || !p) return null;
	return {
		camp: etat.cleCamp(id, camp),
		profil: etat.nomProfil(id, p),
		des: p.des,
		seuil: p.seuil,
		faces: t.faces ?? 6,
		critique: t.critique ?? null,
		dernier: p.dernier
	};
}

@action({ UUID: "com.paul.compagnon-wargame.bataille" })
export class Bataille extends ActionCompagnon<ReglagesBataille> {
	private id(a: Action<ReglagesBataille>) {
		return tableChoisie(this.r(a).table, "poignee");
	}

	protected image(a: Action<ReglagesBataille>): string {
		const id = this.id(a);
		const info = id ? infoPoignee(id, this.r(a).camp) : null;
		return info ? touchePoignee(info) : message(...manque("poignee"), C.sang);
	}

	protected override ecran(a: Action<ReglagesBataille>): string {
		const id = this.id(a);
		const info = id ? infoPoignee(id, this.r(a).camp) : null;
		return info ? ecranPoignee(info) : ecranMessage(...manque("poignee"), C.sang);
	}

	protected override appuiCourt(a: Action<ReglagesBataille>): void {
		const id = this.id(a);
		if (id) etat.lancerPoignee(id, this.r(a).camp);
	}

	protected override appuiLong(a: Action<ReglagesBataille>): void {
		const id = this.id(a);
		if (!id) return;
		etat.nouvelleBataille(id);
		if (a.isKey()) void a.showOk();
	}

	protected override tourner(a: Action<ReglagesBataille>, crans: number, appuye: boolean): void {
		const id = this.id(a);
		if (!id) return;
		if (appuye) etat.reglerPoignee(id, this.r(a).camp, "seuil", Math.sign(crans));
		else etat.reglerPoignee(id, this.r(a).camp, "des", crans);
	}
}

/* ───────────── Ajuster : + ou − sur un réglage, pour les Stream Deck sans molette ───────────── */

type Cible = "colonne" | "mod" | "des" | "seuil";
type ReglagesAjuster = Reglages & { table?: string; camp?: string; cible?: Cible; sens?: "plus" | "moins" };

const LIBELLES: Record<Cible, string> = { colonne: "Colonne", mod: "Modificateur", des: "Dés", seuil: "Seuil" };

@action({ UUID: "com.paul.compagnon-wargame.ajuster" })
export class Ajuster extends ActionCompagnon<ReglagesAjuster> {
	/** Résout la table visée, son type et la cible compatible avec ce type. */
	private cible(a: Action<ReglagesAjuster>) {
		const r = this.r(a);
		let type: "colonnes" | "poignee" | null = null;
		let id: string | null = null;
		if (r.table && etat.table(r.table, "colonnes")) [type, id] = ["colonnes", r.table];
		else if (r.table && etat.table(r.table, "poignee")) [type, id] = ["poignee", r.table];
		else if ((id = tableChoisie(undefined, "colonnes"))) type = "colonnes";
		else if ((id = tableChoisie(undefined, "poignee"))) type = "poignee";
		if (!id || !type) return null;
		const permises: Cible[] = type === "colonnes" ? ["colonne", "mod"] : ["des", "seuil"];
		const cible = r.cible && permises.includes(r.cible) ? r.cible : permises[0];
		return { id, type, cible, sens: (r.sens === "moins" ? -1 : 1) as 1 | -1, camp: r.camp };
	}

	protected image(a: Action<ReglagesAjuster>): string {
		const c = this.cible(a);
		if (!c) return message(etat.jeu ? "Pas de table" : "Aucun jeu", etat.jeu ? "Ce jeu n'a pas de table de combat" : "Choisis un jeu dans les réglages", C.sang);
		if (c.type === "colonnes") {
			const t = etat.table(c.id, "colonnes")!;
			const e = etat.combat(c.id)!;
			const valeur = c.cible === "colonne" ? t.colonnes[e.colonne] : e.mod > 0 ? `+${e.mod}` : e.mod < 0 ? `−${-e.mod}` : "0";
			return toucheAjuster(t.nom, LIBELLES[c.cible], c.sens, valeur);
		}
		const t = etat.table(c.id, "poignee")!;
		const p = etat.poignee(c.id, c.camp)!;
		const profil = etat.nomProfil(c.id, p);
		const valeur = c.cible === "des" ? `${p.des} dés` : `${profil ? `${profil} ` : ""}${p.seuil}+`;
		return toucheAjuster(`${t.nom}, ${etat.cleCamp(c.id, c.camp)}`, LIBELLES[c.cible], c.sens, valeur);
	}

	protected override appuiCourt(a: Action<ReglagesAjuster>): void {
		const c = this.cible(a);
		if (!c) return;
		if (c.type === "colonnes") etat.reglerCombat(c.id, c.cible as "colonne" | "mod", c.sens);
		else etat.reglerPoignee(c.id, c.camp, c.cible as "des" | "seuil", c.sens);
	}

	/** Appui long : revenir à la valeur par défaut. */
	protected override appuiLong(a: Action<ReglagesAjuster>): void {
		const c = this.cible(a);
		if (!c) return;
		if (c.type === "colonnes") etat.reglerCombat(c.id, c.cible as "colonne" | "mod", "defaut");
		else etat.reglerPoignee(c.id, c.camp, c.cible as "des" | "seuil", "defaut");
		if (a.isKey()) void a.showOk();
	}
}
