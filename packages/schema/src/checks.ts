import { PartialDate } from "@evnt/partial-date";
import type { ComponentTypes } from "@evnt/types";
import type { StandardSchemaV1 } from "./standard-schema.js";

declare const URL: { canParse(url: string): boolean };

export type Path = readonly (PropertyKey | StandardSchemaV1.PathSegment)[];

export interface PendingComponent {
	readonly path: Path;
	readonly value: unknown;
	readonly validator: StandardSchemaV1;
}

export interface Validation {
	readonly issues: StandardSchemaV1.Issue[];
	readonly pendingComponents: PendingComponent[];
	readonly componentValidators: Readonly<Record<string, StandardSchemaV1>>;
}

type Check = (value: unknown, path: Path, validation: Validation) => void;

export const COMPONENT_TYPE_PATTERN = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+#(0|[1-9][0-9]*)$/;
const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/;
const URI_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const COORDINATES_TYPE = "directory.evnt.component.coordinates#0";
const EVENT_RECORD_TYPE = "directory.evnt.event";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const has = (value: Record<string, unknown>, key: string) =>
	Object.hasOwn(value, key) && value[key] !== undefined;

const string: Check = (value, path, { issues }) => {
	if (typeof value !== "string") issues.push({ message: "must be a string", path });
};

const boolean: Check = (value, path, { issues }) => {
	if (typeof value !== "boolean") issues.push({ message: "must be true or false", path });
};

const numberWhere =
	(isAllowed: (value: number) => boolean, description: string): Check =>
	(value, path, { issues }) => {
		if (typeof value !== "number" || !Number.isFinite(value) || !isAllowed(value))
			issues.push({ message: `must be ${description}`, path });
	};

const matching =
	(pattern: RegExp, description: string): Check =>
	(value, path, { issues }) => {
		if (typeof value !== "string" || !pattern.test(value))
			issues.push({ message: `must be ${description}`, path });
	};

const oneOf =
	(...allowed: string[]): Check =>
	(value, path, { issues }) => {
		if (!allowed.includes(value as string))
			issues.push({ message: `must be ${allowed.map((text) => `"${text}"`).join(" or ")}`, path });
	};

const arrayOf =
	(item: Check, { nonEmpty = false } = {}): Check =>
	(value, path, validation) => {
		if (!Array.isArray(value)) {
			validation.issues.push({ message: "must be an array", path });
			return;
		}
		if (nonEmpty && value.length === 0)
			validation.issues.push({ message: "must have at least one item", path });
		value.forEach((element, index) => item(element, [...path, index], validation));
	};

interface ObjectShape {
	required?: Record<string, Check>;
	optional?: Record<string, Check>;
	closed?: boolean;
	nonEmpty?: boolean;
}

const object =
	({ required = {}, optional = {}, closed = false, nonEmpty = false }: ObjectShape): Check =>
	(value, path, validation) => {
		if (!isRecord(value)) {
			validation.issues.push({ message: "must be an object", path });
			return;
		}
		for (const [key, check] of Object.entries(required)) {
			if (has(value, key)) check(value[key], [...path, key], validation);
			else validation.issues.push({ message: "is required", path: [...path, key] });
		}
		for (const [key, check] of Object.entries(optional))
			if (has(value, key)) check(value[key], [...path, key], validation);
		if (closed)
			for (const key of Object.keys(value))
				if (!Object.hasOwn(required, key) && !Object.hasOwn(optional, key))
					validation.issues.push({
						message: "is not a field of this object",
						path: [...path, key],
					});
		if (nonEmpty && !Object.keys(value).some((key) => has(value, key)))
			validation.issues.push({ message: "must have at least one field", path });
	};

const translations: Check = (value, path, { issues }) => {
	if (!isRecord(value)) {
		issues.push({ message: "must be an object of language tags to text", path });
		return;
	}
	const keys = Object.keys(value);
	if (keys.length === 0) issues.push({ message: "must have text in at least one language", path });
	const seen = new Map<string, string>();
	for (const key of keys) {
		if (!LANGUAGE_TAG_PATTERN.test(key))
			issues.push({
				message: "must be a BCP 47 language tag such as en or zh-Hant",
				path: [...path, key],
			});
		const earlier = seen.get(key.toLowerCase());
		if (earlier !== undefined)
			issues.push({ message: `differs from ${earlier} only in case`, path: [...path, key] });
		else seen.set(key.toLowerCase(), key);
		if (typeof value[key] !== "string" || value[key] === "")
			issues.push({ message: "must be text that is not empty", path: [...path, key] });
	}
};

const absoluteUri: Check = (value, path, { issues }) => {
	if (typeof value !== "string" || !URI_SCHEME_PATTERN.test(value) || !URL.canParse(value))
		issues.push({ message: "must be an absolute URI such as https://example.com/events/1", path });
};

const partialDate: Check = (value, path, { issues }) => {
	if (!PartialDate.isValid(value))
		issues.push({
			message: "must be a PartialDate such as 2026-06-15T09:00[Europe/Vilnius]",
			path,
		});
};

const anyNumber = numberWhere(() => true, "a number");

const mediaSource = object({
	required: { url: absoluteUri },
	optional: {
		mimeType: string,
		dimensions: object({ required: { width: anyNumber, height: anyNumber } }),
	},
});

const media = object({
	required: { sources: arrayOf(mediaSource, { nonEmpty: true }) },
	optional: {
		alt: translations,
		presentation: object({
			optional: {
				blurhash: string,
				dominantColor: matching(/^#[0-9A-Fa-f]{6}$/, "a hex colour such as #1a1a2e"),
			},
		}),

		// caption: TranslationsSchema.optional().meta({ description: "A caption for the media item" }),
		// kind?: "image" | "video" | "audio"
	},
});

const KNOWN_COMPONENTS: Record<keyof ComponentTypes, Check> = {
	"directory.evnt.text.markdown#0": object({
		required: { content: translations },
		optional: { flavor: string },
	}),
	"directory.evnt.text.plain#0": object({ required: { content: translations } }),
	"directory.evnt.component.link#0": object({
		required: { url: absoluteUri },
		optional: { name: translations, disabled: boolean },
	}),
	"directory.evnt.component.source#0": object({ required: { url: absoluteUri } }),
	"directory.evnt.component.splashMedia#0": object({
		required: { media },
		optional: { roles: arrayOf(string) },
	}),
	"directory.evnt.component.languages#0": object({
		required: {
			languages: arrayOf(
				object({
					required: { code: matching(LANGUAGE_TAG_PATTERN, "a BCP 47 language tag such as en") },
				}),
			),
		},
	}),
	"directory.evnt.component.placeId#0": object({ required: { type: string, id: string } }),
	"directory.evnt.component.relation#0": object({
		required: { type: string, target: absoluteUri },
	}),
	[COORDINATES_TYPE]: object({
		required: {
			latitude: numberWhere(
				(degrees) => degrees >= -90 && degrees <= 90,
				"a number from -90 to 90",
			),
			longitude: numberWhere(
				(degrees) => degrees >= -180 && degrees <= 180,
				"a number from -180 to 180",
			),
		},
		optional: { uncertainty: numberWhere((metres) => metres > 0, "a number above 0") },
	}),
};

const component: Check = (value, path, validation) => {
	if (!isRecord(value)) {
		validation.issues.push({ message: "must be a component object with a $type", path });
		return;
	}
	if (!has(value, "$type")) {
		validation.issues.push({ message: "is required", path: [...path, "$type"] });
		return;
	}
	const type = value.$type;
	if (typeof type !== "string" || !COMPONENT_TYPE_PATTERN.test(type)) {
		validation.issues.push({
			message: "must be a reverse domain name and a version, such as com.example.ticketTier#0",
			path: [...path, "$type"],
		});
		return;
	}
	if (Object.hasOwn(validation.componentValidators, type))
		validation.pendingComponents.push({
			path,
			value,
			validator: validation.componentValidators[type]!,
		});
	else if (Object.hasOwn(KNOWN_COMPONENTS, type))
		KNOWN_COMPONENTS[type as keyof ComponentTypes](value, path, validation);
};

const components = arrayOf(component);

const venueComponents: Check = (value, path, validation) => {
	components(value, path, validation);
	if (
		Array.isArray(value) &&
		value.filter((item) => isRecord(item) && item.$type === COORDINATES_TYPE).length > 1
	)
		validation.issues.push({ message: "must not hold more than one coordinates component", path });
};

const venue = object({
	optional: {
		name: translations,
		address: string,
		countryCode: matching(/^[A-Z]{2}$/, "an uppercase ISO 3166-1 alpha-2 code such as LT"),
		components: venueComponents,
	},
	closed: true,
	nonEmpty: true,
});

const activity = object({
	required: { name: translations },
	optional: { status: oneOf("cancelled") },
	closed: true,
});

const occurrenceFields = object({
	optional: {
		start: partialDate,
		end: partialDate,
		status: oneOf("cancelled"),
		activities: arrayOf(activity),
		components,
	},
	closed: true,
});

const occurrence: Check = (value, path, validation) => {
	occurrenceFields(value, path, validation);
	if (
		isRecord(value) &&
		PartialDate.isValid(value.start) &&
		PartialDate.isValid(value.end) &&
		PartialDate.from(value.start).isAfter(value.end)
	)
		validation.issues.push({ message: "must not be after end", path: [...path, "start"] });
};

export const openEvnt = object({
	required: { v: oneOf("0.2"), id: absoluteUri, name: translations },
	optional: {
		$type: oneOf(EVENT_RECORD_TYPE),
		status: oneOf("uncertain", "cancelled", "postponed"),
		venue,
		occurrences: arrayOf(occurrence),
		components,
	},
	closed: true,
});
