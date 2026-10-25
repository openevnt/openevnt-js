import type { OpenEvnt } from "@evnt/types";
import { PartialDate, type PartialDateString } from "@evnt/partial-date";
import { createTranslations } from "../utils/translations.js";
import { asNonEmptyString } from "../utils/text.js";
import { addDays, parseDateString } from "../utils/date.js";
import { documentId } from "../utils/document.js";
import type { FormatConverter, ConvertOptions } from "../types.js";

export interface GoogleCalendarEvent {
	summary?: string | null;
	location?: string | null;
	start?: { date?: string | null; dateTime?: string | null; timeZone?: string | null } | null;
	end?: { date?: string | null; dateTime?: string | null; timeZone?: string | null } | null;
	[key: string]: unknown;
}

export const google = {
	name: "Google Calendar",
	description: "Google Calendar API event format (JSON)",
	extensions: ["json"],
	mimeTypes: ["application/json"],

	from: (data: GoogleCalendarEvent, opts?: ConvertOptions): OpenEvnt => {
		const lang = opts?.language ?? "en";
		const location = asNonEmptyString(data.location);

		const asPartialDate = (time: GoogleCalendarEvent["start"]): PartialDateString | undefined => {
			const timeZoneId = time?.timeZone ?? opts?.timezone ?? "UTC";
			if (time?.dateTime) return parseDateString(time.dateTime, timeZoneId);
			if (time?.date) return parseDateString(time.date, timeZoneId);
			return undefined;
		};

		const start = asPartialDate(data.start);
		let end = asPartialDate(data.end);
		// Google Calendar gives an all-day event's end as the day after its last day.
		if (end && !data.end?.dateTime)
			end = addDays(PartialDate.from(end).withPrecision("day"), -1).toString();

		return {
			v: "0.2",
			id: documentId(opts),
			name: createTranslations(data.summary, lang) ?? { [lang]: "No Title" },
			venue: location ? { name: { [lang]: location } } : undefined,
			occurrences: start || end ? [{ start, end }] : undefined,
		};
	},
} satisfies FormatConverter<GoogleCalendarEvent>;
