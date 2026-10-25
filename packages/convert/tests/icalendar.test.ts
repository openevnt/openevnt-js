import { describe, expect, test } from "vitest";
import type { OpenEvnt } from "@evnt/types";
import { icalendar } from "../src/formats/icalendar";
import { expectValid } from "./valid";

const { from, to } = icalendar;
const convertFromICalendar = from;
const convertToICalendar = to;

const timedEvent: OpenEvnt = {
	v: "0.2",
	id: "https://example.com/meetup.evnt.json",
	name: { en: "Evening Meetup" },
	venue: { name: { en: "Hezarfen Pub" } },
	occurrences: [
		{
			start: "2026-09-06T18:00[Europe/Istanbul]",
			end: "2026-09-06T22:00[Europe/Istanbul]",
		},
	],
};

const allDayEvent: OpenEvnt = {
	v: "0.2",
	id: "https://example.com/festival.evnt.json",
	name: { en: "Weekend Festival" },
	occurrences: [{ start: "2026-08-15[UTC]", end: "2026-08-16[UTC]" }],
};

const series: OpenEvnt = {
	v: "0.2",
	id: "https://example.com/weekly.evnt.json",
	name: { en: "Weekly Meetup" },
	venue: { name: { en: "Hall A" } },
	occurrences: [
		{ start: "2026-06-01T09:00[UTC]", end: "2026-06-01T17:00[UTC]" },
		{ status: "cancelled", start: "2026-06-08T09:00[UTC]", end: "2026-06-08T17:00[UTC]" },
		{ start: "2026-06-15T09:00[UTC]", end: "2026-06-15T17:00[UTC]" },
	],
};

const propertyLine = (ics: string, name: string): string | undefined =>
	ics.split("\r\n").find((line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`));

describe("icalendar converter", () => {
	test("wraps the event in a VCALENDAR envelope", () => {
		const ics = convertToICalendar(timedEvent);

		expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
		expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
		expect(propertyLine(ics, "VERSION")).toBe("VERSION:2.0");
		expect(propertyLine(ics, "PRODID")).toBeDefined();
	});

	test("emits the UID and DTSTAMP every VEVENT is required to carry", () => {
		const ics = convertToICalendar(timedEvent);

		expect(propertyLine(ics, "UID")).toBeDefined();
		expect(propertyLine(ics, "DTSTAMP")).toBeDefined();
	});

	test("uses the event id as the UID", () => {
		expect(propertyLine(convertToICalendar(timedEvent), "UID")).toBe(
			"UID:https://example.com/meetup.evnt.json",
		);
	});

	test("takes the UID from the options when one is supplied", () => {
		const ics = convertToICalendar(timedEvent, { uid: "at://did:plc:example/event/1" });

		expect(propertyLine(ics, "UID")).toBe("UID:at://did:plc:example/event/1");
	});

	test("resolves a wall time against the zone the PartialDate carries", () => {
		const ics = convertToICalendar(timedEvent);

		// 18:00 in Europe/Istanbul is 15:00 UTC
		expect(propertyLine(ics, "DTSTART")).toBe("DTSTART:20260906T150000Z");
		expect(propertyLine(ics, "DTEND")).toBe("DTEND:20260906T190000Z");
	});

	test("ends an all-day event on the day after its last, since DTEND is exclusive", () => {
		const ics = convertToICalendar(allDayEvent);

		expect(propertyLine(ics, "DTSTART")).toBe("DTSTART;VALUE=DATE:20260815");
		expect(propertyLine(ics, "DTEND")).toBe("DTEND;VALUE=DATE:20260817");
	});

	test("gives a single-day event a full day of elapsed time", () => {
		const ics = convertToICalendar({
			v: "0.2",
			id: "https://example.com/one-day.evnt.json",
			name: { en: "One Day Only" },
			occurrences: [{ start: "2026-08-15[UTC]" }],
		});

		expect(propertyLine(ics, "DTSTART")).toBe("DTSTART;VALUE=DATE:20260815");
		expect(propertyLine(ics, "DTEND")).toBe("DTEND;VALUE=DATE:20260816");
	});

	test("round-trips an all-day event without shifting its end", () => {
		const result = convertFromICalendar(convertToICalendar(allDayEvent));

		expectValid(result);
		expect(result.occurrences).toEqual([{ start: "2026-08-15[UTC]", end: "2026-08-16[UTC]" }]);
	});

	test("round-trips a timed event to the same instant", () => {
		const result = convertFromICalendar(convertToICalendar(timedEvent));

		expectValid(result);
		expect(result.occurrences).toEqual([
			{ start: "2026-09-06T15:00[UTC]", end: "2026-09-06T19:00[UTC]" },
		]);
	});

	test("carries the venue, description and link across", () => {
		const ics = convertToICalendar({
			...timedEvent,
			components: [
				{ $type: "directory.evnt.text.markdown#0", content: { en: "Come along." } },
				{ $type: "directory.evnt.component.link#0", url: "https://example.com/meetup" },
			],
		});

		expect(propertyLine(ics, "LOCATION")).toBe("LOCATION:Hezarfen Pub");
		expect(propertyLine(ics, "DESCRIPTION")).toBe("DESCRIPTION:Come along.");
		expect(propertyLine(ics, "URL")).toBe("URL:https://example.com/meetup");
	});

	test("gives each occurrence its own VEVENT rather than one covering span", () => {
		const ics = convertToICalendar(series);
		const starts = ics.split("\r\n").filter((line) => line.startsWith("DTSTART"));

		expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
		expect(starts).toEqual([
			"DTSTART:20260601T090000Z",
			"DTSTART:20260608T090000Z",
			"DTSTART:20260615T090000Z",
		]);
	});

	test("gives each occurrence of a series a distinct UID", () => {
		const uids = convertToICalendar(series)
			.split("\r\n")
			.filter((line) => line.startsWith("UID:"));

		expect(new Set(uids).size).toBe(3);
	});

	test("suffixes a supplied UID with the occurrence index", () => {
		const uids = convertToICalendar(series, { uid: "at://did:plc:example/event/1" })
			.split("\r\n")
			.filter((line) => line.startsWith("UID:"));

		expect(uids).toEqual([
			"UID:at://did:plc:example/event/1#0",
			"UID:at://did:plc:example/event/1#1",
			"UID:at://did:plc:example/event/1#2",
		]);
	});

	test("groups the occurrences of a series with a shared RELATED-TO", () => {
		const related = convertToICalendar(series, { uid: "at://did:plc:example/event/1" })
			.split("\r\n")
			.filter((line) => line.startsWith("RELATED-TO:"));

		expect(related).toEqual([
			"RELATED-TO:at://did:plc:example/event/1",
			"RELATED-TO:at://did:plc:example/event/1",
			"RELATED-TO:at://did:plc:example/event/1",
		]);
	});

	test("leaves a single-occurrence event ungrouped", () => {
		expect(convertToICalendar(timedEvent)).not.toContain("RELATED-TO");
	});

	test("puts the venue on every occurrence", () => {
		const locations = convertToICalendar(series)
			.split("\r\n")
			.filter((line) => line.startsWith("LOCATION:"));

		expect(locations).toEqual(["LOCATION:Hall A", "LOCATION:Hall A", "LOCATION:Hall A"]);
	});

	test("falls back to the address when the venue has no name", () => {
		const ics = convertToICalendar({ ...timedEvent, venue: { address: "Laisvės pr. 5, Vilnius" } });

		expect(propertyLine(ics, "LOCATION")).toBe("LOCATION:Laisvės pr. 5\\, Vilnius");
	});

	test("carries the status of an individual occurrence", () => {
		const statuses = convertToICalendar(series)
			.split("\r\n")
			.filter((line) => line.startsWith("STATUS:") || line === "END:VEVENT");

		expect(statuses).toEqual(["END:VEVENT", "STATUS:CANCELLED", "END:VEVENT", "END:VEVENT"]);
	});

	test("round-trips a series back into separate occurrences", () => {
		const result = convertFromICalendar(convertToICalendar(series));

		expectValid(result);
		expect(result.occurrences).toHaveLength(3);
		expect(result.occurrences?.[0]?.start).toBe("2026-06-01T09:00[UTC]");
		expect(result.occurrences?.[2]?.start).toBe("2026-06-15T09:00[UTC]");
		expect(result.status).toBeUndefined();
		expect(result.occurrences?.[1]?.status).toBe("cancelled");
		expect(result.occurrences?.[0]?.status).toBeUndefined();
		expect(result.venue).toEqual({ name: { en: "Hall A" } });
	});

	test("reads a wall time in the zone its TZID names", () => {
		const result = convertFromICalendar(
			[
				"BEGIN:VCALENDAR",
				"VERSION:2.0",
				"BEGIN:VEVENT",
				"UID:1",
				"SUMMARY:Zoned",
				"DTSTART;TZID=Europe/Vilnius:20261114T180000",
				"END:VEVENT",
				"BEGIN:VEVENT",
				"UID:2",
				"SUMMARY:Zoned",
				"DTSTART;TZID=FLE Standard Time:20261121T180000",
				"END:VEVENT",
				"BEGIN:VEVENT",
				"UID:3",
				"SUMMARY:Zoned",
				"DTSTART:20261128T180000",
				"END:VEVENT",
				"END:VCALENDAR",
			].join("\r\n"),
			{ timezone: "Europe/Riga" },
		);

		expect(result.occurrences?.map((occurrence) => occurrence.start)).toEqual([
			"2026-11-14T18:00[Europe/Vilnius]",
			"2026-11-21T18:00[Europe/Riga]",
			"2026-11-28T18:00[Europe/Riga]",
		]);
	});

	test("throws when the input holds no VEVENT", () => {
		expect(() => convertFromICalendar("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR")).toThrow(
			"No VEVENT found",
		);
	});
});
