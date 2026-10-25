import { describe, expect, test } from "vitest";
import type { OpenEvnt } from "@evnt/types";
import { jcal, type JCalComponent } from "../src/formats/jcal";
import { expectValid } from "./valid";

const { from, to } = jcal;
const convertFromJCal = from;
const convertToJCal = to;

describe("jcal converter", () => {
	test("converts jCal VEVENT into OpenEvnt with a venue", () => {
		const jcalData = [
			"vcalendar",
			[],
			[
				[
					"vevent",
					[
						["summary", {}, "text", "Community Meetup"],
						["dtstart", {}, "date-time", "2026-07-10T15:30:00"],
						["dtend", {}, "date-time", "2026-07-10T18:00:00"],
						["location", {}, "text", "Community Hall, Main St 1"],
						["description", {}, "text", "Weekly gathering for organizers."],
						["url", {}, "uri", "https://example.com/meetup"],
						["status", {}, "text", "CONFIRMED"],
					],
					[],
				],
			],
		];

		const eventData = convertFromJCal(jcalData);

		expectValid(eventData);
		expect(eventData.v).toBe("0.2");
		expect(eventData.name.en).toBe("Community Meetup");
		expect(eventData.occurrences).toEqual([
			{ start: "2026-07-10T15:30[UTC]", end: "2026-07-10T18:00[UTC]" },
		]);
		expect(eventData.venue).toEqual({ name: { en: "Community Hall, Main St 1" } });
		expect(eventData.status).toBeUndefined();
		expect(eventData.components).toEqual([
			{ $type: "directory.evnt.text.plain#0", content: { en: "Weekly gathering for organizers." } },
			{ $type: "directory.evnt.component.link#0", url: "https://example.com/meetup" },
		]);
	});

	test("reads an exclusive all-day DTEND back as the last day of the event", () => {
		const jcalData = [
			"vcalendar",
			[],
			[
				[
					"vevent",
					[
						["summary", {}, "text", "All Day Festival"],
						["dtstart", {}, "date", "2026-08-15"],
						["dtend", {}, "date", "2026-08-16"],
					],
					[],
				],
			],
		];

		const eventData = convertFromJCal(jcalData);

		expect(eventData.name.en).toBe("All Day Festival");
		expect(eventData.occurrences?.[0]?.start).toBe("2026-08-15[UTC]");
		expect(eventData.occurrences?.[0]?.end).toBe("2026-08-15[UTC]");
	});

	test("converts jCal with cancelled status", () => {
		const jcalData = [
			"vcalendar",
			[],
			[
				[
					"vevent",
					[
						["summary", {}, "text", "Cancelled Event"],
						["dtstart", {}, "date", "2026-09-01"],
						["status", {}, "text", "CANCELLED"],
					],
					[],
				],
			],
		];

		const eventData = convertFromJCal(jcalData);

		expect(eventData.status).toBe("cancelled");
	});

	test("converts jCal with tentative status", () => {
		const jcalData = [
			"vcalendar",
			[],
			[
				[
					"vevent",
					[
						["summary", {}, "text", "Tentative Event"],
						["dtstart", {}, "date", "2026-10-01"],
						["status", {}, "text", "TENTATIVE"],
					],
					[],
				],
			],
		];

		const eventData = convertFromJCal(jcalData);

		expect(eventData.status).toBe("uncertain");
	});

	test("throws on invalid jCal input", () => {
		expect(() => convertFromJCal({ not: "jcal" } as unknown as JCalComponent)).toThrow("Invalid jCal input");
	});

	test("throws on jCal without VEVENT", () => {
		expect(() => convertFromJCal(["vcalendar", [], []])).toThrow("No VEVENT found");
	});

	test("converts OpenEvnt to jCal with a venue", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Tech Conference" },
			venue: {
				name: { en: "Convention Center" },
				address: "123 Main St",
				countryCode: "US",
			},
			occurrences: [
				{
					start: "2026-09-20T09:00[America/New_York]",
					end: "2026-09-20T17:00[America/New_York]",
				},
			],
			components: [
				{ $type: "directory.evnt.text.markdown#0", content: { en: "Annual tech conference." } },
				{ $type: "directory.evnt.component.link#0", url: "https://techconf.example.com" },
			],
		};

		const calendar = convertToJCal(input);

		expect(calendar[0]).toBe("vcalendar");
		expect(calendar[2]).toHaveLength(1);

		const vevent = calendar[2][0];
		expect(vevent[0]).toBe("vevent");

		const props = vevent[1];
		const summary = props.find((p: unknown[]) => p[0] === "summary");
		expect(summary?.[3]).toBe("Tech Conference");

		const dtstart = props.find((p: unknown[]) => p[0] === "dtstart");
		expect(dtstart).toBeDefined();

		const location = props.find((p: unknown[]) => p[0] === "location");
		expect(location?.[3]).toBe("Convention Center");

		const url = props.find((p: unknown[]) => p[0] === "url");
		expect(url?.[3]).toBe("https://techconf.example.com");

		const description = props.find((p: unknown[]) => p[0] === "description");
		expect(description?.[3]).toBe("Annual tech conference.");
	});

	test("converts OpenEvnt to jCal without a venue", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Virtual Workshop" },
			components: [{ $type: "directory.evnt.component.link#0", url: "https://zoom.us/j/123456" }],
			occurrences: [
				{
					start: "2026-10-05T14:00[UTC]",
				},
			],
		};

		const calendar = convertToJCal(input);
		const vevent = calendar[2][0];
		const props = vevent[1];

		expect(props.find((p: unknown[]) => p[0] === "location")).toBeUndefined();
		expect(props.find((p: unknown[]) => p[0] === "url")?.[3]).toBe("https://zoom.us/j/123456");

		const summary = props.find((p: unknown[]) => p[0] === "summary");
		expect(summary?.[3]).toBe("Virtual Workshop");
	});

	test("converts OpenEvnt to jCal with date-only precision", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Summer Camp" },
			occurrences: [
				{
					start: "2026-07-01[UTC]",
					end: "2026-07-07[UTC]",
				},
			],
		};

		const calendar = convertToJCal(input);
		const vevent = calendar[2][0];
		const props = vevent[1];

		const dtstart = props.find((p: unknown[]) => p[0] === "dtstart");
		expect(dtstart?.[2]).toBe("date");
	});

	test("converts OpenEvnt to jCal with cancelled status", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Cancelled Show" },
			status: "cancelled",
			occurrences: [
				{
					start: "2026-12-01[UTC]",
				},
			],
		};

		const calendar = convertToJCal(input);
		const vevent = calendar[2][0];
		const props = vevent[1];

		const status = props.find((p: unknown[]) => p[0] === "status");
		expect(status?.[3]).toBe("CANCELLED");
	});

	test("round-trips OpenEvnt → jCal → OpenEvnt with a venue", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Art Exhibition" },
			venue: { name: { en: "City Gallery" } },
			occurrences: [
				{
					start: "2026-11-15T10:00[Europe/London]",
					end: "2026-11-15T20:00[Europe/London]",
				},
			],
			components: [
				{ $type: "directory.evnt.text.markdown#0", content: { en: "Modern art showcase." } },
			],
		};

		const calendar = convertToJCal(input);
		const output = convertFromJCal(calendar);

		expectValid(output);
		expect(output.v).toBe("0.2");
		expect(output.name.en).toBe("Art Exhibition");
		expect(output.occurrences).toEqual([
			{ start: "2026-11-15T10:00[UTC]", end: "2026-11-15T20:00[UTC]" },
		]);
		expect(output.venue).toEqual({ name: { en: "City Gallery" } });
		expect(output.components).toEqual([
			{ $type: "directory.evnt.text.plain#0", content: { en: "Modern art showcase." } },
		]);
	});

	test("round-trips OpenEvnt → jCal → OpenEvnt with an online link", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Webinar" },
			components: [
				{ $type: "directory.evnt.component.link#0", url: "https://youtube.com/live/abc" },
			],
			occurrences: [
				{
					start: "2026-08-20T19:00[UTC]",
				},
			],
		};

		const calendar = convertToJCal(input);
		const output = convertFromJCal(calendar);

		expect(output.name.en).toBe("Webinar");
		expect(output.venue).toBeUndefined();
		expect(output.components).toEqual(input.components);
		expect(output.occurrences?.[0]?.start).toBe("2026-08-20T19:00[UTC]");
	});

	test("round-trips date-only event", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Holiday" },
			occurrences: [
				{
					start: "2026-12-25[UTC]",
				},
			],
		};

		const calendar = convertToJCal(input);
		const output = convertFromJCal(calendar);

		expect(output.name.en).toBe("Holiday");
		expect(output.occurrences?.[0]?.start).toBe("2026-12-25[UTC]");
	});

	test("round-trips a series as one VEVENT per occurrence", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Conference Series" },
			occurrences: [
				{
					start: "2026-06-01T09:00[UTC]",
					end: "2026-06-01T17:00[UTC]",
				},
				{
					start: "2026-06-15T09:00[UTC]",
					end: "2026-06-15T17:00[UTC]",
				},
			],
		};

		const calendar = convertToJCal(input);
		expect(calendar[2]).toHaveLength(2);

		const dtstartOf = (vevent: unknown[]) =>
			(vevent[1] as unknown[][]).find((p) => p[0] === "dtstart")?.[3];
		expect(dtstartOf(calendar[2][0])).toContain("2026-06-01");
		expect(dtstartOf(calendar[2][1])).toContain("2026-06-15");

		const output = convertFromJCal(calendar);
		expect(output.occurrences).toHaveLength(2);
		expect(output.occurrences?.[0]?.start).toBe("2026-06-01T09:00[UTC]");
		expect(output.occurrences?.[1]?.end).toBe("2026-06-15T17:00[UTC]");
	});
});
