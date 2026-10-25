# @evnt/schema

Validates [Open Evnt](https://evnt.directory) 0.2 documents. It has no dependencies besides the other
`@evnt` packages and implements [Standard Schema](https://standardschema.dev), so libraries that take
any Standard Schema, such as form libraries and tRPC, can use it directly.

Re-exports types from `@evnt/types`.

```ts
import { OpenEvntValidator } from "@evnt/schema";

const result = OpenEvntValidator.validate(json);
if (result.issues) {
	console.error(result.issues); // [{ message: "must not be after end", path: ["occurrences", 0, "start"] }]
} else {
	result.value; // OpenEvnt
}

const event = OpenEvntValidator.parse(json); // throws an OpenEvntValidationError
```

It checks everything the spec requires of a document, including what the JSON Schema cannot: dates
that do not exist, unknown time zones, a `start` after its `end`, and language tags that differ only in
case. Components with a `$type` it does not know pass through unchanged.

## Third-party components

Give `createOpenEvntValidator` a Standard Schema for each component type you know:

```ts
import { createOpenEvntValidator } from "@evnt/schema";
import * as z from "zod";

const validator = createOpenEvntValidator({
	"com.example.ticketTier#0": z.looseObject({
		$type: z.literal("com.example.ticketTier#0"),
		price: z.number(),
	}),
});

const event = validator.parse(json); // components are typed as known, ticket tier or unknown
```

Each component of that `$type` is checked by your schema, wherever it appears, and its issues are
reported with the full path from the document. The parsed document holds your schema's output, so
transforms and defaults apply. Use a schema that keeps unknown keys, such as `z.looseObject`: the spec
asks consumers to preserve a component's properties.

If any of your schemas is asynchronous, use `validateAsync` or `parseAsync`; `validate` and `parse` throw
a `TypeError` when they meet a `Promise`.
