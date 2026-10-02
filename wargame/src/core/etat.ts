import { randomInt } from "node:crypto";
import { existsSync, watch, type FSWatcher } from "node:fs";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { chercherPlage, lancer, poignee as lancerPoigneeDes, type Lancer } from "./des.js";
import { chargerJeux, deplier, longueurTour, type Catalogue, type Etape, type Jeu, type TableAleatoireJson, type TableColonnesJson, type TablePoigneeJson } from "./jeux.js";
import { DOSSIER_JEUX, dateLongue, ecrire, heure, nomJournal } from "./journal.js";

/* ───────────── Types de l'état persistant ───────────── */

export interface ResultatCombat {
	colonne: string;
	jet: number;
	des: number[];
	mod: number;
	total: number;
	code: string;
	texte: string;
	couleur: string | null;
}

export interface EtatCombat {
	colonne: number;
	mod: number;
	dernier: ResultatCombat | null;
}

export interface ResultatPoignee {
	valeurs: number[];
	touches: number;
	critiques: number;
	round: number;
	seuil: number;
	faces: number;
}

export interface EtatPoignee {
	des: number;
	seuil: number;
	profil: number | null;
	dernier: ResultatPoignee | null;
}

export interface ResultatAleatoire {
	texte: string;
	court: string;
	detail: string;
}

export interface EtatPartie {
	version: 1;
	jeu: string | null;
	tour: number;
	etape: number;
	ordres: Record<string, string[]>;
	rappel: number;
	combats: Record<string, EtatCombat>;
	poignees: Record<string, EtatPoignee>;
	bataille: { round: number; lances: string[] };
	aleatoires: Record<string, ResultatAleatoire>;
	journal: string | null;
	entrees: number;
	dernierTourJournal: number;
}

function etatVide(jeu: string | null = null): EtatPartie {
	return {
		version: 1,
		jeu,
		tour: 1,
		etape: 0,
		ordres: {},
		rappel: 0,
		combats: {},
		poignees: {},
		bataille: { round: 1, lances: [] },
		aleatoires: {},
		journal: null,
		entrees: 0,
		dernierTourJournal: 0
	};
}

export interface Persistance {
	charger(): Promise<unknown>;
	sauver(etat: EtatPartie): Promise<void>;
	log(message: string): void;
}

function melanger<T>(liste: T[]): T[] {
	const copie = [...liste];
	for (let i = copie.length - 1; i > 0; i--) {
		const j = randomInt(0, i + 1);
		[copie[i], copie[j]] = [copie[j], copie[i]];
	}
	return copie;
}

const signe = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");

/* ───────────── Le magasin d'état ───────────── */

export class Etat {
	catalogue: Catalogue = { jeux: new Map(), erreurs: [] };
	data: EtatPartie = etatVide();
	private abonnes = new Set<() => void>();
	private minuterieSauvegarde: NodeJS.Timeout | null = null;
	private phaseEnAttente: { minuterie: NodeJS.Timeout; ecrire: () => void } | null = null;
	private surveillance: FSWatcher | null = null;
	/** Dernière phase écrite au journal (tour et étape), pour ne pas la noter deux fois de suite. */
	private derniereNotee = "";

	constructor(
		private persistance: Persistance,
		private dossierIntegre: string,
		private dossierPerso: string = DOSSIER_JEUX
	) {}

	/* ── Initialisation ── */

	async demarrer(): Promise<void> {
		await this.preparerDossierPerso();
		this.catalogue = await chargerJeux(this.dossierPerso, this.dossierIntegre);
		const sauve = (await this.persistance.charger().catch(() => null)) as Partial<EtatPartie> | null;
		if (sauve && sauve.version === 1) this.data = { ...etatVide(), ...sauve };
		if (this.data.jeu && !this.catalogue.jeux.has(this.data.jeu)) this.data = etatVide();
		if (!this.data.jeu && this.catalogue.jeux.size > 0) {
			// Premier lancement : on prend le premier jeu personnel, sinon le premier intégré.
			const premier = [...this.catalogue.jeux.values()].sort((a, b) => Number(a.integre) - Number(b.integre))[0];
			this.data = etatVide(premier.id);
		}
		this.borner();
		this.surveiller();
		this.notifier();
	}

	private async preparerDossierPerso(): Promise<void> {
		const premierLancement = !existsSync(this.dossierPerso);
		await mkdir(this.dossierPerso, { recursive: true });
		if (!premierLancement) return;
		// On copie les jeux fournis pour que l'utilisateur puisse les modifier directement.
		for (const nom of await readdir(this.dossierIntegre).catch(() => [] as string[])) {
			if (nom.endsWith(".json") || nom.endsWith(".md")) await copyFile(path.join(this.dossierIntegre, nom), path.join(this.dossierPerso, nom)).catch(() => undefined);
		}
	}

	private surveiller(): void {
		try {
			let minuterie: NodeJS.Timeout | null = null;
			this.surveillance = watch(this.dossierPerso, () => {
				if (minuterie) clearTimeout(minuterie);
				minuterie = setTimeout(() => void this.recharger(), 400);
			});
		} catch (e) {
			this.persistance.log(`Surveillance du dossier impossible : ${(e as Error).message}`);
		}
	}

	arreter(): void {
		this.surveillance?.close();
	}

	async recharger(): Promise<void> {
		this.catalogue = await chargerJeux(this.dossierPerso, this.dossierIntegre);
		if (this.data.jeu && !this.catalogue.jeux.has(this.data.jeu)) this.data.jeu = null;
		this.borner();
		this.notifier();
	}

	/* ── Abonnements et sauvegarde ── */

	abonner(f: () => void): () => void {
		this.abonnes.add(f);
		return () => this.abonnes.delete(f);
	}

	notifier(): void {
		for (const f of this.abonnes) {
			try {
				f();
			} catch (e) {
				this.persistance.log(`Erreur d'affichage : ${(e as Error).message}`);
			}
		}
		if (this.minuterieSauvegarde) clearTimeout(this.minuterieSauvegarde);
		this.minuterieSauvegarde = setTimeout(() => void this.persistance.sauver(this.data), 300);
	}

	/* ── Lecture ── */

	get jeu(): Jeu | null {
		return this.data.jeu ? (this.catalogue.jeux.get(this.data.jeu) ?? null) : null;
	}

	ordre(tour = this.data.tour): string[] {
		const jeu = this.jeu;
		if (!jeu) return [];
		const enregistre = this.data.ordres[String(tour)];
		const noms = jeu.camps.map((c) => c.nom);
		if (enregistre && enregistre.length === noms.length && enregistre.every((n) => noms.includes(n))) return enregistre;
		const ordre = jeu.ordreCamps === "aleatoire" ? melanger(noms) : noms;
		this.data.ordres[String(tour)] = ordre;
		return ordre;
	}

	etapes(tour = this.data.tour): Etape[] {
		const jeu = this.jeu;
		return jeu ? deplier(jeu, this.ordre(tour)) : [];
	}

	get etape(): Etape | null {
		return this.etapes()[this.data.etape] ?? null;
	}

	private borner(): void {
		const jeu = this.jeu;
		if (!jeu) return;
		const n = longueurTour(jeu);
		if (this.data.etape >= n) this.data.etape = Math.max(0, n - 1);
		if (this.data.tour < 1) this.data.tour = 1;
	}

	/* ── Journal ── */

	private assurerJournal(): string | null {
		const jeu = this.jeu;
		if (!jeu) return null;
		if (!this.data.journal) {
			this.data.journal = nomJournal(jeu.id);
			void ecrire(this.data.journal, `# ${jeu.nom}\n\nPartie commencée le ${dateLongue()} à ${heure()}.\n`);
		}
		if (this.data.dernierTourJournal < this.data.tour) {
			this.data.dernierTourJournal = this.data.tour;
			const ordre = this.ordre();
			const total = jeu.tours ? ` / ${jeu.tours}` : "";
			let entete = `\n## Tour ${this.data.tour}${total}\n\n`;
			if (ordre.length > 1 && jeu.parCamp.length > 0) entete += `Ordre de jeu : ${ordre.join(", ")}\n\n`;
			void ecrire(this.data.journal, entete);
		}
		return this.data.journal;
	}

	/** Chemin du journal de la partie (créé au besoin). */
	cheminJournal(): string | null {
		this.vider();
		return this.assurerJournal();
	}

	private vider(): void {
		if (!this.phaseEnAttente) return;
		clearTimeout(this.phaseEnAttente.minuterie);
		const f = this.phaseEnAttente.ecrire;
		this.phaseEnAttente = null;
		f();
	}

	/** Ajoute une ligne horodatée au journal. */
	noter(ligne: string): void {
		this.vider();
		const fichier = this.assurerJournal();
		if (!fichier) return;
		this.data.entrees++;
		void ecrire(fichier, `- **${heure()}** ${ligne}\n`);
	}

	/** La phase n'est notée qu'après 2 s de stabilité : tourner une molette ne remplit pas le journal. */
	private noterPhaseDiffere(): void {
		if (this.phaseEnAttente) clearTimeout(this.phaseEnAttente.minuterie);
		const tour = this.data.tour;
		const etape = this.etape;
		if (!etape) return;
		const cle = `${tour}|${this.data.etape}`;
		const ecrireMaintenant = () => {
			this.phaseEnAttente = null;
			if (this.data.tour !== tour || cle === this.derniereNotee) return;
			this.derniereNotee = cle;
			const camp = etape.camp ? ` (${etape.camp.nom})` : "";
			this.noter(`Phase : ${etape.nom}${camp}`);
			this.notifier();
		};
		this.phaseEnAttente = { minuterie: setTimeout(ecrireMaintenant, 2000), ecrire: ecrireMaintenant };
	}

	/* ── Partie ── */

	nouvellePartie(idJeu = this.data.jeu): void {
		this.vider();
		const ancien = this.data.journal;
		if (ancien) void ecrire(ancien, `\n---\nPartie close le ${dateLongue()} à ${heure()}.\n`);
		this.data = etatVide(idJeu && this.catalogue.jeux.has(idJeu) ? idJeu : null);
		this.derniereNotee = "";
		this.assurerJournal();
		this.noterPhaseDiffere();
		this.notifier();
	}

	/** Avance (+1) ou recule (−1) d'une phase ; passe au tour suivant ou précédent si besoin. */
	changerPhase(sens: 1 | -1): void {
		const jeu = this.jeu;
		if (!jeu) return;
		const n = longueurTour(jeu);
		if (sens > 0) {
			if (this.data.etape < n - 1) this.data.etape++;
			else {
				this.data.tour++;
				this.data.etape = 0;
				this.data.bataille = { round: 1, lances: [] };
			}
		} else {
			if (this.data.etape > 0) this.data.etape--;
			else if (this.data.tour > 1) {
				this.data.tour--;
				this.data.etape = n - 1;
			} else return;
		}
		this.data.rappel = 0;
		this.noterPhaseDiffere();
		this.notifier();
	}

	rappel(sens: 1 | 0): void {
		const etape = this.etape;
		if (!etape || etape.rappels.length === 0) return;
		this.data.rappel = sens === 0 ? 0 : Math.min(this.data.rappel + 1, etape.rappels.length);
		this.notifier();
	}

	/* ── Tables de combat à colonnes ── */

	table<T extends "colonnes" | "poignee" | "aleatoire">(id: string | undefined, type: T) {
		const t = id ? this.jeu?.tables[id] : undefined;
		type Retour = T extends "colonnes" ? TableColonnesJson : T extends "poignee" ? TablePoigneeJson : TableAleatoireJson;
		return t && t.type === type ? (t as Retour) : null;
	}

	tablesDuType(type: "colonnes" | "poignee" | "aleatoire"): [string, string][] {
		return Object.entries(this.jeu?.tables ?? {})
			.filter(([, t]) => t.type === type)
			.map(([id, t]) => [id, t.nom]);
	}

	combat(id: string): EtatCombat | null {
		const t = this.table(id, "colonnes");
		if (!t) return null;
		const cle = `${this.data.jeu}/${id}`;
		this.data.combats[cle] ??= { colonne: Math.min(Math.max(t.colonneDefaut ?? 0, 0), t.colonnes.length - 1), mod: 0, dernier: null };
		return this.data.combats[cle];
	}

	reglerCombat(id: string, quoi: "colonne" | "mod", delta: number | "defaut"): void {
		const t = this.table(id, "colonnes");
		const c = this.combat(id);
		if (!t || !c) return;
		if (quoi === "colonne") {
			const cible = delta === "defaut" ? (t.colonneDefaut ?? 0) : c.colonne + delta;
			c.colonne = Math.min(Math.max(cible, 0), t.colonnes.length - 1);
		} else {
			const min = t.modificateur?.min ?? -6;
			const max = t.modificateur?.max ?? 6;
			c.mod = delta === "defaut" ? 0 : Math.min(Math.max(c.mod + delta, min), max);
		}
		c.dernier = null;
		this.notifier();
	}

	lancerCombat(id: string): ResultatCombat | null {
		const t = this.table(id, "colonnes");
		const c = this.combat(id);
		if (!t || !c) return null;
		const l = lancer(t.de);
		const total = l.total + c.mod;
		const ligne = chercherPlage(Object.keys(t.lignes), total);
		const code = t.lignes[ligne][c.colonne];
		const def = t.resultats?.[code];
		const texte = typeof def === "string" ? def : (def?.texte ?? code);
		const couleur = typeof def === "object" ? (def.couleur ?? null) : null;
		c.dernier = { colonne: t.colonnes[c.colonne], jet: l.total, des: l.des.map((x) => x.valeur), mod: c.mod, total, code, texte, couleur };
		const detailMod = c.mod ? ` ${signe(c.mod)} = ${total}` : "";
		this.noter(`${t.nom} à ${t.colonnes[c.colonne]} : jet ${l.total}${detailMod} → **${code}**${texte !== code ? ` (${texte})` : ""}`);
		this.notifier();
		return c.dernier;
	}

	/* ── Poignées de dés (batailles) ── */

	cleCamp(id: string, camp: string | undefined): string {
		const t = this.table(id, "poignee");
		return camp?.trim() || t?.camps?.[0] || "Camp";
	}

	poignee(id: string, camp: string | undefined): EtatPoignee | null {
		const t = this.table(id, "poignee");
		if (!t) return null;
		const cle = `${this.data.jeu}/${id}/${this.cleCamp(id, camp)}`;
		this.data.poignees[cle] ??= { des: t.des ?? 6, seuil: t.seuil ?? 4, profil: null, dernier: null };
		return this.data.poignees[cle];
	}

	reglerPoignee(id: string, camp: string | undefined, quoi: "des" | "seuil", delta: number | "defaut"): void {
		const t = this.table(id, "poignee");
		const p = this.poignee(id, camp);
		if (!t || !p) return;
		const faces = t.faces ?? 6;
		if (quoi === "des") {
			p.des = delta === "defaut" ? (t.des ?? 6) : Math.min(Math.max(p.des + delta, 1), t.desMax ?? 40);
		} else if (t.profils && t.profils.length > 0) {
			// Avec des profils (races, types d'unités…), on fait défiler les profils.
			if (delta === "defaut") p.profil = null;
			else {
				const n = t.profils.length;
				const actuel = p.profil ?? (delta > 0 ? -1 : n);
				const suivant = actuel + Math.sign(delta);
				p.profil = suivant < 0 || suivant >= n ? null : suivant;
			}
			p.seuil = p.profil === null ? (t.seuil ?? 4) : t.profils[p.profil].seuil;
		} else {
			p.seuil = delta === "defaut" ? (t.seuil ?? 4) : Math.min(Math.max(p.seuil + delta, 1), faces);
		}
		p.dernier = null;
		this.notifier();
	}

	nomProfil(id: string, p: EtatPoignee): string | null {
		const t = this.table(id, "poignee");
		return p.profil !== null && t?.profils?.[p.profil] ? t.profils[p.profil].nom : null;
	}

	lancerPoignee(id: string, camp: string | undefined): ResultatPoignee | null {
		const t = this.table(id, "poignee");
		const p = this.poignee(id, camp);
		if (!t || !p) return null;
		const nomCamp = this.cleCamp(id, camp);
		const b = this.data.bataille;
		// Un camp qui relance dans le même round ouvre le round suivant.
		if (b.lances.includes(`${id}/${nomCamp}`)) {
			b.round++;
			b.lances = [];
		}
		b.lances.push(`${id}/${nomCamp}`);
		const faces = t.faces ?? 6;
		const valeurs = lancerPoigneeDes(p.des, faces).sort((a, b2) => b2 - a);
		const touches = valeurs.filter((v) => v >= p.seuil).length;
		const critiques = t.critique ? valeurs.filter((v) => v >= t.critique!).length : 0;
		p.dernier = { valeurs, touches, critiques, round: b.round, seuil: p.seuil, faces };
		const profil = this.nomProfil(id, p);
		const crit = t.critique && critiques ? `, dont ${critiques} critique${critiques > 1 ? "s" : ""}` : "";
		this.noter(
			`${t.nom}, round ${b.round} — ${nomCamp}${profil ? ` (${profil})` : ""} : ${p.des}d${faces} à ${p.seuil}+ → **${touches} touche${touches > 1 ? "s" : ""}**${crit} [${valeurs.join(" ")}]`
		);
		this.notifier();
		return p.dernier;
	}

	nouvelleBataille(id: string): void {
		const t = this.table(id, "poignee");
		if (!t) return;
		this.data.bataille = { round: 1, lances: [] };
		for (const [cle, p] of Object.entries(this.data.poignees)) if (cle.startsWith(`${this.data.jeu}/${id}/`)) p.dernier = null;
		this.noter(`— Nouvelle bataille (${t.nom}) —`);
		this.notifier();
	}

	/* ── Tables aléatoires ── */

	tirer(id: string): ResultatAleatoire | null {
		const t = this.table(id, "aleatoire");
		if (!t) return null;
		let entree: string | { texte: string; court?: string };
		let detail: string;
		if (Array.isArray(t.entrees)) {
			const i = randomInt(0, t.entrees.length);
			entree = t.entrees[i];
			detail = `tirage ${i + 1}/${t.entrees.length}`;
		} else {
			const l = lancer(t.de ?? "1d6");
			entree = t.entrees[chercherPlage(Object.keys(t.entrees), l.total)];
			detail = `${t.de} = ${l.total}`;
		}
		const texte = typeof entree === "string" ? entree : entree.texte;
		const court = typeof entree === "string" ? entree : (entree.court ?? entree.texte);
		const r = { texte, court, detail };
		this.data.aleatoires[`${this.data.jeu}/${id}`] = r;
		this.noter(`${t.nom} (${detail}) : ${texte}`);
		this.notifier();
		return r;
	}

	dernierTirage(id: string): ResultatAleatoire | null {
		return this.data.aleatoires[`${this.data.jeu}/${id}`] ?? null;
	}

	effacerTirage(id: string): void {
		delete this.data.aleatoires[`${this.data.jeu}/${id}`];
		this.notifier();
	}

	/* ── Dés libres ── */

	lancerDes(expression: string, libelle?: string): Lancer {
		const l = lancer(expression);
		const valeurs = l.des.map((x) => Math.abs(x.valeur));
		const detail = l.des.length > 1 || l.modificateur ? ` [${valeurs.join(" ")}${l.modificateur ? ` ${signe(l.modificateur)}` : ""}]` : "";
		this.noter(`${libelle ? `${libelle} : ` : ""}${expression} → **${l.total}**${detail}`);
		this.notifier();
		return l;
	}
}
