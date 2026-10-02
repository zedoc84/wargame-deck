// Simule l'application Stream Deck : lance le vrai plugin compilé et lui envoie des appuis.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocketServer } from "ws";
import { Resvg } from "@resvg/resvg-js";

const UUID = "com.paul.compagnon-wargame";
const maison = mkdtempSync(path.join(os.tmpdir(), "faux-sd-"));
const sortie = "apercu/integration"; mkdirSync(sortie, { recursive: true });
const serveur = new WebSocketServer({ port: 0 });
const port = serveur.address().port;
const recus = [];
let ws, globaux = {};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const envoyer = (m) => ws.send(JSON.stringify(m));

const connecte = new Promise((ok) => serveur.on("connection", (s) => {
  ws = s;
  s.on("message", (brut) => {
    const m = JSON.parse(brut.toString());
    recus.push(m);
    if (m.event === "getGlobalSettings") envoyer({ event: "didReceiveGlobalSettings", payload: { settings: globaux }, ...(m.id ? { id: m.id } : {}) });
    if (m.event === "setGlobalSettings") globaux = m.payload;
    if (m.event === "registerPlugin") ok();
  });
}));

const info = {
  application: { font: "Arial", language: "fr", platform: "mac", platformVersion: "15.0", version: "7.1.0.1" },
  plugin: { uuid: UUID, version: "1.0.0.0" },
  devicePixelRatio: 2, colors: {},
  devices: [{ id: "SD", name: "Stream Deck +", size: { columns: 4, rows: 2 }, type: 7 }]
};
const plugin = spawn("node", ["bin/plugin.js", "-port", String(port), "-pluginUUID", UUID, "-registerEvent", "registerPlugin", "-info", JSON.stringify(info)], {
  cwd: "com.paul.compagnon-wargame.sdPlugin", env: { ...process.env, HOME: maison }, stdio: ["ignore", "pipe", "pipe"]
});
let journalPlugin = "";
plugin.stdout.on("data", (d) => (journalPlugin += d)); plugin.stderr.on("data", (d) => (journalPlugin += d));

await Promise.race([connecte, attendre(8000).then(() => { throw new Error("Le plugin ne s'est pas connecté.\n" + journalPlugin); })]);
console.log("Plugin connecté et enregistré.");

const touches = [
  ["partie", "k-partie", "Keypad", 0, 0, {}], ["sequence", "k-seq", "Keypad", 1, 0, {}], ["rappels", "k-rap", "Keypad", 2, 0, {}],
  ["combat", "k-combat", "Keypad", 3, 0, {}], ["bataille", "k-att", "Keypad", 0, 1, { camp: "Attaquant" }], ["bataille", "k-def", "Keypad", 1, 1, { camp: "Défenseur" }],
  ["aleatoire", "k-alea", "Keypad", 2, 1, { table: "meteo" }], ["des", "k-des", "Keypad", 3, 1, { expression: "2d6", libelle: "Moral" }],
  ["ajuster", "k-aj", "Keypad", 0, 2, { table: "combat", cible: "colonne", sens: "plus" }],
  ["sequence", "d-seq", "Encoder", 0, 0, {}], ["combat", "d-combat", "Encoder", 1, 0, {}], ["bataille", "d-bat", "Encoder", 2, 0, { camp: "Défenseur" }], ["aleatoire", "d-alea", "Encoder", 3, 0, {}]
];
const reglages = Object.fromEntries(touches.map((t) => [t[1], t[5]]));
const quoi = Object.fromEntries(touches.map((t) => [t[1], t]));
const base = (ctx) => { const [a, , controller, column, row] = quoi[ctx]; return { action: `${UUID}.${a}`, context: ctx, device: "SD", payload: { controller, coordinates: { column, row }, isInMultiAction: false, settings: reglages[ctx], state: 0 } }; };
for (const t of touches) envoyer({ ...base(t[1]), event: "willAppear" });
await attendre(1500);

const appui = async (ctx, ms = 80) => { envoyer({ ...base(ctx), event: "keyDown" }); await attendre(ms); envoyer({ ...base(ctx), event: "keyUp" }); await attendre(150); };
const tourne = async (ctx, ticks, pressed = false) => { envoyer({ ...base(ctx), event: "dialRotate", payload: { ...base(ctx).payload, ticks, pressed } }); await attendre(120); };
const molette = async (ctx) => { envoyer({ ...base(ctx), event: "dialDown" }); await attendre(60); envoyer({ ...base(ctx), event: "dialUp" }); await attendre(150); };

// Partie : on avance de deux phases, on tire, on combat, on se bat.
await appui("k-seq"); await appui("k-seq");
await appui("k-rap");
await appui("k-combat");
await appui("k-combat", 800);               // appui long : colonne suivante
await appui("k-aj");                        // Ajuster : colonne +
await appui("k-att"); await appui("k-def"); await appui("k-att");   // round 2
await appui("k-alea");
await appui("k-des");
await tourne("d-seq", 1); await tourne("d-seq", -1);
await tourne("d-combat", 1, true);          // modificateur +1 (molette appuyée)
await molette("d-combat");                  // lancer
await tourne("d-bat", 3); await molette("d-bat");
await tourne("d-alea", 1); await molette("d-alea");
envoyer({ ...base("d-alea"), event: "touchTap", payload: { ...base("d-alea").payload, hold: false, tapPos: [10, 10] } });
await attendre(2600);                       // laisse la phase en attente s'écrire au journal

// Dernières images reçues par contexte
const images = {};
for (const m of recus) {
  if (m.event === "setImage") images[m.context] = m.payload.image;
  if (m.event === "setFeedback") images[m.context] = m.payload.ecran;
}
for (const [ctx, url] of Object.entries(images)) {
  const svg = Buffer.from(url.split(",")[1], "base64").toString("utf8");
  const l = ctx.startsWith("d-") ? 200 : 144;
  writeFileSync(`${sortie}/${ctx}.png`, new Resvg(svg, { fitTo: { mode: "width", value: l }, font: { loadSystemFonts: true, sansSerifFamily: "Liberation Sans", defaultFontFamily: "Liberation Sans" } }).render().asPng());
}
const compte = recus.reduce((a, m) => ((a[m.event] = (a[m.event] ?? 0) + 1), a), {});
console.log("Messages du plugin :", JSON.stringify(compte));
console.log("Contextes dessinés :", Object.keys(images).length, "/", touches.length);
console.log("Alertes :", recus.filter((m) => m.event === "showAlert").map((m) => m.context));
console.log("État sauvegardé : tour", globaux.tour, "étape", globaux.etape, "entrées", globaux.entrees, "jeu", globaux.jeu);
const dossierJ = path.join(maison, "Documents", "Compagnon de wargame", "journaux");
const fichiers = readdirSync(dossierJ);
console.log("\n--- Journal écrit par le plugin (" + fichiers[0] + ") ---\n" + readFileSync(path.join(dossierJ, fichiers[0]), "utf8"));
const erreurs = journalPlugin.split("\n").filter((l) => /error|erreur|exception/i.test(l));
console.log("Erreurs dans la sortie du plugin :", erreurs.length ? erreurs : "aucune");
plugin.kill(); serveur.close(); process.exit(0);
