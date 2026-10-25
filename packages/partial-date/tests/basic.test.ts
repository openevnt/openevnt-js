import { describe, expect, expectTypeOf, test } from "vitest";
import { PartialDate } from "../src/index";

describe("isValid", () => {
	test("each precision", () => {
		expect(PartialDate.isValid("2024[UTC]")).toBe(true);
		expect(PartialDate.isValid("2024-05[UTC]")).toBe(true);
		expect(PartialDate.isValid("2024-05-20[UTC]")).toBe(true);
		expect(PartialDate.isValid("2024-05-20T14:30[America/New_York]")).toBe(true);
		expect(PartialDate.isValid("2026-06-15T18:00[Etc/GMT+5]")).toBe(true);
	});

	test("malformed strings", () => {
		expect(PartialDate.isValid("2024-1[UTC]")).toBe(false);
		expect(PartialDate.isValid("2024-05-[UTC]")).toBe(false);
		expect(PartialDate.isValid("2024-05-5[UTC]")).toBe(false);
		expect(PartialDate.isValid("2024-05-20T14[UTC]")).toBe(false);
		expect(PartialDate.isValid("2024-05-20T14:30")).toBe(false);
		expect(PartialDate.isValid(20240520)).toBe(false);
	});

	test("dates and times that do not exist", () => {
		expect(PartialDate.isValid("2026-02-29[UTC]")).toBe(false);
		expect(PartialDate.isValid("2024-02-29[UTC]")).toBe(true);
		expect(PartialDate.isValid("2024-13[UTC]")).toBe(false);
		expect(PartialDate.isValid("2024-04-31[UTC]")).toBe(false);
		expect(PartialDate.isValid("2024-05-20T24:00[UTC]")).toBe(false);
	});

	test("time zones must be IANA names", () => {
		expect(PartialDate.isValid("2026-11-14[Europe/Atlantis]")).toBe(false);
		expect(PartialDate.isValid("2026-11-14[+02:00]")).toBe(false);
		expect(PartialDate.isValid("2026-11-14[+0200]")).toBe(false);
		expect(PartialDate.isValid("2026-11-14[Z]")).toBe(false);
	});
});

describe("from", () => {
	test("a string", () => {
		const date = PartialDate.from("2024-05-20T14:30[America/New_York]");
		expect(date.year).toBe(2024);
		expect(date.month).toBe(5);
		expect(date.day).toBe(20);
		expect(date.hour).toBe(14);
		expect(date.minute).toBe(30);
		expect(date.timeZoneId).toBe("America/New_York");
		expect(date.precision).toBe("time");
	});

	test("fields", () => {
		expect(
			PartialDate.from({ year: 2026, month: 3, timeZoneId: "Europe/Vilnius" }).toString(),
		).toBe("2026-03[Europe/Vilnius]");
		expect(PartialDate.from({ year: 812, timeZoneId: "UTC" }).toString()).toBe("0812[UTC]");
	});

	test("a point in time, as the wall clock in a zone", () => {
		const instant = Date.UTC(2026, 10, 14, 16, 5, 59);
		expect(PartialDate.fromEpochMilliseconds(instant, "Europe/Vilnius").toString()).toBe(
			"2026-11-14T18:05[Europe/Vilnius]",
		);
		expect(PartialDate.fromEpochMilliseconds(instant, "UTC").toString()).toBe(
			"2026-11-14T16:05[UTC]",
		);
		expect(() => PartialDate.fromEpochMilliseconds(Number.NaN, "UTC")).toThrow(RangeError);
		expect(() => PartialDate.fromEpochMilliseconds(instant, "+02:00")).toThrow(RangeError);
	});

	test("a string literal gives its class", () => {
		expect(PartialDate.from("2026[UTC]")).toBeInstanceOf(PartialDate.Year);
		expect(PartialDate.from("2026-11[UTC]")).toBeInstanceOf(PartialDate.Month);
		expect(PartialDate.from("2026-11-14[UTC]")).toBeInstanceOf(PartialDate.Day);
		expect(PartialDate.from("2026-11-14T18:00[UTC]")).toBeInstanceOf(PartialDate.Time);
		expectTypeOf(PartialDate.from("2026-11-14[UTC]")).toEqualTypeOf<PartialDate.Day>();
	});

	test("switching on precision narrows", () => {
		const summarize = (date: PartialDate) => {
			switch (date.precision) {
				case "year":
					return `${date.year}`;
				case "month":
					return `${date.year}/${date.month}`;
				case "day":
					expectTypeOf(date.day).toEqualTypeOf<number>();
					return `${date.year}/${date.month}/${date.day}`;
				case "time":
					return `${date.day} ${date.hour}:${date.minute}`;
			}
		};
		expect(summarize(PartialDate.from("2026-11-14T18:05[UTC]" as string))).toBe("14 18:5");
	});

	test("constructors validate like Temporal's", () => {
		expect(new PartialDate.Day(2026, 11, 14, "Europe/Vilnius").toString()).toBe(
			"2026-11-14[Europe/Vilnius]",
		);
		expect(() => new PartialDate.Day(2026, 2, 29, "UTC")).toThrow(RangeError);
		expect(() => new PartialDate.Time(2026, 2, 28, 24, 0, "UTC")).toThrow(RangeError);
		expect(() => new PartialDate.Year(2026, "+02:00")).toThrow(RangeError);
	});

	test("invalid input throws", () => {
		expect(() => PartialDate.from("2026-02-29[UTC]")).toThrow(RangeError);
		expect(() => PartialDate.from("tomorrow")).toThrow(RangeError);
		expect(() => PartialDate.from({ year: 2026, day: 4, timeZoneId: "UTC" })).toThrow(RangeError);
		expect(() =>
			PartialDate.from({ year: 2026, month: 1, day: 4, hour: 10, timeZoneId: "UTC" }),
		).toThrow(RangeError);
	});

	test("round trips through strings and JSON", () => {
		for (const text of [
			"2024[UTC]",
			"2024-05[UTC]",
			"2024-05-20[UTC]",
			"2024-05-20T14:30[Europe/London]",
		]) {
			expect(PartialDate.from(text).toString()).toBe(text);
			expect(JSON.stringify({ start: PartialDate.from(text) })).toBe(
				JSON.stringify({ start: text }),
			);
		}
	});

	test("cannot be compared with < or >", () => {
		expect(() => (PartialDate.from("2024[UTC]") as unknown as number) < 1).toThrow(TypeError);
	});
});

test("toLocaleString shows only the precision it has", () => {
	expect(PartialDate.from("2026[Europe/Vilnius]").toLocaleString("en")).toBe("2026");
	expect(PartialDate.from("2026-11[Europe/Vilnius]").toLocaleString("en")).toBe("November 2026");
	expect(PartialDate.from("2026-11-14[Europe/Vilnius]").toLocaleString("en")).toBe(
		"November 14, 2026",
	);
	expect(PartialDate.from("2026-11-14T18:00[Europe/Vilnius]").toLocaleString("en-GB")).toBe(
		"14 November 2026 at 18:00",
	);
});
