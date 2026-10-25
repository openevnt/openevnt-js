import type { Translations } from "../../types/Translations.js";
import type { AnyComponent } from "../component/index.js";

export interface Venue {
	name?: Translations;
	address?: string;
	/** Uppercase ISO 3166-1 alpha-2 code */
	countryCode?: string;
	components?: AnyComponent[];
}
