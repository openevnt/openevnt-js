import type { AnyComponent, OpenEvnt, Translations, Venue } from "@evnt/types";
import type { PartialDateString } from "@evnt/partial-date";
import { translate, createTranslations } from "../utils/translations.js";
import { isRecord, asNonEmptyString, readUrlLike } from "../utils/text.js";
import { parseDateString, partialDateToIso } from "../utils/date.js";
import { link } from "../utils/components.js";
import { documentId, nonEmpty } from "../utils/document.js";
import type { FormatConverter, ConvertOptions, JsonObject } from "../types.js";

const asSchemaOrgDate = (value: PartialDateString): string =>
	partialDateToIso(value) ?? value.slice(0, value.indexOf("["));

export const schemaOrg = {
	name: "Schema.org",
	description: "Schema.org Event (JSON-LD)",
	extensions: ["json"],
	mimeTypes: ["application/ld+json", "application/json"],

	from: (data: JsonObject, opts?: ConvertOptions): OpenEvnt => {
		const language = opts?.language ?? "en";
		const timeZoneId = opts?.timezone ?? "UTC";

		const parseTextFromSchema = (val: unknown): Translations | null => {
			if (!val) return null;
			const translations: Translations = {};
			const items = Array.isArray(val) ? val : [val];

			for (const item of items) {
				if (typeof item === "string") {
					translations[language] = item;
					continue;
				}
				if (!isRecord(item)) continue;

				if (item["@type"] === "PronounceableText" || item["@type"] === "TextObject") {
					const text = asNonEmptyString(item.textValue ?? item.text);
					if (!text) continue;
					const langs: string[] = (
						Array.isArray(item.inLanguage) ? item.inLanguage : [item.inLanguage]
					).filter((l: unknown): l is string => typeof l === "string");
					for (const lang of langs.length > 0 ? langs : [language]) {
						translations[lang] = text;
					}
				}
			}

			return Object.keys(translations).length > 0 ? translations : null;
		};

		const convertPartialDate = (dateStr: unknown): PartialDateString | undefined =>
			typeof dateStr === "string" ? parseDateString(dateStr, timeZoneId) : undefined;

		let venue: Venue | undefined;
		const components: AnyComponent[] = [];
		const location = data.location;

		if (isRecord(location) && location["@type"] === "VirtualLocation") {
			const url = readUrlLike(location.url);
			if (url) components.push(link(url, asNonEmptyString(location.name), language));
		} else if (isRecord(location)) {
			const address = location.address;
			const countryCode = isRecord(address) ? asNonEmptyString(address.addressCountry) : undefined;
			const candidate: Venue = {
				name:
					parseTextFromSchema(location.name) ??
					createTranslations(asNonEmptyString(location.name), language),
				address:
					typeof address === "string"
						? asNonEmptyString(address)
						: isRecord(address)
							? (asNonEmptyString(address.streetAddress) ??
								asNonEmptyString(address.addressLocality))
							: undefined,
				countryCode:
					countryCode && /^[A-Za-z]{2}$/.test(countryCode) ? countryCode.toUpperCase() : undefined,
			};
			if (candidate.name || candidate.address || candidate.countryCode) venue = candidate;
		} else if (typeof location === "string" && location.trim()) {
			venue = { name: { [language]: location } };
		}

		const start = convertPartialDate(data.startDate);
		const end = convertPartialDate(data.endDate);

		return {
			v: "0.2",
			id: documentId(opts),
			name: parseTextFromSchema(data.name) ?? { [language]: "Untitled Event" },
			venue,
			occurrences: start || end ? [{ start, end }] : undefined,
			components: nonEmpty(components),
		};
	},

	to: (data: OpenEvnt, opts?: ConvertOptions): JsonObject => {
		const language = opts?.language ?? "en";

		// const nameAsPronounceable = (translations: Translations | undefined): unknown[] => {
		// 	if (!translations) return [];
		// 	return Object.entries(translations).map(([lang, text]) => ({
		// 		"@type": "PronounceableText",
		// 		inLanguage: lang,
		// 		textValue: text,
		// 	}));
		// };

		const pickTranslation = (translations: Translations | undefined): string | undefined => {
			if (!translations) return undefined;
			return translate(translations, [language, "en", ...Object.keys(translations)]);
		};

		const occurrence = data.occurrences?.[0];
		const venue = data.venue;

		return {
			"@context": "https://schema.org",
			"@type": "Event",
			name: pickTranslation(data.name) ?? "Untitled Event",
			startDate: occurrence?.start ? asSchemaOrgDate(occurrence.start) : undefined,
			endDate: occurrence?.end ? asSchemaOrgDate(occurrence.end) : undefined,
			location: venue
				? {
						"@type": "Place",
						name: pickTranslation(venue.name),
						address: venue.address,
					}
				: undefined,
		};
	},
} satisfies FormatConverter<JsonObject>;
