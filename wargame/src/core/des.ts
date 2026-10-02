import { randomInt } from "node:crypto";

/** Un dé lancé : nombre de faces et valeur obtenue. */
export interface DeLance {
	faces: number;
	valeur: number;
}

/** Résultat d'un lancer d'expression (ex. « 2d6+1 »). */
export interface Lancer {
	expression: string;
	des: DeLance[];
	modificateur: number;
	total: number;
}

interface Terme {
	signe: 1 | -1;
	nombre: number;
	faces: number | null; // null = constante
}

const MAX_DES = 100;
const MAX_FACES = 1000;

/**
 * Analyse une expression de dés : « 2d6 », « d20 », « 3d6-2 », « 1d6+1d4+1 », « d% ».
 * Lève une erreur lisible si l'expression est invalide.
 */
export function analyser(expression: string): Terme[] {
	// Les espaces sont tolérés autour de + et −, pas au milieu d'un terme (« 2d6 3 » est refusé).
	const texte = expression.trim().toLowerCase().replace(/\s*([+-])\s*/g, "$1").replace(/d%/g, "d100");
	if (!texte) throw new Error("Expression de dés vide");
	if (/\s/.test(texte)) throw new Error(`Expression de dés invalide : « ${expression} »`);
	const termes: Terme[] = [];
	const motif = /([+-]?)(\d*d\d+|\d+)/gy;
	let correspondance: RegExpExecArray | null;
	let position = 0;
	while (position < texte.length) {
		motif.lastIndex = position;
		correspondance = motif.exec(texte);
		if (!correspondance || (termes.length > 0 && correspondance[1] === "")) {
			throw new Error(`Expression de dés invalide : « ${expression} »`);
		}
		const signe = correspondance[1] === "-" ? -1 : 1;
		const corps = correspondance[2];
		if (corps.includes("d")) {
			const [n, f] = corps.split("d");
			const nombre = n === "" ? 1 : Number(n);
			const faces = Number(f);
			if (nombre < 1 || nombre > MAX_DES || faces < 2 || faces > MAX_FACES) {
				throw new Error(`Dés hors limites dans « ${expression} »`);
			}
			termes.push({ signe, nombre, faces });
		} else {
			termes.push({ signe, nombre: Number(corps), faces: null });
		}
		position = motif.lastIndex;
	}
	return termes;
}

/** Lance un dé à `faces` faces (aléatoire cryptographique). */
export function d(faces: number): number {
	return randomInt(1, faces + 1);
}

/** Lance une expression de dés complète. */
export function lancer(expression: string): Lancer {
	const termes = analyser(expression);
	const des: DeLance[] = [];
	let total = 0;
	let modificateur = 0;
	for (const terme of termes) {
		if (terme.faces === null) {
			modificateur += terme.signe * terme.nombre;
			total += terme.signe * terme.nombre;
			continue;
		}
		for (let i = 0; i < terme.nombre; i++) {
			const valeur = d(terme.faces);
			des.push({ faces: terme.faces, valeur: terme.signe * valeur });
			total += terme.signe * valeur;
		}
	}
	return { expression, des, modificateur, total };
}

/** Lance une poignée de `nombre` dés à `faces` faces. */
export function poignee(nombre: number, faces: number): number[] {
	return Array.from({ length: nombre }, () => d(faces));
}

/** Plage de valeurs d'une ligne de table : « 3 », « 2-4 », « 7+ », « 1- » (1 ou moins). */
export interface Plage {
	min: number;
	max: number;
	cle: string;
}

export function lirePlage(cle: string): Plage {
	const texte = cle.trim().replace(/[–—]/g, "-").replace(/≤\s*(-?\d+)/, "$1-").replace(/≥\s*(-?\d+)/, "$1+");
	let m: RegExpMatchArray | null;
	if ((m = texte.match(/^(-?\d+)$/))) return { min: +m[1], max: +m[1], cle };
	if ((m = texte.match(/^(-?\d+)\s*-\s*(-?\d+)$/))) return { min: Math.min(+m[1], +m[2]), max: Math.max(+m[1], +m[2]), cle };
	if ((m = texte.match(/^(-?\d+)\s*\+$/))) return { min: +m[1], max: Infinity, cle };
	if ((m = texte.match(/^(-?\d+)\s*-$/))) return { min: -Infinity, max: +m[1], cle };
	throw new Error(`Plage de dé illisible : « ${cle} » (attendu « 3 », « 2-4 », « 7+ » ou « 1- »)`);
}

/**
 * Trouve la clé correspondant à `valeur` parmi les plages. Si aucune ne correspond
 * (jet modifié hors table), retient la plage la plus proche.
 */
export function chercherPlage(cles: string[], valeur: number): string {
	const plages = cles.map(lirePlage);
	const exacte = plages.find((p) => valeur >= p.min && valeur <= p.max);
	if (exacte) return exacte.cle;
	let meilleure = plages[0];
	let ecart = Infinity;
	for (const p of plages) {
		const e = valeur < p.min ? p.min - valeur : valeur - p.max;
		if (e < ecart) {
			ecart = e;
			meilleure = p;
		}
	}
	return meilleure.cle;
}

/** Valeur maximale d'une expression (sert à dessiner les dés). */
export function facesDominantes(lancer: Lancer): number | null {
	const faces = new Set(lancer.des.map((de) => de.faces));
	return faces.size === 1 ? [...faces][0] : null;
}
