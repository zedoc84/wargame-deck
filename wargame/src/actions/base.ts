import streamDeck, {
	SingletonAction,
	type Action,
	type DialDownEvent,
	type DialRotateEvent,
	type DialUpEvent,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type KeyUpEvent,
	type TouchTapEvent,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import { etat } from "../contexte.js";
import { versDataUrl } from "../core/rendu.js";

export type Reglages = Record<string, string | undefined>;

/**
 * Base commune : distingue appui court et appui long sur les touches, appui simple et
 * « appuyé + tourner » sur les molettes, et redessine toutes les instances quand la partie change.
 */
export abstract class ActionCompagnon<S extends Reglages = Reglages> extends SingletonAction<S> {
	protected reglages = new Map<string, S>();
	private appuis = new Map<string, { minuterie: NodeJS.Timeout; long: boolean }>();
	private molettes = new Map<string, { tournee: boolean }>();
	/** Durée (ms) au-delà de laquelle un appui devient un appui long. */
	protected dureeAppuiLong = 600;

	constructor() {
		super();
		etat.abonner(() => this.rafraichir());
	}

	/* ── À implémenter ── */

	/** SVG de la touche (144 × 144). */
	protected abstract image(a: Action<S>): string;
	/** SVG de l'écran tactile (200 × 100) ; par défaut, rien de spécifique. */
	protected ecran(a: Action<S>): string | null {
		void a;
		return null;
	}
	protected appuiCourt(a: Action<S>): void {
		void a;
	}
	protected appuiLong(a: Action<S>): void {
		this.appuiCourt(a);
	}
	protected tourner(a: Action<S>, crans: number, appuye: boolean): void {
		void a;
		void crans;
		void appuye;
	}

	/* ── Outils ── */

	protected r(a: { id: string }): S {
		return this.reglages.get(a.id) ?? ({} as S);
	}

	protected async enregistrer(a: Action<S>, valeurs: Partial<S>): Promise<void> {
		const nouveaux = { ...this.r(a), ...valeurs } as S;
		this.reglages.set(a.id, nouveaux);
		await a.setSettings(nouveaux);
		await this.dessiner(a);
	}

	async dessiner(a: Action<S>): Promise<void> {
		try {
			if (a.isKey()) {
				await a.setImage(versDataUrl(this.image(a)));
			} else if (a.isDial()) {
				await a.setFeedback({ ecran: versDataUrl(this.ecran(a) ?? this.image(a)) });
			}
		} catch (e) {
			streamDeck.logger.error(`Dessin impossible : ${(e as Error).message}`);
		}
	}

	rafraichir(): void {
		for (const a of this.actions) void this.dessiner(a);
	}

	private securise(a: Action<S>, f: () => void): void {
		try {
			f();
		} catch (e) {
			streamDeck.logger.error((e as Error).message);
			if (a.isKey() || a.isDial()) void a.showAlert();
		}
	}

	/* ── Événements Stream Deck ── */

	override onWillAppear(ev: WillAppearEvent<S>): Promise<void> {
		this.reglages.set(ev.action.id, ev.payload.settings);
		return this.dessiner(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<S>): void {
		this.reglages.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): Promise<void> {
		this.reglages.set(ev.action.id, ev.payload.settings);
		return this.dessiner(ev.action);
	}

	override onKeyDown(ev: KeyDownEvent<S>): void {
		this.reglages.set(ev.action.id, ev.payload.settings);
		const appui = {
			long: false,
			minuterie: setTimeout(() => {
				appui.long = true;
				this.securise(ev.action, () => this.appuiLong(ev.action));
			}, this.dureeAppuiLong)
		};
		this.appuis.set(ev.action.id, appui);
	}

	override onKeyUp(ev: KeyUpEvent<S>): void {
		const appui = this.appuis.get(ev.action.id);
		this.appuis.delete(ev.action.id);
		if (appui) clearTimeout(appui.minuterie);
		if (!appui?.long) this.securise(ev.action, () => this.appuiCourt(ev.action));
	}

	override onDialDown(ev: DialDownEvent<S>): void {
		this.molettes.set(ev.action.id, { tournee: false });
	}

	override onDialRotate(ev: DialRotateEvent<S>): void {
		const m = this.molettes.get(ev.action.id);
		if (ev.payload.pressed && m) m.tournee = true;
		this.securise(ev.action, () => this.tourner(ev.action, ev.payload.ticks, ev.payload.pressed));
	}

	override onDialUp(ev: DialUpEvent<S>): void {
		const m = this.molettes.get(ev.action.id);
		this.molettes.delete(ev.action.id);
		// Un appui pendant lequel on a tourné sert à régler, pas à déclencher.
		if (!m?.tournee) this.securise(ev.action, () => this.appuiCourt(ev.action));
	}

	override onTouchTap(ev: TouchTapEvent<S>): void {
		this.securise(ev.action, () => (ev.payload.hold ? this.appuiLong(ev.action) : this.appuiCourt(ev.action)));
	}
}
