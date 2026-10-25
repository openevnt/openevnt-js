export namespace PlaceIdComponent {
	export interface KnownTypes {
		"org.openstreetmap.node": void;
		"org.openstreetmap.way": void;
		"org.openstreetmap.relation": void;
		"com.google.places": void;
		"com.foursquare": void;
	}

	export type PlaceIdType = keyof KnownTypes | (string & {});
}

export interface PlaceIdComponent {
	$type: "directory.evnt.component.placeId#0";
	type: PlaceIdComponent.PlaceIdType;
	id: string;
}

export type PlaceIdType = PlaceIdComponent.PlaceIdType;
