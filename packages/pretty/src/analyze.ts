import { PartialDate, type PartialDateString } from "@evnt/partial-date";
import type { Occurrence } from "@evnt/types";
import type { DateGroup, DateList, DateRange, SingleDate, TimeSlot } from "./types.js";

export interface AnalyzeOptions {
	/** Group consecutive days that share the same times into a single range
	 *  (e.g. "Oct 12–14"). Days with a different time pattern stay separate.
	 *  Set to false to render every instance by itself. */
	groupConsecutiveDates: boolean;
}

export const defaultAnalyzeOptions: AnalyzeOptions = {
	groupConsecutiveDates: true,
};

const hasDay = (pd: PartialDateString) => PartialDate.from(pd).has("day");
const hasTime = (pd: PartialDateString) => PartialDate.from(pd).has("time");

const dayNumber = (pd: PartialDateString): number => {
	const { year, month, day } = PartialDate.from(pd).withPrecision("day");
	const date = new Date(0);
	date.setUTCFullYear(year, month - 1, day);
	return date.getTime() / 86_400_000;
};

const isSameDay = (a?: PartialDateString, b?: PartialDateString): boolean =>
	!!a && !!b && hasDay(a) && hasDay(b) && dayNumber(a) === dayNumber(b);

const isNextDay = (a: PartialDateString, b: PartialDateString): boolean =>
	hasDay(a) && hasDay(b) && dayNumber(b) - dayNumber(a) === 1;

interface DateEntry {
	start?: PartialDateString;
	end?: PartialDateString;
}

const timePart = (pd?: PartialDateString): string => {
	if (!pd) return "";
	const date = PartialDate.from(pd);
	return date.precision === "time" ? `${date.hour}:${date.minute}` : "";
};

const getTimeKey = (entry: DateEntry): string => `${timePart(entry.start)}|${timePart(entry.end)}`;

const roundToDay = (pd: PartialDateString): PartialDateString => {
	const date = PartialDate.from(pd);
	return date.has("day") ? date.withPrecision("day").toString() : pd;
};

const isConsecutiveRange = (days: PartialDateString[]): boolean => {
	for (let i = 1; i < days.length; i++) if (!isNextDay(days[i - 1]!, days[i]!)) return false;
	return true;
};

interface MergedEntryGroup {
	entries: DateEntry[];
}

const mergeEntries = (entries: DateEntry[]): MergedEntryGroup[] => {
	const groups: MergedEntryGroup[] = [];

	for (const entry of entries) {
		const timeKey = getTimeKey(entry);
		const last = groups[groups.length - 1];

		if (last && last.entries.length > 0) {
			const lastEntry = last.entries[last.entries.length - 1]!;
			const lastStart = lastEntry.start;
			const thisStart = entry.start;

			const isConsecutive =
				lastStart && thisStart && hasDay(lastStart) && hasDay(thisStart)
					? isNextDay(roundToDay(lastStart), roundToDay(thisStart))
					: false;

			const samePattern = last.entries.every((e) => getTimeKey(e) === timeKey);

			if (isConsecutive && samePattern) {
				last.entries.push(entry);
				continue;
			}

			if (samePattern) {
				last.entries.push(entry);
				continue;
			}
		}

		groups.push({ entries: [entry] });
	}

	return groups;
};

const toDateShape = (entries: DateEntry[]): SingleDate | DateRange | DateList => {
	if (entries.length === 1) {
		const e = entries[0]!;
		if (e.start && e.end && !isSameDay(e.start, e.end)) {
			return { type: "range", from: e.start, to: e.end };
		}
		return { type: "single", date: e.start ?? e.end! };
	}

	const allDays: PartialDateString[] = [];
	for (const e of entries) {
		if (e.start && hasDay(e.start)) allDays.push(roundToDay(e.start));
	}

	if (allDays.length >= 2 && isConsecutiveRange(allDays)) {
		return { type: "range", from: allDays[0]!, to: allDays[allDays.length - 1]! };
	}

	return { type: "list", dates: allDays };
};

const dedupTimeRanges = (entries: DateEntry[]): TimeSlot[] => {
	const seen = new Set<string>();
	const ranges: TimeSlot[] = [];

	for (const entry of entries) {
		const key = getTimeKey(entry);
		if (seen.has(key)) continue;
		seen.add(key);

		const range: TimeSlot = {};
		if (entry.start && hasTime(entry.start)) range.start = entry.start;
		if (entry.end && hasTime(entry.end)) range.end = entry.end;
		if (range.start || range.end) ranges.push(range);
	}

	return ranges;
};

export const groupDates = (occurrences: Occurrence[], group: boolean): DateGroup[] => {
	const entries: DateEntry[] = occurrences
		.map((occurrence) => ({ start: occurrence.start, end: occurrence.end }))
		.filter((entry) => entry.start || entry.end)
		.sort((a, b) => {
			if (!a.start && !b.start) return 0;
			if (!a.start) return -1;
			if (!b.start) return 1;
			return PartialDate.compare(a.start, b.start);
		});

	const groups = group
		? mergeEntries(entries).map((merged) => merged.entries)
		: entries.map((entry) => [entry]);
	return groups.map((grouped) => ({
		dates: toDateShape(grouped),
		times: dedupTimeRanges(grouped),
	}));
};
