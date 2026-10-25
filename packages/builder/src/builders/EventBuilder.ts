import type { OpenEvnt, EventStatus, LinkComponent, Venue } from "@evnt/types";
import type { UnknownComponent } from "@evnt/types";
import { createBuilderAdder, createTranslationAdder } from "../utils/helpers.js";
import { OccurrenceBuilder } from "./OccurrenceBuilder.js";
import { VenueBuilder } from "./VenueBuilder.js";
import { LinkBuilder } from "./components/LinkBuilder.js";

declare const crypto: { randomUUID(): string };

export class EventBuilder {
	data: OpenEvnt;

	constructor(data?: OpenEvnt) {
		this.data = data ?? {
			v: "0.2",
			id: `urn:uuid:${crypto.randomUUID()}`,
			name: {},
		};
	}

	build = () => this.data;

	setId(id: string) {
		this.data.id = id;
		return this;
	}

	setName = createTranslationAdder(() => this.data.name, this);

	setStatus(status: EventStatus | undefined) {
		if (status === undefined) delete this.data.status;
		else this.data.status = status;
		return this;
	}

	setVenue(arg: Venue | ((builder: VenueBuilder) => VenueBuilder)) {
		this.data.venue =
			typeof arg === "function" ? arg(new VenueBuilder(this.data.venue, this)).build() : arg;
		return this;
	}

	addOccurrence = createBuilderAdder(() => (this.data.occurrences ??= []), OccurrenceBuilder, this);
	getOccurrence(index: number) {
		const occurrences = (this.data.occurrences ??= []);
		if (index < 0 || index >= occurrences.length) throw new Error("Occurrence index out of bounds");
		return new OccurrenceBuilder(occurrences[index], this);
	}

	addCustomComponent(component: UnknownComponent) {
		this.data.components ??= [];
		this.data.components.push(component);
		return this;
	}

	addLink(arg: string | LinkComponent | ((b: LinkBuilder) => LinkBuilder)) {
		this.data.components ??= [];
		const component: LinkComponent =
			typeof arg === "function"
				? arg(new LinkBuilder(undefined, this)).build()
				: typeof arg === "string"
					? { $type: "directory.evnt.component.link#0", url: arg }
					: arg;
		this.data.components.push(component);
		return this;
	}
}
