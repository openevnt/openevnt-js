import { describe, expect, test } from "vitest";
import { PartialDate } from "../src/index";

const instant = (text: string) => Date.parse(text);

describe("periods", () => {
	test("each precision covers its whole period", () => {
		const day = PartialDate.from("2026-11-14[Europe/Vilnius]");
		expect(day.startEpochMilliseconds).toBe(instant("2026-11-13T22:00Z"));
		expect(day.endEpochMilliseconds).toBe(instant("2026-11-14T22:00Z"));

		const month = PartialDate.from("2026-12[UTC]");
		expect(month.endEpochMilliseconds).toBe(instant("2027-01-01T00:00Z"));

		const time = PartialDate.from("2026-11-14T18:00[Europe/Vilnius]");
		expect(time.startEpochMilliseconds).toBe(instant("2026-11-14T16:00Z"));
		expect(time.endEpochMilliseconds).toBe(time.startEpochMilliseconds);
	});

	test("a day is 23 hours long when clocks go forward", () => {
		const day = PartialDate.from("2026-03-29[Europe/Vilnius]");
		expect(day.endEpochMilliseconds - day.startEpochMilliseconds).toBe(23 * 3_600_000);
	});

	test("a skipped time uses the offset from before the change", () => {
		expect(PartialDate.from("2026-03-29T03:30[Europe/Vilnius]").startEpochMilliseconds).toBe(
			PartialDate.from("2026-03-29T04:30[Europe/Vilnius]").startEpochMilliseconds,
		);
	});

	test("a repeated time is the first of the two", () => {
		expect(PartialDate.from("2026-10-25T03:30[Europe/Vilnius]").startEpochMilliseconds).toBe(
			instant("2026-10-25T00:30Z"),
		);
	});
});

describe("order", () => {
	test("the spec's examples are not after", () => {
		expect(
			PartialDate.from("2025-11-12[Europe/London]").isAfter("2025-11-12T18:00[Europe/London]"),
		).toBe(false);
		expect(
			PartialDate.from("2025-11-12T10:00[Europe/London]").isAfter("2025-11-12[Europe/London]"),
		).toBe(false);
	});

	test("isAfter and isBefore", () => {
		expect(PartialDate.from("2026[UTC]").isAfter("2025[UTC]")).toBe(true);
		expect(PartialDate.from("2024[UTC]").isAfter("2024[UTC]")).toBe(false);
		expect(PartialDate.from("2024-05-01[UTC]").isAfter("2024-05[UTC]")).toBe(false);
		expect(PartialDate.from("2024-05-02T00:00[UTC]").isAfter("2024-05-01[UTC]")).toBe(true);
		expect(PartialDate.from("2024-05-20T10:00[UTC]").isAfter("2024-05-20T10:00[UTC]")).toBe(false);
		expect(PartialDate.from("2024-05-20T10:00[UTC]").isBefore("2024-05-20T10:01[UTC]")).toBe(true);
		expect(PartialDate.from("2024-05[UTC]").isBefore("2024-05-01[UTC]")).toBe(false);
	});

	test("isAfter across time zones", () => {
		expect(
			PartialDate.from("2026-11-14T01:00[Europe/Vilnius]").isAfter("2026-11-13T23:30[UTC]"),
		).toBe(false);
		expect(
			PartialDate.from("2026-11-14T02:00[Europe/Vilnius]").isAfter("2026-11-13T23:30[UTC]"),
		).toBe(true);
	});

	test("compare sorts by start, finer precision first on a tie", () => {
		const sorted = [
			"2026-11[UTC]",
			"2026-11-01[UTC]",
			"2026-11-01T00:00[UTC]",
			"2026[UTC]",
			"2025-12-31[UTC]",
		]
			.map((text) => PartialDate.from(text))
			.sort(PartialDate.compare)
			.map(String);
		expect(sorted).toEqual([
			"2025-12-31[UTC]",
			"2026[UTC]",
			"2026-11-01T00:00[UTC]",
			"2026-11-01[UTC]",
			"2026-11[UTC]",
		]);
	});
});

describe("containment", () => {
	test("contains", () => {
		expect(PartialDate.from("2024[UTC]").contains("2024-05[UTC]")).toBe(true);
		expect(PartialDate.from("2024-05[UTC]").contains("2024-05[UTC]")).toBe(true);
		expect(PartialDate.from("2024-05[UTC]").contains("2024[UTC]")).toBe(false);
		expect(PartialDate.from("2024-05-01[UTC]").contains("2024-05-01T23:59[UTC]")).toBe(true);
		expect(PartialDate.from("2024-05-01[UTC]").contains("2024-05-02T00:00[UTC]")).toBe(false);
	});

	test("intersects", () => {
		expect(PartialDate.from("2024-05[UTC]").intersects("2024[UTC]")).toBe(true);
		expect(PartialDate.from("2024-05[UTC]").intersects("2024-06[UTC]")).toBe(false);
		expect(PartialDate.from("2024-05-01T10:00[UTC]").intersects("2024-05-01T10:00[UTC]")).toBe(
			true,
		);
		expect(PartialDate.from("2024-05-01T10:00[UTC]").intersects("2024-05-01T10:01[UTC]")).toBe(
			false,
		);
		expect(PartialDate.from("2024-05-01T10:00[UTC]").intersects("2024-05-01[UTC]")).toBe(true);
	});
});
