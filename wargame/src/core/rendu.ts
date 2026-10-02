/*
 * Rendu des touches et des écrans tactiles en SVG.
 * Esthétique : un pion de wargame posé sur une carte d'état-major de nuit.
 * Une seule famille de caractères (Arial, présente sur macOS et Windows), un accent laiton,
 * et des dés dessinés avec leurs points : c'est l'élément qu'on retient.
 */

export const C = {
	ardoise: "#17201C", // séquence, partie, rappels
	sang: "#2A1916", // combat, bataille, réglages
	encre: "#1A1D2A", // tables aléatoires, dés
	ivoire: "#ECE5CF",
	laiton: "#D3A93F",
	terne: "#85918A",
	filet: "#36443C",
	sombre: "#121815"
} as const;

const POLICE = "Arial, Helvetica, sans-serif";

export function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ───────────── Texte ───────────── */

const LARGEUR_CAR = 0.6; // largeur moyenne d'un caractère d'Arial gras, en em

function couper(texte: string, maxCar: number): { lignes: string[]; coupe: boolean } {
	const lignes: string[] = [];
	let ligne = "";
	let coupe = false;
	for (let mot of texte.split(/[ \t\n]+/).filter(Boolean)) {
		while (mot.length > maxCar) {
			coupe = true;
			if (ligne) {
				lignes.push(ligne);
				ligne = "";
			}
			lignes.push(mot.slice(0, maxCar - 1) + "-");
			mot = mot.slice(maxCar - 1);
		}
		if (!ligne) ligne = mot;
		else if (ligne.length + 1 + mot.length <= maxCar) ligne += " " + mot;
		else {
			lignes.push(ligne);
			ligne = mot;
		}
	}
	if (ligne) lignes.push(ligne);
	return { lignes, coupe };
}

/**
 * Choisit la plus grande taille qui fait tenir le texte dans la boîte sans couper de mot ;
 * coupe les mots, puis tronque, seulement en dernier recours.
 */
export function ajuster(texte: string, largeur: number, maxLignes: number, tailleMax: number, tailleMin: number): { lignes: string[]; taille: number } {
	// Typographie française : espace insécable avant « : ; ! ? », jamais de « : » orphelin en début de ligne.
	texte = texte.replace(/ ([:;!?»])/g, "\u00A0$1").replace(/(«) /g, "$1\u00A0");
	const maxCar = (taille: number) => Math.max(1, Math.floor(largeur / (taille * LARGEUR_CAR)));
	for (let taille = tailleMax; taille >= tailleMin; taille--) {
		const { lignes, coupe } = couper(texte, maxCar(taille));
		if (lignes.length <= maxLignes && !coupe) return { lignes, taille };
	}
	const { lignes } = couper(texte, maxCar(tailleMin));
	if (lignes.length <= maxLignes) return { lignes, taille: tailleMin };
	const gardees = lignes.slice(0, maxLignes);
	const derniere = gardees[maxLignes - 1];
	gardees[maxLignes - 1] = (derniere.length >= maxCar(tailleMin) ? derniere.slice(0, maxCar(tailleMin) - 1) : derniere) + "…";
	return { lignes: gardees, taille: tailleMin };
}

interface OptionsTexte {
	taille: number;
	couleur?: string;
	gras?: boolean;
	ancre?: "start" | "middle" | "end";
	opacite?: number;
}

export function texte(x: number, y: number, contenu: string, o: OptionsTexte): string {
	return `<text x="${x}" y="${y}" font-family="${POLICE}" font-size="${o.taille}" font-weight="${o.gras === false ? "normal" : "bold"}" fill="${o.couleur ?? C.ivoire}" text-anchor="${o.ancre ?? "start"}"${o.opacite !== undefined ? ` fill-opacity="${o.opacite}"` : ""}>${esc(contenu)}</text>`;
}

/** Bloc de texte ajusté et centré verticalement autour de `yCentre`. */
function bloc(x: number, yCentre: number, contenu: string, largeur: number, maxLignes: number, tailleMax: number, tailleMin: number, o: Omit<OptionsTexte, "taille"> = {}): string {
	const { lignes, taille } = ajuster(contenu, largeur, maxLignes, tailleMax, tailleMin);
	const interligne = taille * 1.12;
	const hauteur = interligne * (lignes.length - 1);
	const premier = yCentre - hauteur / 2 + taille * 0.36;
	return lignes.map((l, i) => texte(x, Math.round(premier + i * interligne), l, { ...o, taille })).join("");
}

/** Texte sur une ligne, réduit si nécessaire pour tenir dans `largeur`. */
function ligne(x: number, y: number, contenu: string, largeur: number, tailleMax: number, o: Omit<OptionsTexte, "taille"> = {}): string {
	const { lignes, taille } = ajuster(contenu, largeur, 1, tailleMax, Math.min(10, tailleMax));
	return texte(x, y, lignes[0] ?? "", { ...o, taille });
}

/* ───────────── Dés ───────────── */

const PIPS: Record<number, [number, number][]> = {
	1: [[0.5, 0.5]],
	2: [[0.27, 0.27], [0.73, 0.73]],
	3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
	4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
	5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
	6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]]
};

type StyleDe = "plein" | "creux" | "critique";

export function de(x: number, y: number, s: number, valeur: number, faces: number, style: StyleDe = "plein"): string {
	const fond = style === "critique" ? C.laiton : style === "plein" ? C.ivoire : "none";
	const trait = style === "creux" ? C.terne : "none";
	const encre = style === "creux" ? C.terne : C.sombre;
	const r = Math.max(2, s * 0.18);
	let svg = `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" rx="${r.toFixed(1)}" fill="${fond}" stroke="${trait}" stroke-width="${style === "creux" ? 1.5 : 0}"/>`;
	if (faces === 6 && PIPS[valeur]) {
		const rp = Math.max(1.2, s * 0.09);
		for (const [px, py] of PIPS[valeur]) svg += `<circle cx="${(x + px * s).toFixed(1)}" cy="${(y + py * s).toFixed(1)}" r="${rp.toFixed(1)}" fill="${encre}"/>`;
	} else {
		svg += texte(x + s / 2, y + s * 0.68, String(valeur), { taille: Math.round(s * (valeur >= 10 ? 0.48 : 0.6)), couleur: encre, ancre: "middle" });
	}
	return svg;
}

/** Répartit des dés dans une boîte en maximisant leur taille. */
export function grilleDes(valeurs: number[], faces: number, boite: { x: number; y: number; l: number; h: number }, style: (v: number) => StyleDe, tailleMax = 30): string {
	const n = valeurs.length;
	if (n === 0) return "";
	let meilleur = { s: 0, cols: 1, rangs: 1 };
	for (let cols = 1; cols <= n; cols++) {
		const rangs = Math.ceil(n / cols);
		const s = Math.min(boite.l / (cols + (cols - 1) * 0.2), boite.h / (rangs + (rangs - 1) * 0.2), tailleMax);
		if (s > meilleur.s) meilleur = { s, cols, rangs };
	}
	const { s, cols, rangs } = meilleur;
	if (s < 16) {
		// Trop de dés pour qu'on les lise : un dé par face, avec le nombre obtenu dessous.
		const comptes = new Map<number, number>();
		for (const v of valeurs) comptes.set(v, (comptes.get(v) ?? 0) + 1);
		const faces_ = [...comptes.keys()].sort((a, b) => b - a);
		if (faces > 6) {
			const resume = faces_.map((v) => `${comptes.get(v)}×${v}`).join("  ");
			return bloc(boite.x + boite.l / 2, boite.y + boite.h / 2, resume, boite.l, 3, 16, 10, { ancre: "middle", couleur: C.ivoire });
		}
		const k = faces_.length;
		const taille = Math.min(24, (boite.l - (k - 1) * 4) / k, boite.h - 18);
		const pas = taille + 4;
		const x0 = boite.x + (boite.l - (k * taille + (k - 1) * 4)) / 2;
		const yDe = boite.y + (boite.h - taille - 17) / 2;
		return faces_
			.map((v, i) => {
				const x = x0 + i * pas;
				const st = style(v);
				return de(x, yDe, taille, v, faces, st) + texte(x + taille / 2, yDe + taille + 15, `×${comptes.get(v)}`, { taille: 13, ancre: "middle", couleur: st === "creux" ? C.terne : C.ivoire });
			})
			.join("");
	}
	const g = s * 0.2;
	const largeurTotale = cols * s + (cols - 1) * g;
	const hauteurTotale = rangs * s + (rangs - 1) * g;
	const x0 = boite.x + (boite.l - largeurTotale) / 2;
	const y0 = boite.y + (boite.h - hauteurTotale) / 2;
	return valeurs
		.map((v, i) => {
			const rang = Math.floor(i / cols);
			const dansRang = Math.min(cols, n - rang * cols);
			const decalage = ((cols - dansRang) * (s + g)) / 2; // centre le dernier rang
			return de(x0 + decalage + (i % cols) * (s + g), y0 + rang * (s + g), s, v, faces, style(v));
		})
		.join("");
}

/* ───────────── Cadres ───────────── */

function cadre(l: number, h: number, fond: string, contenu: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}" viewBox="0 0 ${l} ${h}"><rect width="${l}" height="${h}" fill="${fond}"/>${contenu}</svg>`;
}

const touche = (fond: string, contenu: string) => cadre(144, 144, fond, contenu);
const ecran = (fond: string, contenu: string) => cadre(200, 100, fond, contenu);

export function versDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function contraste(hex: string): string {
	const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	if (!m) return C.ivoire;
	const [r, g, b] = m.slice(1).map((v) => parseInt(v, 16));
	return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? C.sombre : C.ivoire;
}

/** Barre de progression en segments : un segment par étape du tour. */
function progression(x: number, y: number, l: number, h: number, index: number, total: number): string {
	if (total <= 1) return "";
	if (total > 28) {
		const p = (index + 1) / total;
		return `<rect x="${x}" y="${y}" width="${l}" height="${h}" rx="${h / 2}" fill="${C.filet}"/><rect x="${x}" y="${y}" width="${(l * p).toFixed(1)}" height="${h}" rx="${h / 2}" fill="${C.laiton}"/>`;
	}
	const g = total > 14 ? 2 : 3;
	const s = (l - (total - 1) * g) / total;
	let svg = "";
	for (let i = 0; i < total; i++) {
		const couleur = i === index ? C.laiton : i < index ? C.terne : C.filet;
		svg += `<rect x="${(x + i * (s + g)).toFixed(1)}" y="${y}" width="${s.toFixed(1)}" height="${h}" rx="1" fill="${couleur}"/>`;
	}
	return svg;
}

function coche(cx: number, cy: number, s: number, couleur: string): string {
	return `<path d="M ${cx - s * 0.5} ${cy} L ${cx - s * 0.15} ${cy + s * 0.35} L ${cx + s * 0.55} ${cy - s * 0.4}" fill="none" stroke="${couleur}" stroke-width="${s * 0.16}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/* ───────────── Touches ───────────── */

export function message(titre: string, detail: string, fond: string = C.ardoise): string {
	return touche(fond, bloc(72, 62, titre, 124, 2, 24, 14, { ancre: "middle", couleur: C.laiton }) + bloc(72, 110, detail, 126, 3, 15, 11, { ancre: "middle", couleur: C.terne, gras: false }));
}

export interface InfoPhase {
	tour: number;
	tours: number | null;
	nom: string;
	camp: { nom: string; couleur: string } | null;
	index: number;
	total: number;
	depasse: boolean;
}

export function touchePhase(p: InfoPhase): string {
	const tour = `<text x="12" y="30" font-family="${POLICE}" font-size="22" font-weight="bold" fill="${p.depasse ? "#D9705A" : C.laiton}">Tour ${p.tour}${p.tours ? `<tspan fill="${C.terne}" font-size="16"> /${p.tours}</tspan>` : ""}</text>`;
	const yNom = p.camp ? 70 : 76;
	let svg = tour + bloc(72, yNom, p.nom, 126, 2, 32, 15, { ancre: "middle" });
	svg += progression(12, p.camp ? 102 : 116, 120, 5, p.index, p.total);
	if (p.camp) {
		svg += `<rect x="0" y="116" width="144" height="28" fill="${p.camp.couleur}"/>`;
		svg += ligne(72, 136, p.camp.nom, 128, 17, { ancre: "middle", couleur: contraste(p.camp.couleur) });
	}
	return touche(C.ardoise, svg);
}

export function touchePartie(nom: string, tour: number, entrees: number): string {
	let svg = bloc(72, 34, nom, 126, 2, 19, 12, { ancre: "middle", couleur: C.laiton });
	svg += texte(72, 92, `Tour ${tour}`, { taille: 30, ancre: "middle" });
	svg += `<rect x="40" y="108" width="64" height="1" fill="${C.filet}"/>`;
	svg += texte(72, 130, `${entrees} entrée${entrees > 1 ? "s" : ""}`, { taille: 15, ancre: "middle", couleur: C.terne, gras: false });
	return touche(C.ardoise, svg);
}

export function toucheRappel(phase: string, index: number, total: number, contenu: string | null): string {
	if (total === 0) return touche(C.ardoise, ligne(72, 26, phase, 124, 15, { ancre: "middle", couleur: C.terne }) + texte(72, 88, "Aucun rappel", { taille: 17, ancre: "middle", couleur: C.terne }));
	if (contenu === null) {
		return touche(C.ardoise, ligne(72, 26, phase, 124, 15, { ancre: "middle", couleur: C.terne }) + coche(72, 74, 52, C.laiton) + texte(72, 128, "Tout est vu", { taille: 16, ancre: "middle", couleur: C.ivoire }));
	}
	let svg = texte(12, 26, `Rappel ${index + 1}/${total}`, { taille: 15, couleur: C.laiton });
	svg += bloc(72, 84, contenu, 126, 4, 22, 12, { ancre: "middle" });
	return touche(C.ardoise, svg);
}

export interface InfoCombat {
	nom: string;
	colonne: string;
	mod: number;
	dernier: { code: string; texte: string; couleur: string | null; jet: number; total: number; mod: number } | null;
}

const signe = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "");

export function toucheCombat(c: InfoCombat): string {
	let svg = ligne(12, 24, c.nom, 120, 15, { couleur: C.terne });
	if (!c.dernier) {
		svg += texte(72, 84, c.colonne, { taille: c.colonne.length > 4 ? 32 : 42, ancre: "middle", couleur: C.laiton });
		if (c.mod) svg += texte(72, 112, `mod ${signe(c.mod)}`, { taille: 18, ancre: "middle" });
		svg += texte(72, 136, "Appui : lancer", { taille: 13, ancre: "middle", couleur: C.terne, gras: false });
		return touche(C.sang, svg);
	}
	const d = c.dernier;
	svg += texte(12, 52, c.colonne, { taille: 22, couleur: C.laiton });
	svg += texte(132, 52, d.mod ? `${d.jet}${signe(d.mod)}=${d.total}` : `jet ${d.jet}`, { taille: 18, ancre: "end", couleur: C.ivoire });
	const couleur = d.couleur ?? C.ivoire;
	svg += `<rect x="8" y="64" width="128" height="72" rx="8" fill="${couleur}"/>`;
	const encre = contraste(couleur);
	const aTexte = d.texte && d.texte !== d.code;
	svg += ligne(72, aTexte ? 104 : 112, d.code, 116, 38, { ancre: "middle", couleur: encre });
	if (aTexte) svg += ligne(72, 126, d.texte, 116, 13, { ancre: "middle", couleur: encre, gras: false });
	return touche(C.sang, svg);
}

export interface InfoPoignee {
	camp: string;
	profil: string | null;
	des: number;
	seuil: number;
	faces: number;
	critique: number | null;
	dernier: { valeurs: number[]; touches: number; critiques: number; round: number; seuil: number } | null;
}

function styleDe(p: InfoPoignee) {
	return (v: number): StyleDe => (p.critique && v >= p.critique ? "critique" : v >= (p.dernier?.seuil ?? p.seuil) ? "plein" : "creux");
}

export function touchePoignee(p: InfoPoignee): string {
	let svg = ligne(12, 24, p.camp, p.dernier ? 92 : 120, 16);
	const reglage = `${p.profil ? `${p.profil} ` : ""}${p.seuil}+`;
	if (!p.dernier) {
		svg += texte(72, 80, String(p.des), { taille: 46, ancre: "middle", couleur: C.laiton });
		svg += texte(72, 102, `d${p.faces}`, { taille: 15, ancre: "middle", couleur: C.terne });
		svg += ligne(72, 132, `touche à ${reglage}`, 124, 17, { ancre: "middle" });
		return touche(C.sang, svg);
	}
	const d = p.dernier;
	svg += texte(132, 24, `R${d.round}`, { taille: 16, ancre: "end", couleur: C.laiton });
	svg += ligne(12, 46, `${p.des}d${p.faces} à ${reglage}`, 120, 15, { couleur: C.terne });
	svg += grilleDes(d.valeurs, p.faces, { x: 10, y: 54, l: 124, h: 62 }, styleDe(p), 28);
	svg += `<text x="72" y="138" font-family="${POLICE}" font-size="21" font-weight="bold" fill="${C.ivoire}" text-anchor="middle"><tspan fill="${C.laiton}">${d.touches}</tspan> touche${d.touches > 1 ? "s" : ""}</text>`;
	return touche(C.sang, svg);
}

export function toucheAjuster(table: string, libelle: string, sens: 1 | -1, valeur: string): string {
	let svg = ligne(72, 22, table, 128, 13, { ancre: "middle", couleur: C.terne });
	svg += ligne(72, 44, libelle, 128, 17, { ancre: "middle" });
	// Signe dessiné (et non tapé) pour un rendu identique quelle que soit la police.
	svg += `<rect x="50" y="76" width="44" height="9" rx="3" fill="${C.laiton}"/>`;
	if (sens > 0) svg += `<rect x="67.5" y="58.5" width="9" height="44" rx="3" fill="${C.laiton}"/>`;
	svg += ligne(72, 134, valeur, 128, 18, { ancre: "middle", couleur: C.ivoire });
	return touche(C.sang, svg);
}

export function toucheAleatoire(nom: string, dernier: { court: string; detail: string } | null): string {
	if (!dernier) {
		return touche(C.encre, bloc(72, 66, nom, 126, 3, 24, 13, { ancre: "middle", couleur: C.laiton }) + texte(72, 132, "Appui : tirer", { taille: 13, ancre: "middle", couleur: C.terne, gras: false }));
	}
	let svg = ligne(72, 22, nom, 128, 14, { ancre: "middle", couleur: C.laiton });
	svg += bloc(72, 76, dernier.court, 128, 4, 26, 12, { ancre: "middle" });
	svg += ligne(72, 136, dernier.detail, 128, 13, { ancre: "middle", couleur: C.terne, gras: false });
	return touche(C.encre, svg);
}

export function toucheDes(titre: string, resultat: { total: number; valeurs: number[]; faces: number | null } | null): string {
	if (!resultat) {
		return touche(C.encre, grilleDes([5], 6, { x: 52, y: 26, l: 40, h: 40 }, () => "plein") + ligne(72, 100, titre, 124, 26, { ancre: "middle", couleur: C.laiton }) + texte(72, 132, "Appui : lancer", { taille: 13, ancre: "middle", couleur: C.terne, gras: false }));
	}
	let svg = ligne(72, 24, titre, 128, 15, { ancre: "middle", couleur: C.terne });
	svg += texte(72, 84, String(resultat.total), { taille: resultat.total >= 100 ? 44 : 54, ancre: "middle", couleur: C.ivoire });
	if (resultat.faces === 6 && resultat.valeurs.length <= 8) {
		svg += grilleDes(resultat.valeurs, 6, { x: 10, y: 102, l: 124, h: 30 }, () => "plein", 22);
	} else if (resultat.valeurs.length > 1) {
		svg += ligne(72, 126, resultat.valeurs.join(" "), 124, 15, { ancre: "middle", couleur: C.laiton });
	}
	return touche(C.encre, svg);
}

/* ───────────── Écrans tactiles (Stream Deck +) ───────────── */

export function ecranMessage(titre: string, detail: string, fond: string = C.ardoise): string {
	return ecran(fond, ligne(100, 42, titre, 184, 20, { ancre: "middle", couleur: C.laiton }) + bloc(100, 70, detail, 184, 2, 13, 10, { ancre: "middle", couleur: C.terne, gras: false }));
}

export function ecranPhase(p: InfoPhase): string {
	let svg = "";
	if (p.camp) svg += `<rect x="0" y="0" width="6" height="100" fill="${p.camp.couleur}"/>`;
	svg += texte(14, 26, "Tour", { taille: 14, couleur: C.terne, gras: false });
	svg += texte(14, 66, String(p.tour), { taille: 40, couleur: p.depasse ? "#D9705A" : C.laiton });
	if (p.tours) svg += texte(14, 84, `sur ${p.tours}`, { taille: 12, couleur: C.terne, gras: false });
	svg += bloc(134, p.camp ? 38 : 46, p.nom, 124, 2, 24, 12, { ancre: "middle" });
	if (p.camp) svg += ligne(134, 74, p.camp.nom, 124, 14, { ancre: "middle", couleur: C.laiton });
	svg += progression(72, 88, 122, 4, p.index, p.total);
	return ecran(C.ardoise, svg);
}

export function ecranCombat(c: InfoCombat): string {
	let svg = ligne(8, 18, c.nom, 80, 12, { couleur: C.terne });
	svg += texte(44, 60, c.colonne, { taille: c.colonne.length > 4 ? 22 : 30, ancre: "middle", couleur: C.laiton });
	svg += texte(44, 84, c.mod ? `mod ${signe(c.mod)}` : "mod 0", { taille: 14, ancre: "middle", couleur: c.mod ? C.ivoire : C.terne });
	if (!c.dernier) {
		svg += bloc(146, 50, "Tourner : colonne. Appui : lancer.", 100, 3, 13, 10, { ancre: "middle", couleur: C.terne, gras: false });
		return ecran(C.sang, svg);
	}
	const d = c.dernier;
	const couleur = d.couleur ?? C.ivoire;
	svg += `<rect x="92" y="8" width="102" height="84" rx="8" fill="${couleur}"/>`;
	const encre = contraste(couleur);
	svg += ligne(143, 48, d.code, 94, 30, { ancre: "middle", couleur: encre });
	if (d.texte !== d.code) svg += bloc(143, 68, d.texte, 94, 1, 12, 9, { ancre: "middle", couleur: encre, gras: false });
	svg += texte(143, 86, d.mod ? `${d.jet}${signe(d.mod)}=${d.total}` : `jet ${d.jet}`, { taille: 11, ancre: "middle", couleur: encre, gras: false });
	return ecran(C.sang, svg);
}

export function ecranPoignee(p: InfoPoignee): string {
	const reglage = `${p.des}d${p.faces} à ${p.profil ? `${p.profil} ` : ""}${p.seuil}+`;
	let svg = ligne(8, 18, p.camp, 90, 14);
	svg += ligne(192, 18, reglage, 96, 13, { ancre: "end", couleur: C.laiton });
	if (!p.dernier) {
		svg += bloc(100, 62, "Tourner : nombre de dés. Appuyé + tourner : seuil. Appui : lancer.", 184, 3, 13, 10, { ancre: "middle", couleur: C.terne, gras: false });
		return ecran(C.sang, svg);
	}
	const d = p.dernier;
	svg += grilleDes(d.valeurs, p.faces, { x: 6, y: 26, l: 188, h: 50 }, styleDe(p), 24);
	svg += `<text x="100" y="94" font-family="${POLICE}" font-size="15" font-weight="bold" fill="${C.ivoire}" text-anchor="middle">Round ${d.round} : <tspan fill="${C.laiton}">${d.touches}</tspan> touche${d.touches > 1 ? "s" : ""}${d.critiques ? ` (${d.critiques} crit.)` : ""}</text>`;
	return ecran(C.sang, svg);
}

export function ecranAleatoire(nom: string, dernier: { texte: string; detail: string } | null): string {
	let svg = ligne(100, 18, nom, 188, 14, { ancre: "middle", couleur: C.laiton });
	if (!dernier) {
		svg += bloc(100, 60, "Tourner : choisir la table. Appui : tirer.", 184, 2, 13, 10, { ancre: "middle", couleur: C.terne, gras: false });
		return ecran(C.encre, svg);
	}
	svg += bloc(100, 54, dernier.texte, 188, 3, 18, 10, { ancre: "middle" });
	svg += ligne(100, 94, dernier.detail, 188, 11, { ancre: "middle", couleur: C.terne, gras: false });
	return ecran(C.encre, svg);
}
