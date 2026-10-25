import { describe, expect, expectTypeOf, test } from "vitest";
import { createOpenEvntValidator, type StandardSchemaV1 } from "../src/index";

interface TicketTier {
	$type: "com.example.ticketTier#0";
	price: number;
}

const ticketTier: StandardSchemaV1<unknown, TicketTier> = {
	"~standard": {
		version: 1,
		vendor: "test",
		validate: (value) =>
			typeof (value as TicketTier).price === "number"
				? { value: value as TicketTier }
				: { issues: [{ message: "must have a price", path: ["price"] }] },
	},
};

const asyncTicketTier: StandardSchemaV1<unknown, TicketTier> = {
	"~standard": {
		...ticketTier["~standard"],
		validate: async (value) => ticketTier["~standard"].validate(value),
	},
};

const event = (components: unknown[]) => ({
	v: "0.2",
	id: "https://example.com/events/vilnius-game-jam-2026",
	name: { en: "Vilnius Game Jam 2026" },
	occurrences: [{ start: "2026-11-14[Europe/Vilnius]", components }],
});

describe("createOpenEvntValidator", () => {
	test("validates third-party components with their validator", () => {
		const validator = createOpenEvntValidator({ "com.example.ticketTier#0": ticketTier });

		expect(
			validator.validate(event([{ $type: "com.example.ticketTier#0", price: 5 }])).issues,
		).toBeUndefined();

		expect(
			validator.validate(event([{ $type: "com.example.ticketTier#0", price: "free" }])).issues,
		).toEqual([
			{ message: "must have a price", path: ["occurrences", 0, "components", 0, "price"] },
		]);
	});

	test("types the third-party components", () => {
		const validator = createOpenEvntValidator({ "com.example.ticketTier#0": ticketTier });
		type Parsed = ReturnType<typeof validator.parse>;
		type OccurrenceComponent = NonNullable<
			NonNullable<Parsed["occurrences"]>[number]["components"]
		>[number];
		expectTypeOf<TicketTier>().toExtend<OccurrenceComponent>();
		expectTypeOf<
			Extract<OccurrenceComponent, { $type: "com.example.ticketTier#0" }>
		>().toHaveProperty("price");
	});

	test("asynchronous validators", async () => {
		const validator = createOpenEvntValidator({ "com.example.ticketTier#0": asyncTicketTier });
		const valid = event([{ $type: "com.example.ticketTier#0", price: 5 }]);

		expect(() => validator.validate(valid)).toThrow(TypeError);
		expect((await validator.validateAsync(valid)).issues).toBeUndefined();
		await expect(
			validator.parseAsync(event([{ $type: "com.example.ticketTier#0" }])),
		).rejects.toThrow("occurrences.0.components.0.price: must have a price");
	});

	test("uses the validator's output", () => {
		const priced: StandardSchemaV1<unknown, TicketTier & { currency: string }> = {
			"~standard": {
				version: 1,
				vendor: "test",
				validate: (value) => ({ value: { ...(value as TicketTier), currency: "EUR" } }),
			},
		};
		const input = event([{ $type: "com.example.ticketTier#0", price: 5 }]);
		const parsed = createOpenEvntValidator({ "com.example.ticketTier#0": priced }).parse(input);

		expect(parsed.occurrences![0]!.components).toEqual([
			{ $type: "com.example.ticketTier#0", price: 5, currency: "EUR" },
		]);
		expect(input.occurrences[0]!.components).toEqual([
			{ $type: "com.example.ticketTier#0", price: 5 },
		]);
	});

	test("refuses a key that is not a component type", () => {
		expect(() => createOpenEvntValidator({ ticketTier })).toThrow(TypeError);
	});

	test("is a Standard Schema", async () => {
		const validator = createOpenEvntValidator();
		const result = await validator["~standard"].validate({ v: "0.1" });
		expect(result.issues?.length).toBeGreaterThan(0);
	});
});
