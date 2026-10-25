import type { Translations } from "../../../types/Translations.js";

export interface MarkdownTextComponent {
	$type: "directory.evnt.text.markdown#0";
	content: Translations;
	/** CommonMark when absent */
	flavor?: string;
}
