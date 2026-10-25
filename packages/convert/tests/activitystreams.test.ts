import { describe, expect, test } from "vitest";
import type { OpenEvnt } from "@evnt/types";
import { activitystreams } from "../src/formats/activitystreams";
import { expectValid } from "./valid";

const { from, to } = activitystreams;
const convertFromActivityStreamsEvent = from;
const convertToActivityStreamsEvent = to;

const meetup = {
	type: "Event",
	name: "Open Evnt Meetup",
	startTime: "2026-07-10T18:30:00+03:00",
	endTime: "2026-07-10T21:00:00+03:00",
	location: {
		type: "Place",
		name: "Community Hall",
		latitude: 54.68,
		longitude: 25.28,
		address: {
			streetAddress: "Main St 1",
			addressCountry: "lt",
		},
	},
	url: ["https://example.com/events/open-evnt-meetup"],
	content: "Weekly gathering for local organizers.",
};

describe("activitystreams converter", () => {
	test("converts ActivityStreams Event into OpenEvnt", () => {
		const eventData = convertFromActivityStreamsEvent(meetup);

		expectValid(eventData);
		expect(eventData.v).toBe("0.2");
		expect(eventData.id).toMatch(/^urn:uuid:/);
		expect(eventData.name.en).toBe("Open Evnt Meetup");
		expect(eventData.occurrences).toEqual([
			{ start: "2026-07-10T15:30[UTC]", end: "2026-07-10T18:00[UTC]" },
		]);
		expect(eventData.venue).toEqual({
			name: { en: "Community Hall" },
			address: "Main St 1",
			countryCode: "LT",
			components: [
				{ $type: "directory.evnt.component.coordinates#0", latitude: 54.68, longitude: 25.28 },
			],
		});
		expect(eventData.components).toEqual([
			{
				$type: "directory.evnt.component.link#0",
				url: "https://example.com/events/open-evnt-meetup",
			},
			{
				$type: "directory.evnt.text.markdown#0",
				content: { en: "Weekly gathering for local organizers." },
			},
		]);
	});

	test("reads times into the zone and id it is given", () => {
		const eventData = convertFromActivityStreamsEvent(meetup, {
			timezone: "Europe/Vilnius",
			id: "https://example.com/events/meetup.evnt.json",
		});

		expect(eventData.id).toBe("https://example.com/events/meetup.evnt.json");
		expect(eventData.occurrences?.[0]).toEqual({
			start: "2026-07-10T18:30[Europe/Vilnius]",
			end: "2026-07-10T21:00[Europe/Vilnius]",
		});
	});

	test("maps online locations to links and reads a date-only startTime", () => {
		const eventData = convertFromActivityStreamsEvent(
			{
				type: "Event",
				name: "Livestream",
				startTime: "2026-08-01",
				location: {
					type: "Link",
					name: "YouTube",
					href: "https://youtube.com/live/abc",
				},
			},
		);

		expectValid(eventData);
		expect(eventData.occurrences?.[0]?.start).toBe("2026-08-01[UTC]");
		expect(eventData.venue).toBeUndefined();
		expect(eventData.components).toEqual([
			{
				$type: "directory.evnt.component.link#0",
				url: "https://youtube.com/live/abc",
				name: { en: "YouTube" },
			},
		]);
	});

	test("embeds canonical OpenEvnt when converting to ActivityStreams", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/conference.evnt.json",
			name: { en: "Conference" },
			occurrences: [{ start: "2026-09-20[Europe/Vilnius]" }],
		};

		const asEvent = convertToActivityStreamsEvent(input);

		expect(asEvent.type).toBe("Event");
		expect(asEvent.name).toBe("Conference");
		expect(asEvent.startTime).toBeUndefined();
		expect(asEvent.evntPartialStart).toBe("2026-09-20[Europe/Vilnius]");
		expect(asEvent.evntData).toEqual(input);
	});

	test("writes a timed start with the offset of its zone", () => {
		const asEvent = convertToActivityStreamsEvent({
				v: "0.2",
				id: "https://example.com/conference.evnt.json",
				name: { en: "Conference" },
				venue: { name: { en: "LITEXPO" }, address: "Laisvės pr. 5, Vilnius" },
				occurrences: [{ start: "2026-09-20T18:00[Europe/Vilnius]" }],
			});

		expect(asEvent.startTime).toBe("2026-09-20T18:00:00+03:00");
		expect(asEvent.location).toEqual({
			type: "Place",
			name: "LITEXPO",
			address: "Laisvės pr. 5, Vilnius",
		});
	});

	test("uses embedded evntData when present and valid", () => {
		const embedded: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/embedded.evnt.json",
			name: { en: "Embedded" },
			components: [{ $type: "com.example.component#0", foo: "bar" }],
		};

		const fromAs = convertFromActivityStreamsEvent(
			{ type: "Event", name: "Ignored name", evntData: embedded },
		);

		expect(fromAs).toEqual(embedded);
	});

	test("converts the ActivityStreams fields when evntData is from an older version", () => {
		const fromAs = convertFromActivityStreamsEvent(
			{
				type: "Event",
				name: "Converted",
				evntData: { v: "0.1", name: { en: "Embedded" } },
			},
		);

		expect(fromAs.name).toEqual({ en: "Converted" });
	});
});
