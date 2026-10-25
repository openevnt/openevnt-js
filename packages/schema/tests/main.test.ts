import { describe, expect, test } from "vitest";
import { OpenEvntValidator } from "../src/index";

const event = (fields: Record<string, unknown> = {}) => ({
	v: "0.2",
	id: "https://example.com/events/vilnius-game-jam-2026",
	name: { en: "Vilnius Game Jam 2026" },
	...fields,
});

test("basic parsing", () => {
	expect(() => OpenEvntValidator.parse({})).toThrow();

	expect(() => OpenEvntValidator.parse(event())).not.toThrow();
	expect(() => OpenEvntValidator.parse(event({ v: "0.1" }))).toThrow();
	expect(() => OpenEvntValidator.parse(event({ id: "events/vilnius-game-jam-2026" }))).toThrow();
	expect(() => OpenEvntValidator.parse(event({ label: { en: "GameOn" } }))).toThrow();
});

test("AT Protocol record type", () => {
	expect(() => OpenEvntValidator.parse(event({ $type: "directory.evnt.event" }))).not.toThrow();
	expect(() =>
		OpenEvntValidator.parse(event({ $type: "community.lexicon.calendar.event" })),
	).toThrow();
});

describe("translations", () => {
	test("at least one language", () => {
		expect(() => OpenEvntValidator.parse(event({ name: {} }))).toThrow();
	});

	test("language tags differing only in case", () => {
		expect(() =>
			OpenEvntValidator.parse(event({ name: { en: "Game Jam", EN: "Game Jam" } })),
		).toThrow();
	});
});

describe("occurrences", () => {
	test("dates", () => {
		expect(() =>
			OpenEvntValidator.parse(
				event({
					occurrences: [
						{ start: "2026-11-14T10:00[Europe/Vilnius]", end: "2026-11-15[Europe/Vilnius]" },
					],
				}),
			),
		).not.toThrow();

		expect(() =>
			OpenEvntValidator.parse(event({ occurrences: [{ start: "2026-02-29[Europe/Vilnius]" }] })),
		).toThrow();

		expect(() =>
			OpenEvntValidator.parse(event({ occurrences: [{ start: "2026-11-14[Europe/Atlantis]" }] })),
		).toThrow();
	});

	test("start not after end", () => {
		expect(() =>
			OpenEvntValidator.parse(
				event({
					occurrences: [
						{ start: "2025-11-12[Europe/London]", end: "2025-11-12T18:00[Europe/London]" },
					],
				}),
			),
		).not.toThrow();

		expect(() =>
			OpenEvntValidator.parse(
				event({
					occurrences: [
						{ start: "2026-11-15[Europe/Vilnius]", end: "2026-11-14T18:00[Europe/Vilnius]" },
					],
				}),
			),
		).toThrow("occurrences.0.start: must not be after end");
	});

	test("only cancelled as status", () => {
		expect(() =>
			OpenEvntValidator.parse(event({ occurrences: [{ status: "cancelled" }] })),
		).not.toThrow();
		expect(() =>
			OpenEvntValidator.parse(event({ occurrences: [{ status: "postponed" }] })),
		).toThrow();
	});
});

describe("venue", () => {
	test("not empty", () => {
		expect(() => OpenEvntValidator.parse(event({ venue: {} }))).toThrow();
		expect(() => OpenEvntValidator.parse(event({ venue: { address: "Vilnius" } }))).not.toThrow();
	});

	test("at most one coordinates component", () => {
		const coordinates = {
			$type: "directory.evnt.component.coordinates#0",
			latitude: 54.68,
			longitude: 25.28,
		};

		expect(() =>
			OpenEvntValidator.parse(event({ venue: { components: [coordinates] } })),
		).not.toThrow();

		expect(() =>
			OpenEvntValidator.parse(event({ venue: { components: [coordinates, coordinates] } })),
		).toThrow();
	});
});

describe("components", () => {
	test("known link component validated", () => {
		expect(() =>
			OpenEvntValidator.parse(
				event({ components: [{ $type: "directory.evnt.component.link#0", missing: "url field" }] }),
			),
		).toThrow();

		expect(() =>
			OpenEvntValidator.parse(
				event({
					components: [{ $type: "directory.evnt.component.link#0", url: "https://example.com" }],
				}),
			),
		).not.toThrow();
	});

	test("text content in several languages", () => {
		expect(() =>
			OpenEvntValidator.parse(
				event({
					components: [
						{
							$type: "directory.evnt.text.markdown#0",
							content: { en: "Two **days**", lt: "Dvi **dienos**" },
						},
					],
				}),
			),
		).not.toThrow();

		expect(() =>
			OpenEvntValidator.parse(
				event({ components: [{ $type: "directory.evnt.text.plain#0", content: "Two days" }] }),
			),
		).toThrow();
	});

	test("unknown components", () => {
		const parsed = OpenEvntValidator.parse(
			event({ components: [{ $type: "com.example.ticketTier#0", some: "data" }] }),
		);
		expect(parsed.components![0]).toEqual({ $type: "com.example.ticketTier#0", some: "data" });
	});

	test("type needs a reverse domain name and a version", () => {
		expect(() =>
			OpenEvntValidator.parse(event({ components: [{ $type: "test-component#0" }] })),
		).toThrow();

		expect(() =>
			OpenEvntValidator.parse(event({ components: [{ $type: "com.example.ticketTier" }] })),
		).toThrow();

		expect(() =>
			OpenEvntValidator.parse(event({ components: [{ $type: "com.example.ticketTier#01" }] })),
		).toThrow();
	});
});
