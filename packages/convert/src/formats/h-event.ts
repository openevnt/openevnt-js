import { parseDocument } from "htmlparser2";
import type { Element, ChildNode } from "domhandler";
import type { AnyComponent, OpenEvnt } from "@evnt/types";
import { createTranslations } from "../utils/translations.js";
import { parseDateString } from "../utils/date.js";
import { link, plainText } from "../utils/components.js";
import { documentId, nonEmpty } from "../utils/document.js";
import type { FormatConverter, ConvertOptions } from "../types.js";

const hasClass = (node: Element, name: string): boolean =>
	node.attribs?.class?.split(/\s+/).includes(name) ?? false;

const findFirst = (root: ChildNode, className: string): Element | undefined => {
	if (root.type === "tag" && hasClass(root, className)) return root;
	if ("children" in root) {
		for (const child of root.children) {
			const found = findFirst(child, className);
			if (found) return found;
		}
	}
	return undefined;
};

const textContent = (node: ChildNode): string => {
	if (node.type === "text") return node.data ?? "";
	if ("children" in node) return node.children.map(textContent).join("");
	return "";
};

export const hEvent = {
	name: "h-event",
	description: "Microformats2 h-event (HTML)",
	extensions: ["html", "htm"],
	mimeTypes: ["text/html"],

	from: (input: string, opts?: ConvertOptions): OpenEvnt => {
		const language = opts?.language ?? "en";
		const timeZoneId = opts?.timezone ?? "UTC";
		const doc = parseDocument(input);
		const root = doc.children.find(
			(c): c is Element => c.type === "tag" && findFirst(c, "h-event") !== undefined,
		);
		const scope = (root ? findFirst(root, "h-event") : undefined) ?? doc;

		const pick = (cls: string) => {
			const el = findFirst(scope, cls);
			if (!el) return undefined;
			const text = textContent(el).trim();
			return text.length > 0 ? text : undefined;
		};

		const pickAttr = (cls: string, attr: string): string | undefined =>
			findFirst(scope, cls)?.attribs?.[attr]?.trim() || undefined;

		const name = pick("p-name") ?? pick("p-summary");
		const location = pick("p-location");
		const url = pickAttr("u-url", "href");
		const startStr = pickAttr("dt-start", "datetime") ?? pick("dt-start");
		const endStr = pickAttr("dt-end", "datetime") ?? pick("dt-end");
		const description = pick("p-description");

		const start = startStr ? parseDateString(startStr, timeZoneId) : undefined;
		const end = endStr ? parseDateString(endStr, timeZoneId) : undefined;

		const isOnline = location !== undefined && /^https?:\/\//i.test(location);

		const components: AnyComponent[] = [];
		if (url) components.push(link(url, undefined, language));
		if (location && isOnline) components.push(link(location, undefined, language));
		if (description) components.push(plainText(description, language));

		return {
			v: "0.2",
			id: documentId(opts),
			name: createTranslations(name, language) ?? { [language]: "Untitled Event" },
			venue: location && !isOnline ? { name: { [language]: location } } : undefined,
			occurrences: start || end ? [{ start, end }] : undefined,
			components: nonEmpty(components),
		};
	},
} satisfies FormatConverter<string>;
