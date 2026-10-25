import { describe, expect, test } from "vitest";
import { communityLexicon } from "../src/formats/community-lexicon";
import { expectValid } from "./valid";

const convertFromLexicon = communityLexicon.from;

describe("community lexicon converter", () => {
	test("merges the physical locations into one venue", () => {
		const event = convertFromLexicon(
			{
				name: "Open Evnt Meetup",
				startsAt: "2026-07-10T15:30:00.000Z",
				endsAt: "2026-07-10T18:00:00.000Z",
				status: "community.lexicon.calendar.event#postponed",
				description: "Weekly gathering.",
				locations: [
					{
						$type: "community.lexicon.calendar.event#uri",
						uri: "https://meet.example.com",
						name: "Call",
					},
					{
						$type: "community.lexicon.location.address",
						name: "Community Hall",
						street: "Main St 1",
						locality: "Vilnius",
						country: "lt",
					},
					{ $type: "community.lexicon.location.geo", latitude: "54.68", longitude: "25.28" },
					{ $type: "community.lexicon.location.fsq", fsq_place_id: "4b5d" },
				],
				uris: [{ uri: "https://example.com/meetup", name: "Event page" }],
			},
			{ timezone: "Europe/Vilnius" },
		);

		expectValid(event);
		expect(event.status).toBe("postponed");
		expect(event.occurrences).toEqual([
			{ start: "2026-07-10T18:30[Europe/Vilnius]", end: "2026-07-10T21:00[Europe/Vilnius]" },
		]);
		expect(event.venue).toEqual({
			name: { en: "Community Hall" },
			address: "Main St 1 Vilnius",
			countryCode: "LT",
			components: [
				{ $type: "directory.evnt.component.coordinates#0", latitude: 54.68, longitude: 25.28 },
				{ $type: "directory.evnt.component.placeId#0", type: "com.foursquare", id: "4b5d" },
			],
		});
		expect(event.components).toEqual([
			{
				$type: "directory.evnt.component.link#0",
				url: "https://meet.example.com",
				name: { en: "Call" },
			},
			{
				$type: "directory.evnt.component.link#0",
				url: "https://example.com/meetup",
				name: { en: "Event page" },
			},
			{ $type: "directory.evnt.text.plain#0", content: { en: "Weekly gathering." } },
		]);
	});

	test("points media at the blob of the given DID", () => {
		const event = convertFromLexicon(
			{
				name: "Poster",
				media: [
					{
						role: "poster",
						alt: "The poster",
						content: { $type: "blob", ref: { $link: "bafy" }, size: 1, mimeType: "image/png" },
					},
				],
				additionalData: { tickets: 3 },
			},
			{ did: "did:plc:example" },
		);

		expectValid(event);
		expect(event.venue).toBeUndefined();
		expect(event.components).toEqual([
			{
				$type: "directory.evnt.component.splashMedia#0",
				media: {
					alt: { en: "The poster" },
					sources: [{ mimeType: "image/png", url: "https://blobs.blue/did:plc:example/blob/bafy" }],
				},
				roles: ["poster", "background"],
			},
			{ $type: "community.lexicon.calendar.event.additionalData#0", tickets: 3 },
		]);
	});
});
