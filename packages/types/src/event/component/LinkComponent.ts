import type { Translations } from "../../types/Translations.js";

export interface LinkComponent {
	$type: "directory.evnt.component.link#0";
	url: string;
	name?: Translations;
	disabled?: boolean;
}
