import { PartialDate, type PartialDateString } from "@evnt/partial-date";
import type { FormatOptions } from "./formatters/base.js";

const asWrittenInUtc = (date: PartialDate): Date => {
	const { year, month, day, hour, minute } = date.withPrecision("time");
	const written = new Date(0);
	written.setUTCFullYear(year, month - 1, day);
	written.setUTCHours(hour, minute);
	return written;
};

const writtenDateFormat = (
	language: string,
	options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat =>
	new Intl.DateTimeFormat(language, {
		...options,
		calendar: "gregory",
		hour12: false,
		timeZone: "UTC",
	});

const fullOptions = (date: PartialDate): Intl.DateTimeFormatOptions => ({
	year: "numeric",
	month: "long",
	day: date.has("day") ? "numeric" : undefined,
	hour: date.has("time") ? "numeric" : undefined,
	minute: date.has("time") ? "numeric" : undefined,
});

/** Format a PartialDate as a locale-aware string. */
export function formatDate(
	pd: PartialDateString,
	config: Pick<FormatOptions, "language" | "compactDates">,
): string {
	const date = PartialDate.from(pd);
	if (config.compactDates && date.precision === "year") return date.year.toString();
	const options: Intl.DateTimeFormatOptions = !config.compactDates
		? fullOptions(date)
		: date.precision === "month"
			? { year: "numeric", month: "short" }
			: { month: "short", day: "numeric" };
	return writtenDateFormat(config.language, options).format(asWrittenInUtc(date));
}

export function formatDateRange(
	start: PartialDateString,
	end: PartialDateString,
	config: Pick<FormatOptions, "language" | "compactDates">,
): string {
	const from = PartialDate.from(start);
	const to = PartialDate.from(end);

	if (!from.has("day") || from.precision !== to.precision) {
		return `${formatDate(start, config)}–${formatDate(end, config)}`;
	}

	const options: Intl.DateTimeFormatOptions = config.compactDates
		? { month: "short", day: "numeric" }
		: fullOptions(from);
	return writtenDateFormat(config.language, options).formatRange(
		asWrittenInUtc(from),
		asWrittenInUtc(to),
	);
}

/** Format a time-only PartialDate as "14:00". */
export function formatTime(pd: PartialDateString, config: Pick<FormatOptions, "language">): string {
	const date = PartialDate.from(pd);
	if (date.precision !== "time") return "";
	return writtenDateFormat(config.language, { hour: "2-digit", minute: "2-digit" }).format(
		asWrittenInUtc(date),
	);
}

/** Format a time range as "14:00–16:00". */
export function formatTimeRange(
	start: PartialDateString | undefined,
	end: PartialDateString | undefined,
	config: Pick<FormatOptions, "language">,
): string {
	const hasTime = (pd: PartialDateString | undefined): pd is PartialDateString =>
		pd !== undefined && PartialDate.from(pd).has("time");
	if (hasTime(start) && hasTime(end)) {
		return `${formatTime(start, config)} – ${formatTime(end, config)}`;
	}
	if (hasTime(start)) return formatTime(start, config);
	return "";
}
