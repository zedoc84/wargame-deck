// Génère toutes les icônes du plugin à partir de glyphes SVG (node scripts/icones.mjs).
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const RACINE = "com.paul.compagnon-wargame.sdPlugin/imgs";
const BLANC = "#FFFFFF";
const FONDS = { ardoise: "#17201C", sang: "#2A1916", encre: "#1A1D2A" };
const IVOIRE = "#ECE5CF";
const LAITON = "#D3A93F";

const trait = (d, c = BLANC, w = 3) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const point = (x, y, r, c = BLANC) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const de = (x, y, s, c = BLANC, pips = [[0.5, 0.5]]) =>
	`<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.22}" fill="none" stroke="${c}" stroke-width="2.6"/>` + pips.map(([px, py]) => point(x + px * s, y + py * s, s * 0.09, c)).join("");

/** Glyphes en 40 × 40, monochromes. */
const GLYPHES = {
	partie: (c) => trait("M20 11 C15 8 9 8 5 10 V31 C9 29 15 29 20 32 C25 29 31 29 35 31 V10 C31 8 25 8 20 11 Z M20 11 V32", c),
	sequence: (c) => trait("M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z", c) + `<path d="M16 13 L27 20 L16 27 Z" fill="${c}"/>`,
	rappels: (c) => trait("M6 11 L9 14 L14 8 M19 11 H34 M6 21 L9 24 L14 18 M19 21 H34 M19 31 H34", c) + `<rect x="6.5" y="27.5" width="7" height="7" rx="1.5" fill="none" stroke="${c}" stroke-width="2.6"/>`,
	combat: (c) => trait("M8 8 L28 28 M25 32 L32 25 M28 28 L34 34 M32 8 L12 28 M8 25 L15 32 M12 28 L6 34", c),
	bataille: (c) => de(3, 20, 15, c, [[0.3, 0.3], [0.7, 0.7]]) + de(22, 20, 15, c, [[0.5, 0.5]]) + de(12.5, 3, 15, c, [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]]),
	ajuster: (c) => trait("M6 14 H18 M12 8 V20 M22 26 H34 M14 34 L26 6", c),
	aleatoire: (c) => `<rect x="9" y="4" width="22" height="32" rx="3.5" fill="none" stroke="${c}" stroke-width="2.6"/>` + trait("M15.5 15 C15.5 10.5 24.5 10.5 24.5 15 C24.5 18.5 20 18.5 20 23", c, 2.8) + point(20, 28.5, 1.9, c),
	des: (c) => de(7, 7, 26, c, [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]]),
	categorie: (c) => trait("M20 3 L35 11.5 L35 28.5 L20 37 L5 28.5 L5 11.5 Z", c) + point(14, 14, 2.6, c) + point(20, 20, 2.6, c) + point(26, 26, 2.6, c)
};

const FAMILLES = { partie: "ardoise", sequence: "ardoise", rappels: "ardoise", combat: "sang", bataille: "sang", ajuster: "sang", aleatoire: "encre", des: "encre" };

function png(svg, taille, fichier) {
	mkdirSync(path.dirname(fichier), { recursive: true });
	const rendu = new Resvg(svg, { fitTo: { mode: "width", value: taille }, background: "rgba(0,0,0,0)" }).render();
	writeFileSync(fichier, rendu.asPng());
}

const svg40 = (contenu) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">${contenu}</svg>`;

for (const [nom, glyphe] of Object.entries(GLYPHES)) {
	if (nom === "categorie") continue;
	// Icône de la liste d'actions : blanc sur transparent.
	png(svg40(glyphe(BLANC)), 20, `${RACINE}/actions/${nom}/icone.png`);
	png(svg40(glyphe(BLANC)), 40, `${RACINE}/actions/${nom}/icone@2x.png`);
	// Image de touche par défaut (remplacée dès que le plugin dessine).
	const touche = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="${FONDS[FAMILLES[nom]]}"/><g transform="translate(32 32) scale(2)">${glyphe(IVOIRE)}</g></svg>`;
	png(touche, 72, `${RACINE}/actions/${nom}/touche.png`);
	png(touche, 144, `${RACINE}/actions/${nom}/touche@2x.png`);
}

png(svg40(GLYPHES.categorie(BLANC)), 28, `${RACINE}/plugin/categorie.png`);
png(svg40(GLYPHES.categorie(BLANC)), 56, `${RACINE}/plugin/categorie@2x.png`);

// Icône du plugin : un pion hexagonal laiton sur carte de nuit, un dé ivoire au centre.
const plugin = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="${FONDS.ardoise}"/>
<path d="M256 52 L433 154 L433 358 L256 460 L79 358 L79 154 Z" fill="none" stroke="${LAITON}" stroke-width="22" stroke-linejoin="round"/>
<rect x="166" y="166" width="180" height="180" rx="34" fill="${IVOIRE}"/>
${[[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]].map(([x, y]) => point(166 + x * 180, 166 + y * 180, 17, FONDS.ardoise)).join("")}
</svg>`;
png(plugin, 256, `${RACINE}/plugin/icone.png`);
png(plugin, 512, `${RACINE}/plugin/icone@2x.png`);

console.log("Icônes générées.");
