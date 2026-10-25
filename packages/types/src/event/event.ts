import type { Translations } from "../types/Translations.js";
import type { AnyComponent } from "./component/index.js";
import type { Occurrence } from "./occurrence/index.js";
import type { Venue } from "./venue/index.js";

export interface OpenEvnt {
	$type?: "directory.evnt.event";
	v: "0.2";
	id: string;
	name: Translations;
	status?: EventStatus;
	venue?: Venue;
	occurrences?: Occurrence[];
	components?: AnyComponent[];
}

export type EventStatus = "uncertain" | "cancelled" | "postponed";
