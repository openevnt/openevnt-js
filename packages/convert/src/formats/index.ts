import { icalendar } from "./icalendar.js";
import { activitystreams } from "./activitystreams.js";
import { schemaOrg } from "./schema-org.js";
import { google } from "./google.js";
import { communityLexicon } from "./community-lexicon.js";
import { hEvent } from "./h-event.js";
import { jscalendar } from "./jscalendar.js";
import { jcal } from "./jcal.js";

export const formats = {
	icalendar,
	activitystreams,
	schemaOrg,
	google,
	communityLexicon,
	hEvent,
	jscalendar,
	jcal,
} as const;

export type FormatId = keyof typeof formats;
export type Format = (typeof formats)[FormatId];

/** Look up a format by file extension (with or without dot). */
export const findByExtension = (ext: string): Format | undefined => {
	const clean = ext.startsWith(".") ? ext.slice(1) : ext;
	for (const fmt of Object.values(formats)) {
		if (fmt.extensions.includes(clean)) return fmt;
	}
	return undefined;
};

/** Look up a format by MIME type. */
export const findByMimeType = (mime: string): Format | undefined => {
	const clean = mime.split(";")[0]!.trim();
	for (const fmt of Object.values(formats)) {
		if (fmt.mimeTypes.includes(clean)) return fmt;
	}
	return undefined;
};
