export namespace RelationComponent {
	export interface KnownTypes {
		parent: void;
		child: void;
		alternate: void;
	}

	export type RelationType = keyof KnownTypes | (string & {});
}

export interface RelationComponent {
	$type: "directory.evnt.component.relation#0";
	type: RelationComponent.RelationType;
	target: string;
}

export type RelationType = RelationComponent.RelationType;
