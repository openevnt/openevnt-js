import type { AnyComponent, CoordinatesComponent, OpenEvnt, Venue } from "@evnt/types";
import { OpenEvntValidator } from "@evnt/schema";
import { translate, createTranslations } from "../utils/translations.js";
import { isRecord, asArray, asNonEmptyString, asNumber, readUrlLike } from "../utils/text.js";
import { parseDateString, partialDateToIso } from "../utils/date.js";
import {
	findDescription,
	isLink,
	isSource,
	isSplashMedia,
	link,
	markdownText,
} from "../utils/components.js";
import { documentId, nonEmpty } from "../utils/document.js";
import type { FormatConverter, ConvertOptions, JsonObject } from "../types.js";

const coordinates = (
	latitude: number | undefined,
	longitude: number | undefined,
): CoordinatesComponent | undefined =>
	latitude !== undefined &&
	longitude !== undefined &&
	Math.abs(latitude) <= 90 &&
	Math.abs(longitude) <= 180
		? { $type: "directory.evnt.component.coordinates#0", latitude, longitude }
		: undefined;

export const activitystreams = {
	name: "ActivityStreams",
	description: "W3C Activity Streams 2.0 format",
	extensions: ["json"],
	mimeTypes: ["application/activity+json", "application/ld+json"],

	from: (data: JsonObject, opts?: ConvertOptions): OpenEvnt => {
		const language = opts?.language ?? "en";
		const timeZoneId = opts?.timezone ?? "UTC";

		// If there's an embedded canonical OpenEvnt, prefer it
		if (isRecord(data.evntData)) {
			const embedded = OpenEvntValidator.validate(data.evntData);
			if (!embedded.issues) return embedded.value;
		}

		const components: AnyComponent[] = [];
		let venue: Venue | undefined;

		for (const rawLocation of asArray(data.location)) {
			if (typeof rawLocation === "string") {
				venue ??= { name: { [language]: rawLocation } };
				continue;
			}
			if (!isRecord(rawLocation)) continue;

			const locationName = asNonEmptyString(rawLocation.name);
			const locationUrl = readUrlLike(rawLocation.url) ?? readUrlLike(rawLocation);
			const place = coordinates(asNumber(rawLocation.latitude), asNumber(rawLocation.longitude));

			const addressRaw = rawLocation.address;
			const addressLine =
				typeof addressRaw === "string"
					? addressRaw
					: isRecord(addressRaw)
						? (asNonEmptyString(addressRaw.streetAddress) ??
							asNonEmptyString(addressRaw.addressLocality) ??
							asNonEmptyString(addressRaw.name))
						: undefined;
			const countryCodeRaw = isRecord(addressRaw)
				? asNonEmptyString(addressRaw.addressCountry)
				: undefined;
			const countryCode =
				countryCodeRaw && /^[A-Za-z]{2}$/.test(countryCodeRaw)
					? countryCodeRaw.toUpperCase()
					: undefined;

			const type = asNonEmptyString(rawLocation.type)?.toLowerCase();
			const looksOnline = type === "link" || type === "linkobject" || type === "virtualplace";
			const hasPhysicalData =
				place !== undefined || addressLine !== undefined || countryCode !== undefined;

			if (locationUrl && (looksOnline || !hasPhysicalData)) {
				components.push(link(locationUrl, locationName, language));
				continue;
			}

			if (venue || !(locationName || hasPhysicalData)) continue;
			venue = {
				name: createTranslations(locationName, language),
				address: addressLine,
				countryCode,
				components: place ? [place] : undefined,
			};
		}

		const addUrlAsLink = (url: unknown) => {
			const href = readUrlLike(url);
			if (href) components.push(link(href, undefined, language));
		};

		for (const urlValue of asArray(data.url)) addUrlAsLink(urlValue);

		for (const attachment of asArray(data.attachment)) {
			if (typeof attachment === "string") {
				addUrlAsLink(attachment);
				continue;
			}
			if (!isRecord(attachment)) continue;

			const href = readUrlLike(attachment);
			if (!href) continue;

			const mediaType = asNonEmptyString(attachment.mediaType) ?? "";
			const attachmentType = asNonEmptyString(attachment.type)?.toLowerCase();
			const isMedia =
				mediaType.startsWith("image/") ||
				mediaType.startsWith("video/") ||
				attachmentType === "image" ||
				attachmentType === "video";

			if (isMedia) {
				components.push({
					$type: "directory.evnt.component.splashMedia#0",
					media: {
						sources: [{ url: href, mimeType: mediaType || undefined }],
						alt: createTranslations(asNonEmptyString(attachment.name), language),
					},
					roles: ["background"],
				});
				continue;
			}

			addUrlAsLink(href);
		}

		const summary = asNonEmptyString(data.summary);
		const content = asNonEmptyString(data.content);
		if (content || summary) components.push(markdownText((content ?? summary)!, language));

		const start = asNonEmptyString(data.startTime);
		const end = asNonEmptyString(data.endTime);
		const startDate = start ? parseDateString(start, timeZoneId) : undefined;
		const endDate = end ? parseDateString(end, timeZoneId) : undefined;

		return {
			v: "0.2",
			id: documentId(opts),
			name: createTranslations(asNonEmptyString(data.name), language) ?? {
				[language]: "Untitled Event",
			},
			venue,
			occurrences: startDate || endDate ? [{ start: startDate, end: endDate }] : undefined,
			components: nonEmpty(components),
		};
	},

	to: (data: OpenEvnt, opts?: ConvertOptions): JsonObject => {
		const language = opts?.language ?? "en";
		const object: JsonObject = {
			"@context": "https://www.w3.org/ns/activitystreams",
			type: "Event",
			name: translate(data.name, [language]) ?? "Untitled Event",
		};

		object.evntData = data;

		const primaryOccurrence =
			data.occurrences?.find((occurrence) => occurrence.start || occurrence.end) ??
			data.occurrences?.[0];
		if (primaryOccurrence?.start) {
			const iso = partialDateToIso(primaryOccurrence.start);
			if (iso) object.startTime = iso;
			else object.evntPartialStart = primaryOccurrence.start;
		}
		if (primaryOccurrence?.end) {
			const iso = partialDateToIso(primaryOccurrence.end);
			if (iso) object.endTime = iso;
			else object.evntPartialEnd = primaryOccurrence.end;
		}

		const locations: Record<string, unknown>[] = [];
		if (data.venue) {
			const place = data.venue.components?.find(
				(component): component is CoordinatesComponent =>
					component.$type === "directory.evnt.component.coordinates#0",
			);
			locations.push({
				type: "Place",
				name: translate(data.venue.name, [language]),
				address: data.venue.address,
				latitude: place?.latitude,
				longitude: place?.longitude,
			});
		}

		const urls: string[] = [];
		const attachments: Record<string, unknown>[] = [];

		for (const component of data.components ?? []) {
			if (isLink(component) || isSource(component)) {
				urls.push(component.url);
			} else if (isSplashMedia(component)) {
				for (const source of component.media.sources) {
					attachments.push({
						type: source.mimeType?.startsWith("video/") ? "Video" : "Image",
						url: source.url,
						mediaType: source.mimeType,
						name: component.media.alt ? translate(component.media.alt, [language]) : undefined,
					});
				}
			}
		}

		const description = findDescription(data.components, [language]);
		if (description) object.content = description.text;

		if (locations.length === 1) object.location = locations[0];
		else if (locations.length > 1) object.location = locations;
		if (urls.length === 1) object.url = urls[0];
		else if (urls.length > 1) object.url = urls;
		if (attachments.length > 0) object.attachment = attachments;

		return object;
	},
} satisfies FormatConverter<JsonObject>;
