import "temporal-polyfill-lite/global";
import { describe, expect, test } from "vitest";
import { PartialDate } from "../src/index";

describe("PartialDate precision", () => {
	test("has", () => {
		expect(PartialDate.from("2024[UTC]").has("month")).toBe(false);
		expect(PartialDate.from("2024-05[UTC]").has("month")).toBe(true);
		expect(PartialDate.from("2024-05-20[UTC]").has("day")).toBe(true);
		expect(PartialDate.from("2024-05-20[UTC]").has("time")).toBe(false);
		expect(PartialDate.from("2024-05-20T14:30[UTC]").has("time")).toBe(true);
	});

	test("converting to a coarser precision", () => {
		const time = PartialDate.from("2024-05-20T14:30[UTC]");
		expect(time.toDay().toString()).toBe("2024-05-20[UTC]");
		expect(time.toMonth().toString()).toBe("2024-05[UTC]");
		expect(time.toYear().toString()).toBe("2024[UTC]");
	});

	test("converting to a finer precision", () => {
		const year = PartialDate.from("2024[UTC]");
		expect(year.toMonth(2).toDay(29).toTime(18, 0).toString()).toBe("2024-02-29T18:00[UTC]");
		expect(() => year.toMonth(2).toDay(30)).toThrow(RangeError);
	});

	test("withPrecision fills the first or last value", () => {
		expect(PartialDate.from("2024-05-20T14:30[UTC]").withPrecision("year").toString()).toBe(
			"2024[UTC]",
		);
		expect(PartialDate.from("2024[UTC]").withPrecision("month").toString()).toBe("2024-01[UTC]");
		expect(PartialDate.from("2024[UTC]").withPrecision("month", "last").toString()).toBe(
			"2024-12[UTC]",
		);
		expect(PartialDate.from("2024-02[UTC]").withPrecision("day", "last").toString()).toBe(
			"2024-02-29[UTC]",
		);
		expect(PartialDate.from("2024-05-20[UTC]").withPrecision("time").toString()).toBe(
			"2024-05-20T00:00[UTC]",
		);
		expect(PartialDate.from("2024-05-20[UTC]").withPrecision("time", "last").toString()).toBe(
			"2024-05-20T23:59[UTC]",
		);
	});

	test("daysInMonth", () => {
		expect(PartialDate.from("2024-02[UTC]").daysInMonth).toBe(29);
		expect(PartialDate.from("2100-02[UTC]").daysInMonth).toBe(28);
	});

	test("with replaces fields and keeps the precision", () => {
		const time = PartialDate.from("2024-05-20T14:30[UTC]");
		expect(time.with({ timeZoneId: "Europe/Berlin" }).toString()).toBe(
			"2024-05-20T14:30[Europe/Berlin]",
		);
		expect(time.with({ day: 21 }).toString()).toBe("2024-05-21T14:30[UTC]");
		expect(PartialDate.from("2024-05[UTC]").with({ month: 6 }).toString()).toBe("2024-06[UTC]");
		expect(() => time.with({ month: 2, day: 30 })).toThrow(RangeError);
	});

	test("with takes Temporal values", () => {
		const time = PartialDate.from("2026-11-14T18:00[Europe/Vilnius]");
		expect(time.with(time.toPlainDateTime().add({ weeks: 1 })).toString()).toBe(
			"2026-11-21T18:00[Europe/Vilnius]",
		);
		const day = PartialDate.from("2026-11-30[Europe/Vilnius]");
		expect(day.with(day.toPlainDate().add({ days: 1 })).toString()).toBe(
			"2026-12-01[Europe/Vilnius]",
		);
	});

	test("Temporal conversions", () => {
		const time = PartialDate.from("2026-11-14T18:00[Europe/Vilnius]");
		expect(time.toMonth().toPlainYearMonth().toString()).toBe("2026-11");
		expect(time.toPlainDate().toString()).toBe("2026-11-14");
		expect(time.toZonedDateTime().toString()).toBe("2026-11-14T18:00:00+02:00[Europe/Vilnius]");
		expect(PartialDate.from(time.toZonedDateTime()).equals(time)).toBe(true);
	});
});
