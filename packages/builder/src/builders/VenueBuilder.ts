import type { AnyComponent, PlaceIdType, UnknownComponent, Venue } from "@evnt/types";
import type { EventBuilder } from "./EventBuilder.js";
import { createTranslationAdder } from "../utils/helpers.js";

export class VenueBuilder {
	venue: Venue;
	parent?: EventBuilder;
	constructor(venue?: Venue, parent?: EventBuilder) {
		this.venue = venue ?? {};
		this.parent = parent;
	}

	build = () => this.venue;

	setName = createTranslationAdder(() => (this.venue.name ??= {}), this);

	setAddress(address: string) {
		this.venue.address = address;
		return this;
	}

	setCountryCode(countryCode: string) {
		this.venue.countryCode = countryCode.toUpperCase();
		return this;
	}

	setCoordinates(latitude: number, longitude: number, uncertainty?: number) {
		const components = (this.venue.components ??= []).filter(
			(component) => component.$type !== "directory.evnt.component.coordinates#0",
		);
		components.push({
			$type: "directory.evnt.component.coordinates#0",
			latitude,
			longitude,
			...(uncertainty === undefined ? {} : { uncertainty }),
		});
		this.venue.components = components;
		return this;
	}

	addPlaceId(type: PlaceIdType, id: string) {
		return this.addComponent({ $type: "directory.evnt.component.placeId#0", type, id });
	}

	addCustomComponent(component: UnknownComponent) {
		return this.addComponent(component);
	}

	private addComponent(component: AnyComponent) {
		(this.venue.components ??= []).push(component);
		return this;
	}
}
