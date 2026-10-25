import type { Activity, Occurrence, PartialDate, UnknownComponent } from "@evnt/types";
import type { EventBuilder } from "./EventBuilder.js";

export class OccurrenceBuilder {
	occurrence: Occurrence;
	parent?: EventBuilder;
	constructor(occurrence?: Occurrence, parent?: EventBuilder) {
		this.occurrence = occurrence ?? {};
		this.parent = parent;
	}

	build = () => this.occurrence;

	setStart(start: PartialDate) {
		this.occurrence.start = start;
		return this;
	}

	setEnd(end: PartialDate) {
		this.occurrence.end = end;
		return this;
	}

	setStatus(status: Occurrence["status"]) {
		if (status === undefined) delete this.occurrence.status;
		else this.occurrence.status = status;
		return this;
	}

	addActivity(activity: Activity): this;
	addActivity(name: string, language?: string): this;
	addActivity(activity: Activity | string, language = "en") {
		(this.occurrence.activities ??= []).push(
			typeof activity === "string" ? { name: { [language]: activity } } : activity,
		);
		return this;
	}

	addCustomComponent(component: UnknownComponent) {
		(this.occurrence.components ??= []).push(component);
		return this;
	}
}
