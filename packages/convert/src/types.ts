import type { OpenEvnt } from "@evnt/types";

/** Common options passed to every converter's to/from methods. */
export interface ConvertOptions {
	language?: string;
	timezone?: string;
	/** AT Protocol DID (needed by some formats like community-lexicon for blob URLs). */
	did?: string;
	/** Stable identifier for the event, used where a format demands one (iCalendar UID). */
	uid?: string;
	/** The `id` of a document read from another format: the https URL it will be served from. */
	id?: string;
}

export type JsonObject = Record<string, unknown>;

/** A named format that can convert to/from OpenEvnt. */
export interface FormatConverter<TDocument, TOptions extends ConvertOptions = ConvertOptions> {
	/** Human-readable name for the format. */
	name: string;
	/** Short description of the format. */
	description?: string;
	/** File extensions used by this format (without dot). */
	extensions: string[];
	/** MIME types associated with this format. */
	mimeTypes: string[];
	/** Convert OpenEvnt → this format. Omitted if direction is not supported. */
	to?: (event: OpenEvnt, opts?: TOptions) => TDocument;
	/** Convert this format → OpenEvnt. Omitted if direction is not supported. */
	from?: (input: TDocument, opts?: TOptions) => OpenEvnt;
}
