import { action, type Action } from "@elgato/streamdeck";
import { etat } from "../contexte.js";
import { facesDominantes } from "../core/des.js";
import { C, ecranAleatoire, ecranMessage, message, toucheAleatoire, toucheDes } from "../core/rendu.js";
import { ActionCompagnon, type Reglages } from "./base.js";

/* ───────────── Table aléatoire : événements, météo, rencontres… ───────────── */

type ReglagesAleatoire = Reglages & { table?: string };

@action({ UUID: "com.paul.compagnon-wargame.aleatoire" })
export class Aleatoire extends ActionCompagnon<ReglagesAleatoire> {
	private id(a: Action<ReglagesAleatoire>): string | null {
		const choisie = this.r(a).table;
		if (choisie && etat.table(choisie, "aleatoire")) return choisie;
		return etat.tablesDuType("aleatoire")[0]?.[0] ?? null;
	}

	private manque(): [string, string] {
		return etat.jeu ? ["Pas de table", "Ce jeu n'a pas de table aléatoire"] : ["Aucun jeu", "Choisis un jeu dans les réglages"];
	}

	protected image(a: Action<ReglagesAleatoire>): string {
		const id = this.id(a);
		const t = id ? etat.table(id, "aleatoire") : null;
		return t && id ? toucheAleatoire(t.nom, etat.dernierTirage(id)) : message(...this.manque(), C.encre);
	}

	protected override ecran(a: Action<ReglagesAleatoire>): string {
		const id = this.id(a);
		const t = id ? etat.table(id, "aleatoire") : null;
		return t && id ? ecranAleatoire(t.nom, etat.dernierTirage(id)) : ecranMessage(...this.manque(), C.encre);
	}

	protected override appuiCourt(a: Action<ReglagesAleatoire>): void {
		const id = this.id(a);
		if (id) etat.tirer(id);
	}

	protected override appuiLong(a: Action<ReglagesAleatoire>): void {
		const id = this.id(a);
		if (id) etat.effacerTirage(id);
	}

	/** Molette : passer d'une table aléatoire à l'autre. */
	protected override tourner(a: Action<ReglagesAleatoire>, crans: number): void {
		const tables = etat.tablesDuType("aleatoire").map(([id]) => id);
		if (tables.length < 2) return;
		const i = Math.max(0, tables.indexOf(this.id(a) ?? ""));
		const suivante = tables[(i + Math.sign(crans) + tables.length) % tables.length];
		void this.enregistrer(a, { table: suivante });
	}
}

/* ───────────── Dés libres ───────────── */

type ReglagesDes = Reglages & { expression?: string; libelle?: string };

@action({ UUID: "com.paul.compagnon-wargame.des" })
export class Des extends ActionCompagnon<ReglagesDes> {
	private resultats = new Map<string, { total: number; valeurs: number[]; faces: number | null }>();

	private expression(a: Action<ReglagesDes>): string {
		return this.r(a).expression?.trim() || etat.jeu?.des[0] || "2d6";
	}

	protected image(a: Action<ReglagesDes>): string {
		const r = this.r(a);
		return toucheDes(r.libelle?.trim() || this.expression(a), this.resultats.get(a.id) ?? null);
	}

	protected override appuiCourt(a: Action<ReglagesDes>): void {
		const expression = this.expression(a);
		try {
			const l = etat.lancerDes(expression, this.r(a).libelle?.trim() || undefined);
			this.resultats.set(a.id, { total: l.total, valeurs: l.des.map((d) => Math.abs(d.valeur)), faces: facesDominantes(l) });
			void this.dessiner(a);
		} catch {
			if (a.isKey()) {
				void a.setImage(`data:image/svg+xml;base64,${Buffer.from(message("Expression invalide", `« ${expression} » : essaie 2d6, d20 ou 3d6+1`, C.encre)).toString("base64")}`);
				void a.showAlert();
			}
		}
	}

	protected override appuiLong(a: Action<ReglagesDes>): void {
		this.resultats.delete(a.id);
		void this.dessiner(a);
	}
}
