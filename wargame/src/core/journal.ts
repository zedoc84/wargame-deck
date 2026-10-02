import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const DOSSIER_RACINE = path.join(os.homedir(), "Documents", "Compagnon de wargame");
export const DOSSIER_JEUX = path.join(DOSSIER_RACINE, "jeux");
export const DOSSIER_JOURNAUX = path.join(DOSSIER_RACINE, "journaux");

let file: Promise<void> = Promise.resolve();

/** Ajoute du texte au fichier, dans l'ordre d'appel, sans bloquer le plugin. */
export function ecrire(fichier: string, texte: string): Promise<void> {
	file = file
		.then(() => mkdir(path.dirname(fichier), { recursive: true }))
		.then(() => appendFile(fichier, texte, "utf8"))
		.catch(() => undefined);
	return file;
}

export function heure(date = new Date()): string {
	return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function dateLongue(date = new Date()): string {
	return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const nomsDonnes = new Set<string>();

/** Nom de fichier unique : « divine-right_2026-10-01_21h04.md », puis « …_21h04-2.md » si déjà pris. */
export function nomJournal(idJeu: string, date = new Date()): string {
	const p = (n: number) => String(n).padStart(2, "0");
	const horodatage = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}h${p(date.getMinutes())}`;
	let chemin = path.join(DOSSIER_JOURNAUX, `${idJeu}_${horodatage}.md`);
	for (let n = 2; existsSync(chemin) || nomsDonnes.has(chemin); n++) chemin = path.join(DOSSIER_JOURNAUX, `${idJeu}_${horodatage}-${n}.md`);
	nomsDonnes.add(chemin);
	return chemin;
}

/** Ouvre un fichier ou un dossier avec l'application par défaut du système. */
export async function ouvrir(chemin: string): Promise<void> {
	await file;
	const [commande, args] =
		process.platform === "win32" ? ["cmd", ["/c", "start", '""', `"${chemin}"`]] : process.platform === "darwin" ? ["open", [chemin]] : ["xdg-open", [chemin]];
	const enfant = spawn(commande, args as string[], { detached: true, stdio: "ignore", shell: process.platform === "win32" });
	enfant.on("error", () => undefined);
	enfant.unref();
}
