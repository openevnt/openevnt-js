import { describe, expect, test } from "vitest";
import type { OpenEvnt } from "@evnt/types";
import { schemaOrg } from "../src/formats/schema-org";
import { expectValid } from "./valid";

const convertFromSchemaOrg = schemaOrg.from;
const convertToSchemaOrg = schemaOrg.to;

describe("schema.org converter", () => {
	test("reads a Place and fixes a WordPress offset", () => {
		const event = convertFromSchemaOrg(
			{
				"@context": "https://schema.org",
				"@type": "Event",
				name: "Tech Conference",
				startDate: "2026-06-15T9:00+3:00",
				endDate: "2026-06-15T18:00:00+03:00",
				location: {
					"@type": "Place",
					name: "LITEXPO",
					address: { streetAddress: "Laisvės pr. 5, Vilnius", addressCountry: "LT" },
				},
			},
			{ timezone: "Europe/Vilnius" },
		);

		expectValid(event);
		expect(event.occurrences).toEqual([
			{ start: "2026-06-15T09:00[Europe/Vilnius]", end: "2026-06-15T18:00[Europe/Vilnius]" },
		]);
		expect(event.venue).toEqual({
			name: { en: "LITEXPO" },
			address: "Laisvės pr. 5, Vilnius",
			countryCode: "LT",
		});
	});

	test("reads dates without a time, including unpadded ones", () => {
		const event = convertFromSchemaOrg(
			{ name: "Fair", startDate: "2026-6-5", endDate: "2026-06-07" },
		);

		expectValid(event);
		expect(event.occurrences).toEqual([{ start: "2026-06-05[UTC]", end: "2026-06-07[UTC]" }]);
	});

	test("turns a VirtualLocation into a link", () => {
		const event = convertFromSchemaOrg(
			{
				name: "Webinar",
				startDate: "2026-06-15",
				location: { "@type": "VirtualLocation", url: "https://example.com/live" },
			},
		);

		expectValid(event);
		expect(event.venue).toBeUndefined();
		expect(event.components).toEqual([
			{ $type: "directory.evnt.component.link#0", url: "https://example.com/live" },
		]);
	});

	test("writes ISO 8601 dates rather than PartialDates", () => {
		const input: OpenEvnt = {
			v: "0.2",
			id: "https://example.com/event.evnt.json",
			name: { en: "Tech Conference" },
			venue: { name: { en: "LITEXPO" }, address: "Laisvės pr. 5, Vilnius" },
			occurrences: [
				{ start: "2026-06-15T09:00[Europe/Vilnius]", end: "2026-06-16[Europe/Vilnius]" },
			],
		};

		const json = convertToSchemaOrg(input);

		expect(json.startDate).toBe("2026-06-15T09:00:00+03:00");
		expect(json.endDate).toBe("2026-06-16");
		expect(json.location).toEqual({
			"@type": "Place",
			name: "LITEXPO",
			address: "Laisvės pr. 5, Vilnius",
		});
	});
});
