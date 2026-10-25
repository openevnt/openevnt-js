import { describe, expect, test } from "vitest";
import type { OpenEvnt } from "@evnt/types";
import { jscalendar } from "../src/formats/jscalendar";
import { expectValid } from "./valid";

const { from, to } = jscalendar;
const convertFromJscalendar = from;
const convertToJscalendar = to;

describe("jscalendar converter", () => {
	test("converts JSCalendar Event into OpenEvnt", () => {
		const eventData = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-001@example.com",
				title: "Open Evnt Meetup",
				start: "2026-07-10T18:30:00+03:00",
				end: "2026-07-10T21:00:00+03:00",
				timeZone: "Europe/Vilnius",
				status: "confirmed",
				description: "Weekly gathering for local organizers.",
				descriptionContentType: "text/markdown",
				locations: {
					"loc-1": {
						"@type": "Location",
						name: "Community Hall",
						type: "physical",
						description: "Main St 1, Vilnius",
					},
				},
				links: {
					"link-1": {
						"@type": "Link",
						href: "https://example.com/events/open-evnt-meetup",
						title: "Event page",
					},
				},
			},
		);

		expectValid(eventData);
		expect(eventData.v).toBe("0.2");
		expect(eventData.name.en).toBe("Open Evnt Meetup");
		expect(eventData.status).toBeUndefined();
		expect(eventData.occurrences).toEqual([
			{ start: "2026-07-10T18:30[Europe/Vilnius]", end: "2026-07-10T21:00[Europe/Vilnius]" },
		]);
		expect(eventData.venue).toEqual({
			name: { en: "Community Hall" },
			address: "Main St 1, Vilnius",
		});
		expect(eventData.components).toEqual([
			{
				$type: "directory.evnt.text.markdown#0",
				content: { en: "Weekly gathering for local organizers." },
			},
			{
				$type: "directory.evnt.component.link#0",
				url: "https://example.com/events/open-evnt-meetup",
				name: { en: "Event page" },
			},
		]);
	});

	test("maps virtual locations to links", () => {
		const eventData = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-002@example.com",
				title: "Livestream",
				start: "2026-08-01T12:00:00Z",
				locations: {
					"loc-1": {
						"@type": "Location",
						name: "YouTube Live",
						type: "virtual",
						links: {
							stream: {
								"@type": "Link",
								href: "https://youtube.com/live/abc",
							},
						},
					},
				},
			},
		);

		expectValid(eventData);
		expect(eventData.venue).toBeUndefined();
		expect(eventData.components).toEqual([
			{
				$type: "directory.evnt.component.link#0",
				url: "https://youtube.com/live/abc",
				name: { en: "YouTube Live" },
			},
		]);
	});

	test("handles cancelled and tentative statuses", () => {
		const cancelled = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-003@example.com",
				title: "Cancelled Event",
				start: "2026-09-01T10:00:00Z",
				status: "cancelled",
			},
		);
		expect(cancelled.status).toBe("cancelled");

		const tentative = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-004@example.com",
				title: "Tentative Event",
				start: "2026-09-01T10:00:00Z",
				status: "tentative",
			},
		);
		expect(tentative.status).toBe("uncertain");
	});

	test("computes end from duration when end is absent", () => {
		const eventData = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-005@example.com",
				title: "Workshop",
				start: "2026-10-01T09:00:00Z",
				duration: "PT2H30M",
			},
		);

		expect(eventData.occurrences).toEqual([
			{ start: "2026-10-01T09:00[UTC]", end: "2026-10-01T11:30[UTC]" },
		]);
	});

	test("counts the days of a duration on the wall clock", () => {
		const timed = convertFromJscalendar(
			{
				"@type": "Event",
				title: "Across a clock change",
				start: "2026-10-24T18:00:00",
				timeZone: "Europe/Vilnius",
				duration: "P1DT1H",
			},
		);
		expect(timed.occurrences?.[0]?.end).toBe("2026-10-25T19:00[Europe/Vilnius]");

		const dateless = convertFromJscalendar(
			{
				"@type": "Event",
				title: "Fortnight",
				start: "2026-07-01T00:00:00",
				showWithoutTime: true,
				duration: "P2W",
			},
		);
		expect(dateless.occurrences?.[0]).toEqual({ start: "2026-07-01[UTC]", end: "2026-07-14[UTC]" });
	});

	test("handles showWithoutTime for day-precision events", () => {
		const eventData = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-006@example.com",
				title: "All Day Festival",
				start: "2026-07-15",
				showWithoutTime: true,
			},
		);

		expect(eventData.occurrences?.[0]?.start).toBe("2026-07-15[UTC]");
	});

	test("converts OpenEvnt to JSCalendar", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Tech Conference" },
			occurrences: [
				{
					start: "2026-09-20T10:00[Europe/Vilnius]",
					end: "2026-09-20T18:00[Europe/Vilnius]",
				},
			],
			venue: {
				name: { en: "Conference Center" },
				address: "Konstitucijos pr. 1, Vilnius",
			},
			components: [
				{
					$type: "directory.evnt.text.markdown#0",
					content: { en: "Annual technology conference." },
				},
				{
					$type: "directory.evnt.component.link#0",
					url: "https://techconf.example.com",
				},
			],
		};

		const jsc = convertToJscalendar(input);

		expect(jsc["@type"]).toBe("Event");
		expect(jsc.title).toBe("Tech Conference");
		expect(jsc.uid).toBe("https://example.com/event.evnt.json");
		expect(jsc.start).toBe("2026-09-20T10:00:00");
		expect(jsc.duration).toBe("PT8H");
		expect(jsc.status).toBeUndefined();
		expect(jsc.description).toBe("Annual technology conference.");
		expect(jsc.descriptionContentType).toBe("text/markdown");
		expect(jsc.locations).toBeDefined();
		expect(Object.keys(jsc.locations).length).toBe(1);
		const loc = Object.values(jsc.locations)[0] as Record<string, unknown>;
		expect(loc.name).toBe("Conference Center");
		expect(loc.type).toBe("physical");
		expect(jsc.links).toBeDefined();
		expect(Object.keys(jsc.links).length).toBe(1);
	});

	test("writes a plain text description without a content type", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Webinar" },
			occurrences: [{ start: "2026-11-01T14:00[UTC]" }],
			components: [{ $type: "directory.evnt.text.plain#0", content: { lt: "Vebinaras" } }],
		};

		const jsc = convertToJscalendar(input);

		expect(jsc.description).toBe("Vebinaras");
		expect(jsc.descriptionContentType).toBeUndefined();
		expect(jsc.locations).toBeUndefined();
	});

	test("round-trips a minimal event", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Minimal Event" },
			occurrences: [
				{
					start: "2026-12-25[UTC]",
				},
			],
		};

		const raw = convertToJscalendar(input);
		const roundTripped = convertFromJscalendar(raw);

		expectValid(roundTripped);
		expect(roundTripped.v).toBe("0.2");
		expect(roundTripped.name.en).toBe("Minimal Event");
		expect(roundTripped.occurrences?.[0]?.start).toBe("2026-12-25[UTC]");
	});

	test("round-trips an event with a venue and components", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Full Event", de: "Vollständige Veranstaltung" },
			occurrences: [
				{
					start: "2026-06-15T09:00[Europe/Berlin]",
					end: "2026-06-15T17:00[Europe/Berlin]",
				},
			],
			venue: {
				name: { en: "Main Hall", de: "Haupthalle" },
				address: "Alexanderplatz 1, Berlin",
			},
			components: [
				{
					$type: "directory.evnt.text.markdown#0",
					content: { en: "# Welcome\n\nJoin us for a great event." },
				},
				{
					$type: "directory.evnt.component.link#0",
					url: "https://example.com/register",
					name: { en: "Register here" },
				},
				{
					$type: "directory.evnt.component.source#0",
					url: "https://example.com/source",
				},
			],
		};

		const jsc = convertToJscalendar(input);

		expect(jsc["@type"]).toBe("Event");
		expect(jsc.title).toBe("Full Event");
		expect(jsc.status).toBeUndefined();
		expect(jsc.start).toBe("2026-06-15T09:00:00");
		expect(jsc.duration).toBe("PT8H");
		expect(Object.keys(jsc.locations).length).toBe(1);

		const roundTripped = convertFromJscalendar(jsc);

		expectValid(roundTripped);
		expect(roundTripped.v).toBe("0.2");
		expect(roundTripped.name.en).toBe("Full Event");
		expect(roundTripped.status).toBeUndefined();
		expect(roundTripped.venue).toEqual({
			name: { en: "Main Hall" },
			address: "Alexanderplatz 1, Berlin",
		});
		expect(roundTripped.occurrences).toEqual([
			{ start: "2026-06-15T09:00[Europe/Berlin]", end: "2026-06-15T17:00[Europe/Berlin]" },
		]);
		expect(roundTripped.components).toEqual([
			{
				$type: "directory.evnt.text.markdown#0",
				content: { en: "# Welcome\n\nJoin us for a great event." },
			},
			{
				$type: "directory.evnt.component.link#0",
				url: "https://example.com/register",
				name: { en: "Register here" },
			},
			{ $type: "directory.evnt.component.source#0", url: "https://example.com/source" },
		]);
	});

	test("handles missing title gracefully", () => {
		const eventData = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-007@example.com",
				start: "2026-10-10T10:00:00Z",
			},
		);

		expect(eventData.name.en).toBe("Untitled Event");
	});

	test("handles multiple locations", () => {
		const eventData = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-008@example.com",
				title: "Multi-venue Event",
				start: "2026-10-10T10:00:00Z",
				locations: {
					"loc-1": {
						"@type": "Location",
						name: "Main Stage",
						type: "physical",
					},
					"loc-2": {
						"@type": "Location",
						name: "Online Stream",
						type: "virtual",
						links: {
							stream: {
								"@type": "Link",
								href: "https://stream.example.com",
							},
						},
					},
				},
			},
		);

		expectValid(eventData);
		expect(eventData.venue).toEqual({ name: { en: "Main Stage" } });
		expect(eventData.components).toEqual([
			{
				$type: "directory.evnt.component.link#0",
				url: "https://stream.example.com",
				name: { en: "Online Stream" },
			},
		]);
	});

	test("handles unknown location type", () => {
		const eventData = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-009@example.com",
				title: "Unknown Venue Event",
				start: "2026-10-10T10:00:00Z",
				locations: {
					"loc-1": {
						"@type": "Location",
						name: "Somewhere",
					},
				},
			},
		);

		expect(eventData.venue).toEqual({ name: { en: "Somewhere" } });
	});

	test("uses language option for translations", () => {
		const eventData = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-010@example.com",
				title: "Veranstaltung",
				start: "2026-10-10T10:00:00Z",
			},
			{ language: "de" },
		);

		expect(eventData.name.de).toBe("Veranstaltung");
		expect(eventData.name.en).toBeUndefined();
	});

	test("prefers locale over language option", () => {
		const eventData = convertFromJscalendar(
			{
				"@type": "Event",
				uid: "evt-011@example.com",
				title: "Événement",
				start: "2026-10-10T10:00:00Z",
				locale: "fr",
			},
			{ language: "en" },
		);

		expect(eventData.name.fr).toBe("Événement");
		expect(eventData.name.en).toBeUndefined();
	});

	test("emits a zoneless LocalDateTime with the zone the PartialDate carries", () => {
		const jsc = convertToJscalendar({
				v: "0.2",
				id: "https://example.com/event.evnt.json",
				name: { en: "Evening Meetup" },
				occurrences: [
					{
						start: "2026-09-06T18:00[Europe/Istanbul]",
						end: "2026-09-06T22:00[Europe/Istanbul]",
					},
				],
			});

		expect(jsc.start).toBe("2026-09-06T18:00:00");
		expect(jsc.timeZone).toBe("Europe/Istanbul");
		expect(jsc.duration).toBe("PT4H");
		expect(jsc.end).toBeUndefined();
	});

	test("marks a dateless event with showWithoutTime and whole days", () => {
		const jsc = convertToJscalendar({
				v: "0.2",
				id: "https://example.com/event.evnt.json",
				name: { en: "Weekend Festival" },
				occurrences: [{ start: "2026-08-15[UTC]", end: "2026-08-16[UTC]" }],
			});

		expect(jsc.start).toBe("2026-08-15T00:00:00");
		expect(jsc.showWithoutTime).toBe(true);
		expect(jsc.duration).toBe("P2D");
		expect(jsc.timeZone).toBeUndefined();
	});

	test("round-trips a dateless event without shifting its end", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Weekend Festival" },
			occurrences: [{ start: "2026-08-15[UTC]", end: "2026-08-16[UTC]" }],
		};

		const result = convertFromJscalendar(convertToJscalendar(input));

		expect(result.occurrences?.[0]?.start).toBe("2026-08-15[UTC]");
		expect(result.occurrences?.[0]?.end).toBe("2026-08-16[UTC]");
	});

	test("round-trips a timed event in its own zone", () => {
		const result = convertFromJscalendar(
			convertToJscalendar({
				v: "0.2",
				id: "https://example.com/event.evnt.json",
				name: { en: "Evening Meetup" },
				occurrences: [
					{
						start: "2026-09-06T18:00[Europe/Istanbul]",
						end: "2026-09-06T22:00[Europe/Istanbul]",
					},
				],
			}),
		);

		expect(result.occurrences?.[0]?.start).toBe("2026-09-06T18:00[Europe/Istanbul]");
		expect(result.occurrences?.[0]?.end).toBe("2026-09-06T22:00[Europe/Istanbul]");
	});

	test("keeps every occurrence of a series by emitting a Group", () => {
		const jsc = convertToJscalendar({
				v: "0.2",
				id: "https://example.com/event.evnt.json",
				name: { en: "Weekly Meetup" },
				occurrences: [
					{ start: "2026-06-01T09:00[UTC]", end: "2026-06-01T17:00[UTC]" },
					{ start: "2026-06-08T09:00[UTC]", end: "2026-06-08T17:00[UTC]" },
				],
			});

		expect(jsc["@type"]).toBe("Group");
		expect(jsc.entries).toHaveLength(2);
		expect(jsc.entries[0].start).toBe("2026-06-01T09:00:00");
		expect(jsc.entries[1].start).toBe("2026-06-08T09:00:00");
		expect(jsc.uid).toBe("https://example.com/event.evnt.json");
		expect(jsc.entries[1].uid).toBe("https://example.com/event.evnt.json#1");
	});
});
