# @evnt/builder

Builder pattern classes for constructing [Open Evnt](https://evnt.directory) 0.2 events.

Provides a fluent API for building OpenEvnt objects step by step.

```ts
import { EventBuilder } from "@evnt/builder";

const event = new EventBuilder()
	.setId("https://example.com/events/tech-meetup.evnt.json")
	.setName("Tech Meetup", "en")
	.setVenue((v) =>
		v
			.setName("Community Hall", "en")
			.setAddress("Main St 1, Vilnius")
			.setCountryCode("LT")
			.setCoordinates(54.68, 25.28),
	)
	.addOccurrence((o) =>
		o.setStart("2026-06-15T18:00[Europe/Vilnius]").setEnd("2026-06-15T21:00[Europe/Vilnius]"),
	)
	.addLink((l) => l.setUrl("https://example.com"))
	.build();
```

A new event gets a `urn:uuid:` id. Give it the https URL the document will be served from with
`setId` when there is one.
