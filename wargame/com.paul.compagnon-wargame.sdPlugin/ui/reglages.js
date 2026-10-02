/* Réglages du Compagnon de wargame — une seule page pour toutes les actions. */
"use strict";

let socket = null;
let contexte = "";
let uuidAction = "";
let reglages = {};
let etat = null;
let confirmation = null;

const $ = (id) => document.getElementById(id);
const genre = () => uuidAction.split(".").pop();

const AIDES = {
	partie: "Appui : ouvrir le journal de la partie. Appui long (1,5 s) : clore la partie et en commencer une nouvelle avec le même jeu.",
	sequence:
		"Appui : phase suivante. Appui long : phase précédente. Sur Stream Deck +, la molette fait défiler les phases. Chaque phase est notée au journal après 2 secondes, pour que les allers-retours ne l'encombrent pas.",
	rappels: "Affiche un à un les rappels de la phase en cours. Appui : rappel suivant. Appui long : revenir au premier.",
	combat:
		"Appui : lancer sur la colonne affichée. Appui long : colonne suivante. Molette : colonne ; tourner en appuyant : modificateur. Des touches Ajuster peuvent aussi régler colonne et modificateur.",
	bataille:
		"Appui : lancer la poignée. Appui long : nouvelle bataille. Molette : nombre de dés ; tourner en appuyant : seuil ou profil. Le round avance seul quand un camp relance. Une touche par camp.",
	ajuster:
		"Appui : appliquer le réglage. Appui long : revenir à la valeur par défaut. Pour une bataille, choisis le même camp que sur la touche Bataille.",
	aleatoire: "Appui : tirer. Appui long : effacer le résultat. Molette : passer à une autre table.",
	des: "Exemples : 2d6, d20, 3d6+1, 1d6+1d4. Appui : lancer. Appui long : effacer."
};

/* ───────────── Connexion (appelée par Stream Deck) ───────────── */

// eslint-disable-next-line no-unused-vars
function connectElgatoStreamDeckSocket(port, uuid, evenementEnregistrement, _info, infoAction) {
	contexte = uuid;
	const action = JSON.parse(infoAction);
	uuidAction = action.action;
	reglages = action.payload?.settings ?? {};
	$("aide").textContent = AIDES[genre()] ?? "";

	socket = new WebSocket(`ws://127.0.0.1:${port}`);
	socket.onopen = () => {
		socket.send(JSON.stringify({ event: evenementEnregistrement, uuid }));
		envoyer({ type: "demande" });
	};
	socket.onmessage = (message) => {
		const donnees = JSON.parse(message.data);
		if (donnees.event === "sendToPropertyInspector" && donnees.payload?.type === "etat") {
			etat = donnees.payload;
			rendre();
		} else if (donnees.event === "didReceiveSettings") {
			reglages = donnees.payload?.settings ?? {};
			rendre();
		}
	};
	socket.onclose = () => ($("statut").textContent = "Plugin déconnecté. Rouvre les réglages de la touche.");
}
// Stream Deck appelle cette fonction par son nom global.
window.connectElgatoStreamDeckSocket = connectElgatoStreamDeckSocket;

function envoyer(payload) {
	if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: "sendToPlugin", action: uuidAction, context: contexte, payload }));
}

function sauver(valeurs) {
	reglages = { ...reglages, ...valeurs };
	for (const [cle, valeur] of Object.entries(reglages)) if (valeur === "" || valeur === undefined) delete reglages[cle];
	if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: "setSettings", context: contexte, payload: reglages }));
	rendre();
}

/* ───────────── Petits constructeurs DOM ───────────── */

function el(balise, attributs = {}, ...enfants) {
	const n = document.createElement(balise);
	for (const [cle, valeur] of Object.entries(attributs)) {
		if (cle.startsWith("on")) n.addEventListener(cle.slice(2), valeur);
		else if (valeur === true) n.setAttribute(cle, "");
		else if (valeur !== false && valeur !== undefined && valeur !== null) n.setAttribute(cle, valeur);
	}
	for (const e of enfants.flat()) if (e !== null && e !== undefined && e !== false) n.append(e);
	return n;
}

function ligne(libelle, idChamp, champ, note) {
	return [el("div", { class: "ligne" }, el("label", { for: idChamp }, libelle), champ), note ?? null];
}

function choix(id, options, valeur, surChange) {
	const s = el("select", { id, onchange: (e) => surChange(e.target.value) });
	for (const o of options) {
		if (o.groupe) {
			const g = el("optgroup", { label: o.groupe });
			for (const sous of o.options) g.append(el("option", { value: sous.valeur, selected: sous.valeur === valeur }, sous.texte));
			s.append(g);
		} else {
			s.append(el("option", { value: o.valeur, selected: o.valeur === valeur }, o.texte));
		}
	}
	return s;
}

/* ───────────── Rendu ───────────── */

function rendre() {
	rendreJeu();
	rendreSpecifique();
	rendreErreurs();
}

function rendreJeu() {
	const select = $("jeu");
	if (!etat) return;
	const choisi = select.dataset.choisi ?? etat.jeu ?? "";
	select.replaceChildren(
		...(etat.jeu ? [] : [el("option", { value: "" }, "Aucun jeu")]),
		...etat.jeux.map((j) => el("option", { value: j.id, selected: j.id === choisi }, j.nom + (j.perso ? "" : " (intégré)")))
	);
	select.onchange = () => {
		select.dataset.choisi = select.value;
		rendreJeu();
	};
	const enAttente = choisi && choisi !== etat.jeu;
	$("changement").hidden = !enAttente;
	$("changer").onclick = () => {
		delete select.dataset.choisi;
		envoyer({ type: "choisirJeu", id: choisi });
	};
	$("statut").textContent = etat.jeu
		? `Tour ${etat.tour}, ${etat.entrees} entrée${etat.entrees > 1 ? "s" : ""} au journal`
		: etat.jeux.length
			? "Choisis un jeu pour commencer."
			: "Aucun fichier de jeu trouvé. Ouvre le dossier des jeux depuis une touche Partie.";
}

function tables(...types) {
	return (etat?.tables ?? []).filter((t) => types.includes(t.type));
}

function optionsTables(liste, vide) {
	return [{ valeur: "", texte: vide }, ...liste.map((t) => ({ valeur: t.id, texte: t.nom }))];
}

const SPECIFIQUES = {
	partie() {
		const demander = () => {
			confirmation = setTimeout(() => {
				confirmation = null;
				rendre();
			}, 4000);
			rendre();
		};
		const confirmer = () => {
			clearTimeout(confirmation);
			confirmation = null;
			envoyer({ type: "nouvellePartie" });
			rendre();
		};
		const nouvelle = confirmation
			? el("button", { type: "button", class: "danger", onclick: confirmer }, "Confirmer : clore la partie")
			: el("button", { type: "button", onclick: demander }, "Nouvelle partie");
		return [
			el("div", { class: "actions" }, el("button", { type: "button", class: "principal", onclick: () => envoyer({ type: "ouvrirJournal" }) }, "Ouvrir le journal"), nouvelle),
			el("div", { class: "actions" }, el("button", { type: "button", onclick: () => envoyer({ type: "ouvrirDossier" }) }, "Ouvrir le dossier des jeux"), el("button", { type: "button", onclick: () => envoyer({ type: "recharger" }) }, "Relire les jeux")),
			etat?.dossier ? el("p", { class: "dossier" }, etat.dossier) : null
		];
	},

	combat() {
		const liste = tables("colonnes");
		if (!liste.length) return [el("p", { class: "note" }, "Ce jeu n'a pas de table à colonnes.")];
		return ligne("Table", "table", choix("table", optionsTables(liste, `Automatique (${liste[0].nom})`), reglages.table ?? "", (v) => sauver({ table: v })));
	},

	bataille() {
		const liste = tables("poignee");
		if (!liste.length) return [el("p", { class: "note" }, "Ce jeu n'a pas de table de bataille.")];
		const table = liste.find((t) => t.id === reglages.table) ?? liste[0];
		return [
			...ligne("Table", "table", choix("table", optionsTables(liste, `Automatique (${liste[0].nom})`), reglages.table ?? "", (v) => sauver({ table: v, camp: "" }))),
			...champCamp(table),
			table.profils.length ? el("p", { class: "note" }, `Profils : ${table.profils.join(", ")}`) : null
		];
	},

	ajuster() {
		const colonnes = tables("colonnes");
		const poignees = tables("poignee");
		if (!colonnes.length && !poignees.length) return [el("p", { class: "note" }, "Ce jeu n'a pas de table de combat à régler.")];
		const toutes = [...colonnes, ...poignees];
		const table = toutes.find((t) => t.id === reglages.table) ?? toutes[0];
		const groupes = [];
		if (colonnes.length) groupes.push({ groupe: "Tables à colonnes", options: colonnes.map((t) => ({ valeur: t.id, texte: t.nom })) });
		if (poignees.length) groupes.push({ groupe: "Batailles", options: poignees.map((t) => ({ valeur: t.id, texte: t.nom })) });
		const cibles = table.type === "colonnes" ? [["colonne", "Colonne"], ["mod", "Modificateur"]] : [["des", "Nombre de dés"], ["seuil", "Seuil ou profil"]];
		const cible = cibles.some(([v]) => v === reglages.cible) ? reglages.cible : cibles[0][0];
		const sens = reglages.sens === "moins" ? "moins" : "plus";
		const bouton = (valeur, texte) => el("button", { type: "button", "aria-pressed": String(sens === valeur), onclick: () => sauver({ sens: valeur }) }, texte);
		return [
			...ligne("Table", "table", choix("table", groupes, table.id, (v) => sauver({ table: v, cible: "", camp: "" }))),
			...ligne("Réglage", "cible", choix("cible", cibles.map(([valeur, texte]) => ({ valeur, texte })), cible, (v) => sauver({ cible: v }))),
			...(table.type === "poignee" ? champCamp(table) : []),
			el("div", { class: "ligne" }, el("span", { class: "libelle" }, "Sens"), el("div", { class: "segments", role: "group", "aria-label": "Sens" }, bouton("plus", "Plus"), bouton("moins", "Moins")))
		];
	},

	aleatoire() {
		const liste = tables("aleatoire");
		if (!liste.length) return [el("p", { class: "note" }, "Ce jeu n'a pas de table aléatoire.")];
		return ligne("Table", "table", choix("table", optionsTables(liste, `Automatique (${liste[0].nom})`), reglages.table ?? "", (v) => sauver({ table: v })));
	},

	des() {
		const defaut = etat?.des?.[0] ?? "2d6";
		const valide = (v) => !v.trim() || /^([+-]?(\d*d(\d+|%)|\d+))([+-](\d*d(\d+|%)|\d+))*$/i.test(v.trim().replace(/\s*([+-])\s*/g, "$1"));
		const note = el("p", { class: "note", id: "note-expression" }, `Vide : ${defaut}`);
		const champ = el("input", {
			type: "text",
			id: "expression",
			list: "suggestions",
			placeholder: defaut,
			value: reglages.expression ?? "",
			spellcheck: "false",
			oninput: (e) => {
				const ok = valide(e.target.value);
				e.target.classList.toggle("invalide", !ok);
				note.textContent = ok ? `Vide : ${defaut}` : "Format attendu : 2d6, d20, 3d6+1…";
				note.classList.toggle("erreur", !ok);
			},
			onchange: (e) => valide(e.target.value) && sauver({ expression: e.target.value.trim() })
		});
		const suggestions = el("datalist", { id: "suggestions" }, ...(etat?.des ?? []).map((d) => el("option", { value: d })));
		const libelle = el("input", { type: "text", id: "libelle", placeholder: "Facultatif, ex. Moral", value: reglages.libelle ?? "", onchange: (e) => sauver({ libelle: e.target.value.trim() }) });
		return [...ligne("Dés", "expression", champ, note), suggestions, ...ligne("Libellé", "libelle", libelle)];
	}
};

function champCamp(table) {
	if (table.camps.length) {
		const camp = table.camps.includes(reglages.camp) ? reglages.camp : table.camps[0];
		return ligne("Camp", "camp", choix("camp", table.camps.map((c) => ({ valeur: c, texte: c })), camp, (v) => sauver({ camp: v })));
	}
	return ligne("Camp", "camp", el("input", { type: "text", id: "camp", placeholder: "Camp", value: reglages.camp ?? "", onchange: (e) => sauver({ camp: e.target.value.trim() }) }));
}

function rendreSpecifique() {
	const zone = $("specifique");
	const actif = document.activeElement;
	// Ne pas reconstruire un champ texte pendant la frappe.
	if (actif && actif.tagName === "INPUT" && zone.contains(actif)) return;
	const fabrique = SPECIFIQUES[genre()];
	zone.replaceChildren(...(etat?.jeu && fabrique ? [fabrique()].flat().filter(Boolean) : genre() === "partie" && etat ? [SPECIFIQUES.partie()].flat().filter(Boolean) : []));
}

function rendreErreurs() {
	const erreurs = etat?.erreurs ?? [];
	$("erreurs").hidden = erreurs.length === 0;
	$("liste-erreurs").replaceChildren(...erreurs.map((e) => el("li", {}, el("strong", {}, e.fichier), ` : ${e.message}`)));
}
