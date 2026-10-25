export interface CoordinatesComponent {
	$type: "directory.evnt.component.coordinates#0";
	latitude: number;
	longitude: number;
	/** How far the venue may be from the point, in metres */
	uncertainty?: number;
}
