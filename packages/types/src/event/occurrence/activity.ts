import type { Translations } from "../../types/Translations.js";

export interface Activity {
	name: Translations;
	status?: "cancelled";
}
