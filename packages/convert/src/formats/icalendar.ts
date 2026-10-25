import ICAL from "ical.js";
import type { AnyComponent, EventStatus, Occurrence, OpenEvnt, Venue } from "@evnt/types";
import { PartialDate, type PartialDateString } from "@evnt/partial-date";
import { translate, createTranslations } from "../utils/translations.js";
import { findDescription, findLinkUrl, link, plainText } from "../utils/components.js";
import { documentId, nonEmpty } from "../utils/document.js";
import type { FormatConverter, ConvertOptions } from "../types.js";

/**
 * A PartialDate names a wall time in its own zone, so a timed value has to be
 * resolved against that zone rather than read as if it were already UTC. The
 * resulting instant is emitted as UTC because a TZID reference would oblige us
 * to ship a VTIMEZONE, and ical.js carries no timezone database to build one.
 */
export const partialDateToICALTime = (
	value: PartialDateString,
	fill: "first" | "last" = "first",
): ICAL.Time => {
	const date = PartialDate.from(value);

	if (!date.has("time")) {
		const day = date.withPrecision("day", fill);
		return new ICAL.Time(
			{ year: day.year, month: day.month, day: day.day, isDate: true },
			ICAL.Timezone.utcTimezone,
		);
	}

	const utc = new Date(date.startEpochMilliseconds);
	return new ICAL.Time(
		{
			year: utc.getUTCFullYear(),
			month: utc.getUTCMonth() + 1,
			day: utc.getUTCDate(),
			hour: utc.getUTCHours(),
			minute: utc.getUTCMinutes(),
			second: 0,
			isDate: false,
		},
		ICAL.Timezone.utcTimezone,
	);
};

export const icalTimeToPartialDate = (
	icalTime: ICAL.Time,
	tzid: string | undefined,
	fallbackTimeZoneId = "UTC",
): PartialDateString => {
	const fields = {
		year: icalTime.year,
		month: icalTime.month,
		day: icalTime.day,
		...(icalTime.isDate ? {} : { hour: icalTime.hour, minute: icalTime.minute }),
	};
	const zone = tzid ?? icalTime.zone?.tzid;
	try {
		if (zone && zone !== "floating")
			return PartialDate.from({ ...fields, timeZoneId: zone }).toString();
	} catch {}
	return PartialDate.from({ ...fields, timeZoneId: fallbackTimeZoneId }).toString();
};

export const statusToIcal: Record<string, string> = {
	uncertain: "TENTATIVE",
	postponed: "TENTATIVE",
	cancelled: "CANCELLED",
};

export const statusFromIcal: Record<string, EventStatus> = {
	TENTATIVE: "uncertain",
	CANCELLED: "cancelled",
};

const venueLocation = (venue: Venue | undefined, language: string): string | undefined =>
	translate(venue?.name, [language]) ?? venue?.address;

const buildVEvent = (
	data: OpenEvnt,
	occurrence: Occurrence | undefined,
	uid: string,
	groupUid: string | undefined,
	language: string,
): ICAL.Component => {
	const vevent = new ICAL.Component("vevent");
	const summary = translate(data.name, [language]) ?? "Untitled Event";

	const startDate = occurrence?.start ? partialDateToICALTime(occurrence.start, "first") : null;
	let endDate = occurrence?.end ? partialDateToICALTime(occurrence.end, "last") : null;

	// An OpenEvnt end names the last day of the event, where DTEND is exclusive.
	if (!endDate && startDate?.isDate) endDate = startDate.clone();
	if (endDate?.isDate) endDate.adjust(1, 0, 0, 0);

	vevent.addPropertyWithValue("uid", uid);
	vevent.addPropertyWithValue("dtstamp", ICAL.Time.fromJSDate(new Date(), true));
	vevent.addPropertyWithValue("summary", summary);

	if (startDate) vevent.addPropertyWithValue("dtstart", startDate);
	if (endDate) vevent.addPropertyWithValue("dtend", endDate);

	const location = venueLocation(data.venue, language);
	if (location) vevent.addPropertyWithValue("location", location);

	const description =
		findDescription(occurrence?.components, [language]) ??
		findDescription(data.components, [language]);
	if (description) vevent.addPropertyWithValue("description", description.text);

	const url = findLinkUrl(occurrence?.components) ?? findLinkUrl(data.components);
	if (url) vevent.addPropertyWithValue("url", url);

	const status = statusToIcal[occurrence?.status ?? data.status ?? ""];
	if (status) vevent.addPropertyWithValue("status", status);

	if (groupUid) vevent.addPropertyWithValue("related-to", groupUid);

	return vevent;
};

/**
 * Open Evnt enumerates occurrences rather than defining recurrence rules, so
 * each occurrence becomes its own VEVENT. Collapsing them into one span would
 * bury the gaps between them, along with the status each carries.
 */
export const buildVEvents = (data: OpenEvnt, opts?: ConvertOptions): ICAL.Component[] => {
	const language = opts?.language ?? "en";
	const occurrences: (Occurrence | undefined)[] = data.occurrences?.length
		? data.occurrences
		: [undefined];
	const series = occurrences.length > 1;
	// Clients treat a repeated UID as the same event, so this cannot be random.
	const uid = opts?.uid ?? data.id;

	return occurrences.map((occurrence, index) =>
		buildVEvent(
			data,
			occurrence,
			series ? `${uid}#${index}` : uid,
			series ? uid : undefined,
			language,
		),
	);
};

export const buildVCalendar = (vevents: ICAL.Component[]): ICAL.Component => {
	const vcalendar = new ICAL.Component("vcalendar");
	vcalendar.addPropertyWithValue("version", "2.0");
	vcalendar.addPropertyWithValue("prodid", "-//Open Evnt//@evnt/convert//EN");
	vcalendar.addPropertyWithValue("calscale", "GREGORIAN");
	for (const vevent of vevents) vcalendar.addSubcomponent(vevent);
	return vcalendar;
};

const statusOf = (vevent: ICAL.Component): EventStatus | undefined =>
	statusFromIcal[((vevent.getFirstPropertyValue("status") as string | null) ?? "").toUpperCase()];

/** Reads every VEVENT in the calendar back into one event's occurrences. */
export const readVCalendar = (vcalendar: ICAL.Component, opts?: ConvertOptions): OpenEvnt => {
	const language = opts?.language ?? "en";
	const fallbackTimeZoneId = opts?.timezone ?? "UTC";
	const vevents = vcalendar.getAllSubcomponents("vevent");
	const first = vevents[0];
	if (!first) throw new Error("No VEVENT found in calendar input");

	const status = statusOf(first);
	const occurrences: Occurrence[] = [];
	let location: string | undefined;

	for (const vevent of vevents) {
		location ??= vevent
			.getAllProperties("location")
			.map((prop) => prop.getFirstValue())
			.find((value): value is string => typeof value === "string" && value.trim() !== "");

		const start = vevent.getFirstPropertyValue("dtstart");
		if (!(start instanceof ICAL.Time)) continue;
		const tzidOf = (name: string) =>
			vevent.getFirstProperty(name)?.getParameter("tzid") as string | undefined;

		const end = vevent.getFirstPropertyValue("dtend");
		let last: ICAL.Time | undefined;
		if (end instanceof ICAL.Time) {
			last = end.clone();
			// DTEND is exclusive, where an OpenEvnt end names the last day itself.
			if (last.isDate) last.adjust(-1, 0, 0, 0);
		}

		occurrences.push({
			start: icalTimeToPartialDate(start, tzidOf("dtstart"), fallbackTimeZoneId),
			end: last ? icalTimeToPartialDate(last, tzidOf("dtend"), fallbackTimeZoneId) : undefined,
			...(statusOf(vevent) === "cancelled" && status !== "cancelled"
				? { status: "cancelled" as const }
				: {}),
		});
	}

	const components: AnyComponent[] = [];

	const description = first.getFirstPropertyValue("description") as string | null;
	if (description) components.push(plainText(description, language));

	for (const prop of first.getAllProperties("url")) {
		const url = prop.getFirstValue();
		if (typeof url === "string") components.push(link(url, undefined, language));
	}

	return {
		v: "0.2",
		id: documentId(opts),
		name: createTranslations(first.getFirstPropertyValue("summary") as string | null, language) ?? {
			[language]: "Untitled Event",
		},
		status,
		venue: location ? { name: { [language]: location } } : undefined,
		occurrences: nonEmpty(occurrences),
		components: nonEmpty(components),
	};
};

export const icalendar = {
	name: "iCalendar",
	description: "RFC 5545 iCalendar format (.ics)",
	extensions: ["ics", "ical", "ifb"],
	mimeTypes: ["text/calendar"],

	to: (data: OpenEvnt, opts?: ConvertOptions): string =>
		buildVCalendar(buildVEvents(data, opts)).toString(),

	from: (input: string, opts?: ConvertOptions): OpenEvnt =>
		readVCalendar(new ICAL.Component(ICAL.parse(input)), opts),
} satisfies FormatConverter<string>;
