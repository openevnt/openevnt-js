import type {
	AnyComponent,
	LinkComponent,
	MarkdownTextComponent,
	PlainTextComponent,
	SourceComponent,
	SplashMediaComponent,
	Translations,
} from "@evnt/types";
import { translate } from "./translations.js";

export const isLink = (component: AnyComponent): component is LinkComponent =>
	component.$type === "directory.evnt.component.link#0";

export const isSource = (component: AnyComponent): component is SourceComponent =>
	component.$type === "directory.evnt.component.source#0";

export const isSplashMedia = (component: AnyComponent): component is SplashMediaComponent =>
	component.$type === "directory.evnt.component.splashMedia#0";

export interface Description {
	text: string;
	mediaType: "text/markdown" | "text/plain";
}

const textIn = (content: Translations, languages: string[]): string | undefined =>
	translate(content, [...languages, ...Object.keys(content)]);

export const findDescription = (
	components: readonly AnyComponent[] | undefined,
	languages: string[],
): Description | undefined => {
	for (const component of components ?? []) {
		if (component.$type === "directory.evnt.text.markdown#0") {
			const text = textIn((component as MarkdownTextComponent).content, languages);
			if (text) return { text, mediaType: "text/markdown" };
		}
		if (component.$type === "directory.evnt.text.plain#0") {
			const text = textIn((component as PlainTextComponent).content, languages);
			if (text) return { text, mediaType: "text/plain" };
		}
	}
	return undefined;
};

export const findLinkUrl = (components: readonly AnyComponent[] | undefined): string | undefined =>
	components?.filter(isLink).find((link) => !link.disabled)?.url;

export const plainText = (text: string, language: string): PlainTextComponent => ({
	$type: "directory.evnt.text.plain#0",
	content: { [language]: text },
});

export const markdownText = (text: string, language: string): MarkdownTextComponent => ({
	$type: "directory.evnt.text.markdown#0",
	content: { [language]: text },
});

export const link = (url: string, name: string | undefined, language: string): LinkComponent => ({
	$type: "directory.evnt.component.link#0",
	url,
	...(name ? { name: { [language]: name } } : {}),
});
