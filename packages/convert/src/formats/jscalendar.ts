import type { AnyComponent, Occurrence, OpenEvnt, Translations, Venue } from "@evnt/types";
import { PartialDate, type PartialDateString } from "@evnt/partial-date";
import { translate, createTranslations } from "../utils/translations.js";
import { isRecord, asNonEmptyString } from "../utils/text.js";
import { addDays, parseDateString } from "../utils/date.js";
import {
	findDescription,
	isLink,
	isSource,
	link,
	markdownText,
	plainText,
} from "../utils/components.js";
import { documentId, nonEmpty } from "../utils/document.js";
import type { FormatConverter, ConvertOptions, JsonObject } from "../types.js";

interface JscLink {
	"@type"?: string;
	href: string;
	rel?: string;
	title?: string;
	mediaType?: string;
}

const fromJscStatus = (status: string | undefined): OpenEvnt["status"] => {
	switch (status) {
		case "tentative":
			return "uncertain";
		case "cancelled":
			return "cancelled";
		default:
			return undefined;
	}
};

const toJscStatus = (status: OpenEvnt["status"]): string | undefined => {
	switch (status) {
		case "uncertain":
		case "postponed":
			return "tentative";
		case "cancelled":
			return "cancelled";
		default:
			return undefined;
	}
};

const pad = (value: number, width = 2): string => String(value).padStart(width, "0");

/** A JSCalendar LocalDateTime carries no zone; the zone travels in `timeZone`. */
const localDateTime = (date: PartialDate): string => {
	const { year, month, day, hour, minute } = date.withPrecision("time");
	return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
};

const daysFrom = (first: PartialDate.Day, last: PartialDate.Day): number =>
	Math.round(
		(last.with({ timeZoneId: "UTC" }).startEpochMilliseconds -
			first.with({ timeZoneId: "UTC" }).startEpochMilliseconds) /
			86_400_000,
	);

const exactDuration = (milliseconds: number): string => {
	const minutes = Math.round(milliseconds / 60_000);
	const hours = Math.floor(minutes / 60);
	if (minutes === 0) return "PT0S";
	return `PT${hours ? `${hours}H` : ""}${minutes % 60 ? `${minutes % 60}M` : ""}`;
};

/**
 * JSCalendar has no `end`: an interval is a start plus a duration. A dateless
 * event counts whole days, and its OpenEvnt end names the last of them, so the
 * duration has to reach past it.
 */
const durationBetween = (
	start: PartialDateString,
	end: PartialDateString | undefined,
): string | undefined => {
	const from = PartialDate.from(start);

	if (!from.has("time")) {
		const first = from.withPrecision("day", "first");
		const last = PartialDate.from(end ?? start).withPrecision("day", "last");
		return `P${daysFrom(first, last) + 1}D`;
	}

	if (!end) return undefined;

	return exactDuration(PartialDate.from(end).endEpochMilliseconds - from.startEpochMilliseconds);
};

const DURATION_PATTERN =
	/^P(?:(?<weeks>\d+)W)?(?:(?<days>\d+)D)?(?:T(?:(?<hours>\d+)H)?(?:(?<minutes>\d+)M)?(?:(?<seconds>\d+)(?:\.\d+)?S)?)?$/;

/** Weeks and days in a JSCalendar duration follow the wall clock; hours and less are exact. */
const endFromDuration = (
	start: PartialDateString,
	duration: string,
): PartialDateString | undefined => {
	const parts = DURATION_PATTERN.exec(duration)?.groups;
	if (!parts || duration === "P" || duration.endsWith("T")) return undefined;
	const amount = (unit: string) => Number(parts[unit] ?? 0);

	const from = PartialDate.from(start);
	// A dateless duration is exclusive of the day it lands on.
	const timed = from.has("time");
	const days = amount("weeks") * 7 + amount("days") - (timed ? 0 : 1);
	const exact = ((amount("hours") * 60 + amount("minutes")) * 60 + amount("seconds")) * 1000;

	try {
		const wallClock = addDays(from.withPrecision("time"), days);
		const landed = PartialDate.fromEpochMilliseconds(
			wallClock.startEpochMilliseconds + exact,
			from.timeZoneId,
		);
		return (timed ? landed : landed.toDay()).toString();
	} catch {
		return undefined;
	}
};

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;

const readLocalDateTime = (
	value: string,
	timeZoneId: string,
	showWithoutTime: boolean,
): PartialDateString | undefined => {
	const match = localDateTimePattern.exec(value);
	if (!match) return parseDateString(value, timeZoneId);

	const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
		number,
		number,
		number,
		number,
		number,
	];

	try {
		const date = PartialDate.from({ year, month, day, hour, minute, timeZoneId });
		return (showWithoutTime ? date.withPrecision("day") : date).toString();
	} catch {
		return undefined;
	}
};

export const jscalendar = {
	name: "JSCalendar",
	description: "JSCalendar (RFC 8984) JSON calendar format",
	extensions: ["json", "jscalendar"],
	mimeTypes: ["application/jscalendar+json", "application/json"],

	from: (data: JsonObject, opts?: ConvertOptions): OpenEvnt => {
		const language = opts?.language ?? "en";

		const title = asNonEmptyString(data.title);
		const description = asNonEmptyString(data.description);
		const start = asNonEmptyString(data.start);
		const end = asNonEmptyString(data.end);
		const duration = asNonEmptyString(data.duration);
		const status = fromJscStatus(asNonEmptyString(data.status));
		const showWithoutTime = data.showWithoutTime === true;
		const effectiveLanguage = asNonEmptyString(data.locale) ?? language;

		const timeZoneId = asNonEmptyString(data.timeZone) ?? opts?.timezone ?? "UTC";

		const components: AnyComponent[] = [];
		let venue: Venue | undefined;

		if (data.locations && isRecord(data.locations)) {
			for (const loc of Object.values(data.locations) as Array<{
				name?: string;
				type?: "physical" | "virtual";
				description?: string;
				links?: Record<string, JscLink>;
			}>) {
				const locName = asNonEmptyString(loc.name);
				const firstLinkHref = loc.links
					? (Object.values(loc.links).find((l) => l.href) as JscLink | undefined)?.href
					: undefined;

				if (loc.type === "virtual") {
					if (firstLinkHref) components.push(link(firstLinkHref, locName, effectiveLanguage));
					continue;
				}

				const address = loc.type === "physical" ? asNonEmptyString(loc.description) : undefined;
				if (venue || !(locName || address)) continue;
				venue = { name: createTranslations(locName, effectiveLanguage), address };
			}
		}

		if (description) {
			components.push(
				data.descriptionContentType === "text/markdown"
					? markdownText(description, effectiveLanguage)
					: plainText(description, effectiveLanguage),
			);
		}

		if (data.links && isRecord(data.links)) {
			for (const jscLink of Object.values(data.links) as JscLink[]) {
				const href = asNonEmptyString(jscLink.href);
				if (href && jscLink.rel === "source")
					components.push({ $type: "directory.evnt.component.source#0", url: href });
				else if (href) components.push(link(href, jscLink.title, effectiveLanguage));
			}
		}

		const parsedStart = start ? readLocalDateTime(start, timeZoneId, showWithoutTime) : undefined;
		const parsedEnd = end
			? readLocalDateTime(end, timeZoneId, showWithoutTime)
			: parsedStart && duration
				? endFromDuration(parsedStart, duration)
				: undefined;

		return {
			v: "0.2",
			id: documentId(opts),
			name: createTranslations(title, effectiveLanguage) ?? {
				[effectiveLanguage]: "Untitled Event",
			},
			status,
			venue,
			occurrences: parsedStart || parsedEnd ? [{ start: parsedStart, end: parsedEnd }] : undefined,
			components: nonEmpty(components),
		};
	},

	to: (data: OpenEvnt, opts?: ConvertOptions): JsonObject => {
		const language = opts?.language ?? "en";
		const pickTranslation = (translations: Translations | undefined): string | undefined =>
			translate(translations, [language, "en", ...Object.keys(translations ?? {})]);

		const locations: Record<string, Record<string, unknown>> = {};
		if (data.venue) {
			const loc: Record<string, unknown> = { "@type": "Location", type: "physical" };
			const venueName = pickTranslation(data.venue.name);
			if (venueName) loc.name = venueName;
			if (data.venue.address) loc.description = data.venue.address;
			locations["loc-0"] = loc;
		}

		const links: Record<string, Record<string, unknown>> = {};
		let linkIndex = 0;

		for (const component of data.components ?? []) {
			if (isLink(component)) {
				const jscLink: Record<string, unknown> = { "@type": "Link", href: component.url };
				const title = pickTranslation(component.name);
				if (title) jscLink.title = title;
				links[`link-${linkIndex++}`] = jscLink;
			} else if (isSource(component)) {
				links[`link-${linkIndex++}`] = { "@type": "Link", href: component.url, rel: "source" };
			}
		}

		const description = findDescription(data.components, [language, "en"]);

		const title = pickTranslation(data.name) ?? "Untitled Event";
		const uid = opts?.uid ?? data.id;

		const buildEvent = (
			occurrence: Occurrence | undefined,
			eventUid: string,
		): Record<string, unknown> => {
			const event: Record<string, unknown> = {
				"@type": "Event",
				uid: eventUid,
				title,
			};

			if (occurrence?.start) {
				const start = PartialDate.from(occurrence.start);
				event.start = localDateTime(start);
				if (start.has("time")) event.timeZone = start.timeZoneId;
				else event.showWithoutTime = true;

				const duration = durationBetween(occurrence.start, occurrence.end);
				if (duration) event.duration = duration;
			}

			if (Object.keys(locations).length > 0) event.locations = locations;
			if (description) {
				event.description = description.text;
				if (description.mediaType === "text/markdown")
					event.descriptionContentType = "text/markdown";
			}
			if (Object.keys(links).length > 0) event.links = links;

			const jscStatus = toJscStatus(occurrence?.status ?? data.status);
			if (jscStatus) event.status = jscStatus;

			return event;
		};

		const dated =
			data.occurrences?.filter((occurrence) => occurrence.start || occurrence.end) ?? [];

		// JSCalendar has no way to hold several occurrences in one Event, so a
		// series becomes a Group rather than losing every occurrence but one.
		if (dated.length > 1) {
			return {
				"@type": "Group",
				uid,
				entries: dated.map((occurrence, index) => buildEvent(occurrence, `${uid}#${index}`)),
			};
		}

		return buildEvent(dated[0] ?? data.occurrences?.[0], uid);
	},
} satisfies FormatConverter<JsonObject>;
