import { describe, expect, test } from "vitest";
import { google } from "../src/formats/google";
import { expectValid } from "./valid";

const convertFromGoogle = google.from;

describe("google converter", () => {
	test("reads a timed event as the wall clock in its time zone", () => {
		const event = convertFromGoogle(
			{
				summary: "Evening Meetup",
				location: "Hezarfen Pub",
				start: { dateTime: "2026-09-06T15:00:00Z", timeZone: "Europe/Istanbul" },
				end: { dateTime: "2026-09-06T22:00:00+03:00", timeZone: "Europe/Istanbul" },
			},
		);

		expectValid(event);
		expect(event.name).toEqual({ en: "Evening Meetup" });
		expect(event.venue).toEqual({ name: { en: "Hezarfen Pub" } });
		expect(event.occurrences).toEqual([
			{ start: "2026-09-06T18:00[Europe/Istanbul]", end: "2026-09-06T22:00[Europe/Istanbul]" },
		]);
	});

	test("ends an all-day event on its last day rather than the day after", () => {
		const event = convertFromGoogle(
			{
				summary: "Weekend Festival",
				start: { date: "2026-08-15" },
				end: { date: "2026-08-17" },
			},
		);

		expectValid(event);
		expect(event.occurrences).toEqual([{ start: "2026-08-15[UTC]", end: "2026-08-16[UTC]" }]);
	});

	test("names an event without a summary", () => {
		const event = convertFromGoogle({ start: { date: "2026-08-15" } });

		expectValid(event);
		expect(event.name).toEqual({ en: "No Title" });
	});
});
