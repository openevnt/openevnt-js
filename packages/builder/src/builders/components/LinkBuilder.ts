import type { LinkComponent } from "@evnt/types";
import type { EventBuilder } from "../EventBuilder.js";
import { ComponentBuilder } from "./ComponentBuilder.js";

export class LinkBuilder extends ComponentBuilder<LinkComponent> {
	constructor(component?: LinkComponent, parent?: EventBuilder) {
		super(
			component ?? {
				$type: "directory.evnt.component.link#0",
				url: "",
			},
			parent,
		);
	}

	setUrl(url: string) {
		this.component.url = url;
		return this;
	}

	setName(name: string, language?: string) {
		this.component.name ??= {};
		this.component.name[language ?? "en"] = name;
		return this;
	}

	setDisabled(disabled: boolean) {
		this.component.disabled = disabled;
		return this;
	}
}
