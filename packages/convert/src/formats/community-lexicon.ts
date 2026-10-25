import type { AnyComponent, CoordinatesComponent, EventStatus, OpenEvnt, Venue } from "@evnt/types";
import type { CommunityLexiconCalendarEvent } from "../lexicons/index.js";
import { createTranslations } from "../utils/translations.js";
import { asNumber } from "../utils/text.js";
import { parseDateString } from "../utils/date.js";
import { link, plainText } from "../utils/components.js";
import { documentId, nonEmpty } from "../utils/document.js";
import type { FormatConverter, ConvertOptions } from "../types.js";

export interface CommunityLexiconEvent extends CommunityLexiconCalendarEvent.Main {
	media?: Array<{
		$type?: "community.lexicon.calendar.event#media";
		alt?: string;
		role?: string;
		content: {
			$type: "blob";
			ref: { $link: string };
			size: number;
			mimeType: string;
		};
		aspect_ratio?: { width: number; height: number };
	}>;
	additionalData?: Record<string, unknown>;
}

const STATUSES: Record<string, EventStatus> = {
	"community.lexicon.calendar.event#cancelled": "cancelled",
	"community.lexicon.calendar.event#postponed": "postponed",
};

const coordinates = (latitude: unknown, longitude: unknown): CoordinatesComponent | undefined => {
	const lat = asNumber(latitude);
	const long = asNumber(longitude);
	return lat !== undefined && long !== undefined && Math.abs(lat) <= 90 && Math.abs(long) <= 180
		? { $type: "directory.evnt.component.coordinates#0", latitude: lat, longitude: long }
		: undefined;
};

export const communityLexicon = {
	name: "Community Lexicon",
	description: "AT Protocol community lexicon calendar event",
	extensions: ["json"],
	mimeTypes: ["application/json"],

	from: (event: CommunityLexiconEvent, opts?: ConvertOptions): OpenEvnt => {
		const language = opts?.language ?? "en";
		const timeZoneId = opts?.timezone ?? "UTC";

		const components: AnyComponent[] = [];
		const venueComponents: AnyComponent[] = [];
		let venue: Venue = {};

		for (const location of event.locations ?? []) {
			const name = "name" in location ? location.name : undefined;
			if (location.$type === "community.lexicon.calendar.event#uri") {
				components.push(link(location.uri, name, language));
				continue;
			}
			venue.name ??= createTranslations(name, language);
			switch (location.$type) {
				case "community.lexicon.location.address":
					venue.address ??=
						[location.street, location.locality, location.region].filter(Boolean).join(" ") ||
						undefined;
					if (/^[A-Za-z]{2}$/.test(location.country))
						venue.countryCode ??= location.country.toUpperCase();
					break;
				case "community.lexicon.location.fsq": {
					venueComponents.push({
						$type: "directory.evnt.component.placeId#0",
						type: "com.foursquare",
						id: location.fsq_place_id,
					});
					const place = coordinates(location.latitude, location.longitude);
					if (place) venueComponents.push(place);
					break;
				}
				case "community.lexicon.location.geo": {
					const place = coordinates(location.latitude, location.longitude);
					if (place) venueComponents.push(place);
					break;
				}
			}
		}

		const firstCoordinates = venueComponents.find(
			(component) => component.$type === "directory.evnt.component.coordinates#0",
		);
		venue.components = nonEmpty(
			venueComponents.filter(
				(component) =>
					component.$type !== "directory.evnt.component.coordinates#0" ||
					component === firstCoordinates,
			),
		);

		const start = event.startsAt ? parseDateString(event.startsAt, timeZoneId) : undefined;
		const end = event.endsAt ? parseDateString(event.endsAt, timeZoneId) : undefined;

		for (const uri of event.uris ?? []) components.push(link(uri.uri, uri.name, language));

		for (const media of event.media ?? []) {
			components.push({
				$type: "directory.evnt.component.splashMedia#0",
				media: {
					alt: createTranslations(media.alt, language),
					sources: [
						{
							mimeType: media.content.mimeType,
							url: opts?.did
								? `https://blobs.blue/${opts.did}/blob/${media.content.ref.$link}`
								: `at://${media.content.ref.$link}`,
						},
					],
				},
				roles: [...new Set([media.role, "background", "poster"].filter(Boolean) as string[])],
			});
		}

		if (event.description) components.push(plainText(event.description, language));

		if (event.additionalData) {
			components.push({
				$type: "community.lexicon.calendar.event.additionalData#0",
				...event.additionalData,
			});
		}

		const hasVenue = Object.values(venue).some((field) => field !== undefined);

		return {
			v: "0.2",
			id: documentId(opts),
			name: createTranslations(event.name, language) ?? { [language]: "Untitled Event" },
			status: event.status ? STATUSES[event.status] : undefined,
			venue: hasVenue ? venue : undefined,
			occurrences: start || end ? [{ start, end }] : undefined,
			components: nonEmpty(components),
		};
	},
} satisfies FormatConverter<CommunityLexiconEvent>;
