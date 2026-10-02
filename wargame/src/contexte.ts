import streamDeck from "@elgato/streamdeck";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Etat, type EtatPartie } from "./core/etat.js";

/** Dossier du plugin (…/com.paul.compagnon-wargame.sdPlugin), déduit de bin/plugin.js. */
export const DOSSIER_PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** L'état de la partie, partagé par toutes les actions. */
export const etat = new Etat(
	{
		charger: () => streamDeck.settings.getGlobalSettings(),
		sauver: (e: EtatPartie) => streamDeck.settings.setGlobalSettings(e as unknown as Parameters<typeof streamDeck.settings.setGlobalSettings>[0]),
		log: (m: string) => streamDeck.logger.warn(m)
	},
	path.join(DOSSIER_PLUGIN, "jeux")
);
