import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { analyser, lirePlage } from "./des.js";

/* ───────────── Format des fichiers de jeu (tel qu'écrit dans le JSON) ───────────── */

export interface PhaseJson {
	nom: string;
	abrege?: string;
	rappels?: string[];
}

export interface CampJson {
	nom: string;
	couleur?: string;
}

export interface TableColonnesJson {
	type: "colonnes";
	nom: string;
	de: string;
	colonnes: string[];
	colonneDefaut?: number;
	modificateur?: { min?: number; max?: number };
	lignes: Record<string, string[]>;
	resultats?: Record<string, string | { texte: string; couleur?: string }>;
}

export interface TablePoigneeJson {
	type: "poignee";
	nom: string;
	faces?: number;
	des?: number;
	desMax?: number;
	seuil?: number;
	critique?: number;
	profils?: { nom: string; seuil: number }[];
	camps?: string[];
}

export interface TableAleatoireJson {
	type: "aleatoire";
	nom: string;
	de?: string;
	entrees: Record<string, string | { texte: string; court?: string }> | (string | { texte: string; court?: string })[];
}

export type TableJson = TableColonnesJson | TablePoigneeJson | TableAleatoireJson;

export interface JeuJson {
	id: string;
	nom: string;
	abrege?: string;
	tours?: number;
	camps?: (string | CampJson)[];
	ordreCamps?: "fixe" | "aleatoire";
	sequence: (string | PhaseJson)[] | { debut?: (string | PhaseJson)[]; parCamp?: (string | PhaseJson)[]; fin?: (string | PhaseJson)[] };
	tables?: Record<string, TableJson>;
	des?: string[];
}

/* ───────────── Forme normalisée utilisée par le plugin ───────────── */

export interface Phase {
	nom: string;
	abrege: string;
	rappels: string[];
	parCamp: boolean;
}

export interface Camp {
	nom: string;
	couleur: string;
}

export interface Jeu {
	id: string;
	nom: string;
	abrege: string;
	tours: number | null;
	camps: Camp[];
	ordreCamps: "fixe" | "aleatoire";
	debut: Phase[];
	parCamp: Phase[];
	fin: Phase[];
	tables: Record<string, TableJson>;
	des: string[];
	fichier: string;
	integre: boolean;
}

/** Une étape de la séquence dépliée pour un tour donné. */
export interface Etape extends Phase {
	camp: Camp | null;
}

const COULEURS_CAMPS = ["#B5473A", "#3F6FA8", "#C9A13B", "#4E8A5B", "#8A5AA6", "#C7773A"];

export class ErreurJeu extends Error {
	constructor(
		public fichier: string,
		message: string
	) {
		super(message);
	}
}

/* ───────────── Validation ───────────── */

function phase(source: string | PhaseJson, parCamp: boolean, ou: string): Phase {
	if (typeof source === "string") source = { nom: source };
	if (!source || typeof source.nom !== "string" || !source.nom.trim()) throw new Error(`${ou} : chaque phase doit avoir un « nom »`);
	if (source.rappels !== undefined && !Array.isArray(source.rappels)) throw new Error(`${ou} (« ${source.nom} ») : « rappels » doit être une liste de textes`);
	return {
		nom: source.nom.trim(),
		abrege: (source.abrege ?? source.nom).trim(),
		rappels: (source.rappels ?? []).map(String),
		parCamp
	};
}

function verifierTable(id: string, t: TableJson): void {
	const ou = `Table « ${id} »`;
	if (!t || typeof t !== "object") throw new Error(`${ou} : définition manquante`);
	if (!t.nom) throw new Error(`${ou} : il manque « nom »`);
	switch (t.type) {
		case "colonnes": {
			analyser(t.de ?? "");
			if (!Array.isArray(t.colonnes) || t.colonnes.length === 0) throw new Error(`${ou} : « colonnes » doit être une liste non vide`);
			const cles = Object.keys(t.lignes ?? {});
			if (cles.length === 0) throw new Error(`${ou} : « lignes » est vide`);
			for (const cle of cles) {
				lirePlage(cle);
				const ligne = t.lignes[cle];
				if (!Array.isArray(ligne) || ligne.length !== t.colonnes.length) {
					throw new Error(`${ou}, ligne « ${cle} » : ${t.colonnes.length} résultats attendus (un par colonne), ${Array.isArray(ligne) ? ligne.length : 0} trouvés`);
				}
			}
			break;
		}
		case "poignee": {
			if (t.faces !== undefined && (t.faces < 2 || t.faces > 100)) throw new Error(`${ou} : « faces » doit être entre 2 et 100`);
			if (t.profils !== undefined && !Array.isArray(t.profils)) throw new Error(`${ou} : « profils » doit être une liste`);
			break;
		}
		case "aleatoire": {
			if (Array.isArray(t.entrees)) {
				if (t.entrees.length === 0) throw new Error(`${ou} : « entrees » est vide`);
			} else {
				analyser(t.de ?? "");
				const cles = Object.keys(t.entrees ?? {});
				if (cles.length === 0) throw new Error(`${ou} : « entrees » est vide`);
				cles.forEach(lirePlage);
			}
			break;
		}
		default:
			throw new Error(`${ou} : type inconnu « ${(t as { type?: string }).type} » (attendu « colonnes », « poignee » ou « aleatoire »)`);
	}
}

export function normaliser(source: JeuJson, fichier: string, integre: boolean): Jeu {
	if (!source || typeof source !== "object") throw new Error("Le fichier ne contient pas d'objet JSON");
	if (!source.id || !/^[a-z0-9][a-z0-9-_]*$/i.test(source.id)) throw new Error("« id » manquant ou invalide (lettres, chiffres, tirets)");
	if (!source.nom) throw new Error("« nom » manquant");
	if (!source.sequence) throw new Error("« sequence » manquante");

	const camps: Camp[] = (source.camps ?? []).map((c, i) => {
		const camp = typeof c === "string" ? { nom: c } : c;
		if (!camp?.nom) throw new Error(`Camp n° ${i + 1} sans nom`);
		return { nom: camp.nom, couleur: camp.couleur ?? COULEURS_CAMPS[i % COULEURS_CAMPS.length] };
	});

	let debut: Phase[] = [];
	let parCamp: Phase[] = [];
	let fin: Phase[] = [];
	if (Array.isArray(source.sequence)) {
		debut = source.sequence.map((p, i) => phase(p, false, `Phase n° ${i + 1}`));
	} else {
		debut = (source.sequence.debut ?? []).map((p, i) => phase(p, false, `Séquence « debut », phase n° ${i + 1}`));
		parCamp = (source.sequence.parCamp ?? []).map((p, i) => phase(p, true, `Séquence « parCamp », phase n° ${i + 1}`));
		fin = (source.sequence.fin ?? []).map((p, i) => phase(p, false, `Séquence « fin », phase n° ${i + 1}`));
		if (parCamp.length > 0 && camps.length === 0) throw new Error("La séquence contient « parCamp » mais aucun « camps » n'est défini");
	}
	if (debut.length + parCamp.length + fin.length === 0) throw new Error("La séquence ne contient aucune phase");

	const tables = source.tables ?? {};
	for (const [id, t] of Object.entries(tables)) verifierTable(id, t);
	for (const expr of source.des ?? []) analyser(expr);

	return {
		id: source.id,
		nom: source.nom,
		abrege: source.abrege ?? source.nom,
		tours: typeof source.tours === "number" && source.tours > 0 ? source.tours : null,
		camps,
		ordreCamps: source.ordreCamps === "aleatoire" ? "aleatoire" : "fixe",
		debut,
		parCamp,
		fin,
		tables,
		des: source.des ?? [],
		fichier,
		integre
	};
}

/** Déplie la séquence d'un tour selon l'ordre des camps de ce tour. */
export function deplier(jeu: Jeu, ordre: string[]): Etape[] {
	const camps = ordre.map((nom) => jeu.camps.find((c) => c.nom === nom)).filter((c): c is Camp => !!c);
	const etapes: Etape[] = jeu.debut.map((p) => ({ ...p, camp: null }));
	for (const camp of camps) for (const p of jeu.parCamp) etapes.push({ ...p, camp });
	for (const p of jeu.fin) etapes.push({ ...p, camp: null });
	return etapes;
}

/** Nombre d'étapes d'un tour (indépendant de l'ordre). */
export function longueurTour(jeu: Jeu): number {
	return jeu.debut.length + jeu.parCamp.length * jeu.camps.length + jeu.fin.length;
}

/* ───────────── Chargement ───────────── */

export interface Catalogue {
	jeux: Map<string, Jeu>;
	erreurs: { fichier: string; message: string }[];
}

async function lireDossier(dossier: string, integre: boolean, catalogue: Catalogue): Promise<void> {
	let fichiers: string[];
	try {
		fichiers = await readdir(dossier);
	} catch {
		return;
	}
	for (const nom of fichiers.sort()) {
		if (!nom.toLowerCase().endsWith(".json") || nom.startsWith("_") || nom.startsWith(".")) continue;
		const chemin = path.join(dossier, nom);
		try {
			const texte = await readFile(chemin, "utf8");
			let brut: JeuJson;
			try {
				brut = JSON.parse(texte.replace(/^\uFEFF/, ""));
			} catch (e) {
				throw new Error(`JSON mal formé : ${(e as Error).message}`);
			}
			const jeu = normaliser(brut, chemin, integre);
			// Les jeux du dossier personnel remplacent les jeux intégrés de même id.
			if (!integre || !catalogue.jeux.has(jeu.id)) catalogue.jeux.set(jeu.id, jeu);
		} catch (e) {
			catalogue.erreurs.push({ fichier: nom, message: (e as Error).message });
		}
	}
}

export async function chargerJeux(dossierPerso: string, dossierIntegre: string): Promise<Catalogue> {
	const catalogue: Catalogue = { jeux: new Map(), erreurs: [] };
	await lireDossier(dossierPerso, false, catalogue);
	await lireDossier(dossierIntegre, true, catalogue);
	return catalogue;
}
