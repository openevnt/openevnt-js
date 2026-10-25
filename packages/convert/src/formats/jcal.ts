import ICAL from "ical.js";
import type { OpenEvnt } from "@evnt/types";
import type { FormatConverter, ConvertOptions } from "../types.js";
import { buildVCalendar, buildVEvents, readVCalendar } from "./icalendar.js";

export type JCalComponent = [name: string, properties: unknown[], components: JCalComponent[]];

export const jcal = {
	name: "JCal",
	description: "RFC 7265 jCal (JSON iCalendar) format",
	extensions: ["json", "jcal"],
	mimeTypes: ["application/jcal+json", "application/json"],

	to: (data: OpenEvnt, opts?: ConvertOptions): JCalComponent =>
		buildVCalendar(buildVEvents(data, opts)).toJSON(),

	from: (data: JCalComponent, opts?: ConvertOptions): OpenEvnt => {
		if (!Array.isArray(data) || data.length < 3 || data[0] !== "vcalendar") {
			throw new Error("Invalid jCal input: expected a vcalendar array");
		}

		return readVCalendar(new ICAL.Component(data), opts);
	},
} satisfies FormatConverter<JCalComponent>;
