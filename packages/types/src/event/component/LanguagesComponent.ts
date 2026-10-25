export namespace LanguagesComponent {
	export interface LanguageInfo {
		code: string;
	}
}

export interface LanguagesComponent {
	$type: "directory.evnt.component.languages#0";
	languages: LanguagesComponent.LanguageInfo[];
}

export type LanguageInfo = LanguagesComponent.LanguageInfo;
