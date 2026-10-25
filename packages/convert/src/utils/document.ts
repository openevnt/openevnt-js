import type { ConvertOptions } from "../types.js";

declare const crypto: { randomUUID(): `${string}-${string}-${string}-${string}-${string}` };

export const documentId = (opts?: ConvertOptions): string =>
	opts?.id ?? `urn:uuid:${crypto.randomUUID()}`;

export const nonEmpty = <Item>(items: Item[]): Item[] | undefined =>
	items.length > 0 ? items : undefined;
