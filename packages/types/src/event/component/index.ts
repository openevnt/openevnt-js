import type { CoordinatesComponent } from "./CoordinatesComponent.js";
import type { LanguagesComponent } from "./LanguagesComponent.js";
import type { LinkComponent } from "./LinkComponent.js";
import type { PlaceIdComponent } from "./PlaceIdComponent.js";
import type { RelationComponent } from "./RelationComponent.js";
import type { SourceComponent } from "./SourceComponent.js";
import type { SplashMediaComponent } from "./SplashMediaComponent.js";
import type { MarkdownTextComponent } from "./text/MarkdownTextComponent.js";
import type { PlainTextComponent } from "./text/PlainTextComponent.js";

export interface ComponentTypes {
	"directory.evnt.text.markdown#0": MarkdownTextComponent;
	"directory.evnt.text.plain#0": PlainTextComponent;
	"directory.evnt.component.link#0": LinkComponent;
	"directory.evnt.component.source#0": SourceComponent;
	"directory.evnt.component.splashMedia#0": SplashMediaComponent;
	"directory.evnt.component.languages#0": LanguagesComponent;
	"directory.evnt.component.placeId#0": PlaceIdComponent;
	"directory.evnt.component.relation#0": RelationComponent;
	"directory.evnt.component.coordinates#0": CoordinatesComponent;
}

export type KnownComponent = ComponentTypes[keyof ComponentTypes];
export type UnknownComponent = { $type: string & { _brand?: never } } & Record<string, unknown>;

export type Component<Type extends keyof ComponentTypes | (string & {}) = keyof ComponentTypes> =
	Type extends keyof ComponentTypes ? ComponentTypes[Type] : UnknownComponent;

export type AnyComponent = KnownComponent | UnknownComponent;
