import { describe, expect, test } from "vitest";
import { EventBuilder } from "../src/index";
import type { PartialDate } from "@evnt/types";

const date = "2025-01-01[UTC]" as PartialDate;

describe("EventBuilder", () => {
	test("creates an empty event with the current version and a new id", () => {
		const event = new EventBuilder().build();
		expect(event.v).toBe("0.2");
		expect(event.id).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
		expect(event.name).toEqual({});
		expect(new EventBuilder().build().id).not.toBe(event.id);
	});

	test("setId sets the id", () => {
		const event = new EventBuilder().setId("https://example.com/e.evnt.json").build();
		expect(event.id).toBe("https://example.com/e.evnt.json");
	});

	test("setName sets a translation", () => {
		const event = new EventBuilder().setName("My Event", "en").build();
		expect(event.name).toEqual({ en: "My Event" });
	});

	test("setStatus sets and clears the event status", () => {
		const builder = new EventBuilder().setStatus("postponed");
		expect(builder.build().status).toBe("postponed");
		expect(builder.setStatus(undefined).build()).not.toHaveProperty("status");
	});

	test("addOccurrence creates an empty occurrence", () => {
		const event = new EventBuilder().addOccurrence((o) => o).build();
		expect(event.occurrences).toEqual([{}]);
	});

	test("addOccurrence with start date, activity and status", () => {
		const event = new EventBuilder()
			.addOccurrence((o) => o.setStart(date).addActivity("Keynote", "en").setStatus("cancelled"))
			.build();
		expect(event.occurrences).toEqual([
			{ start: date, activities: [{ name: { en: "Keynote" } }], status: "cancelled" },
		]);
	});

	test("setVenue builds the one venue", () => {
		const event = new EventBuilder()
			.setVenue((v) =>
				v
					.setName("LITEXPO", "en")
					.setAddress("Laisvės pr. 5, Vilnius")
					.setCountryCode("lt")
					.setCoordinates(54.69, 25.21)
					.addPlaceId("org.openstreetmap.way", "123"),
			)
			.build();
		expect(event.venue).toEqual({
			name: { en: "LITEXPO" },
			address: "Laisvės pr. 5, Vilnius",
			countryCode: "LT",
			components: [
				{ $type: "directory.evnt.component.coordinates#0", latitude: 54.69, longitude: 25.21 },
				{ $type: "directory.evnt.component.placeId#0", type: "org.openstreetmap.way", id: "123" },
			],
		});
	});

	test("setVenue with a callback edits the venue already there", () => {
		const event = new EventBuilder()
			.setVenue({ address: "Kaunas" })
			.setVenue((v) => v.setCountryCode("LT").setCoordinates(1, 2).setCoordinates(3, 4, 50))
			.build();
		expect(event.venue).toEqual({
			address: "Kaunas",
			countryCode: "LT",
			components: [
				{
					$type: "directory.evnt.component.coordinates#0",
					latitude: 3,
					longitude: 4,
					uncertainty: 50,
				},
			],
		});
	});

	test("addLink creates a link component from string URL", () => {
		const event = new EventBuilder().addLink("https://example.com").build();
		expect(event.components).toEqual([
			{ $type: "directory.evnt.component.link#0", url: "https://example.com" },
		]);
	});

	test("addLink from builder callback", () => {
		const event = new EventBuilder()
			.addLink((l) => l.setUrl("https://example.com").setName("Example", "en"))
			.build();
		expect(event.components![0]).toEqual({
			$type: "directory.evnt.component.link#0",
			url: "https://example.com",
			name: { en: "Example" },
		});
	});

	test("addCustomComponent adds an arbitrary component", () => {
		const event = new EventBuilder()
			.addCustomComponent({ $type: "com.example.custom#0", foo: "bar" })
			.build();
		expect(event.components).toEqual([{ $type: "com.example.custom#0", foo: "bar" }]);
	});

	test("methods are chainable (return EventBuilder)", () => {
		const builder = new EventBuilder();
		expect(builder.setName("Test", "en")).toBe(builder);
		expect(builder.setStatus("uncertain")).toBe(builder);
		expect(builder.setVenue({ address: "Vilnius" })).toBe(builder);
	});

	test("getOccurrence returns an OccurrenceBuilder for existing index", () => {
		const builder = new EventBuilder().addOccurrence((o) => o.setStart(date));
		builder.getOccurrence(0).setEnd(date);
		expect(builder.build().occurrences).toEqual([{ start: date, end: date }]);
	});

	test("getOccurrence throws for out-of-bounds index", () => {
		expect(() => new EventBuilder().getOccurrence(0)).toThrow();
	});
});
