import { PartialDate, type PartialDateString } from "@evnt/partial-date";

const WRITTEN_DATE_PATTERN =
	/^(?<year>\d{4})(?:-(?<month>\d{1,2})(?:-(?<day>\d{1,2})(?:[T ](?<hour>\d{1,2}):(?<minute>\d{2})(?::(?<second>\d{2})(?:[.,]\d+)?)?(?<offset>Z|[+-]\d{1,2}(?::?\d{2})?)?)?)?)?$/i;

const offsetMilliseconds = (offset: string): number => {
	if (offset.toUpperCase() === "Z") return 0;
	const [, sign, hours, minutes = "0"] = /^([+-])(\d{1,2}):?(\d{2})?$/.exec(offset)!;
	return (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(minutes)) * 60_000;
};

const optionalNumber = (text: string | undefined): number | undefined =>
	text === undefined ? undefined : Number(text);

/** Midnight is how most formats write a date without a time. */
const dayIfMidnight = (time: PartialDate.Time): PartialDateString =>
	(time.hour === 0 && time.minute === 0 ? time.toDay() : time).toString();

export const parseDateString = (
	value: string,
	timeZoneId = "UTC",
): PartialDateString | undefined => {
	if (PartialDate.isValid(value)) return value;
	const written = WRITTEN_DATE_PATTERN.exec(value.trim())?.groups;
	try {
		if (!written) {
			const instant = Date.parse(value);
			return Number.isFinite(instant)
				? dayIfMidnight(PartialDate.fromEpochMilliseconds(instant, timeZoneId))
				: undefined;
		}
		const fields = {
			year: Number(written.year),
			month: optionalNumber(written.month),
			day: optionalNumber(written.day),
			hour: optionalNumber(written.hour),
			minute: optionalNumber(written.minute),
		};
		if (written.hour === undefined) return PartialDate.from({ ...fields, timeZoneId }).toString();
		if (written.offset === undefined)
			return dayIfMidnight(PartialDate.from({ ...fields, timeZoneId }).withPrecision("time"));
		const wallClockInUtc = PartialDate.from({ ...fields, timeZoneId: "UTC" });
		const instant =
			wallClockInUtc.startEpochMilliseconds +
			(optionalNumber(written.second) ?? 0) * 1000 -
			offsetMilliseconds(written.offset);
		return dayIfMidnight(PartialDate.fromEpochMilliseconds(instant, timeZoneId));
	} catch {
		return undefined;
	}
};

const offsetText = (milliseconds: number): string => {
	if (milliseconds === 0) return "Z";
	const minutes = Math.abs(milliseconds) / 60_000;
	const twoDigits = (value: number) => String(value).padStart(2, "0");
	return `${milliseconds < 0 ? "-" : "+"}${twoDigits(Math.floor(minutes / 60))}:${twoDigits(minutes % 60)}`;
};

export const partialDateToIso = (value: PartialDateString): string | undefined => {
	const date = PartialDate.from(value);
	if (!date.has("time")) return undefined;
	const offset =
		date.with({ timeZoneId: "UTC" }).startEpochMilliseconds - date.startEpochMilliseconds;
	return `${date.toString().slice(0, 16)}:00${offsetText(offset)}`;
};

export function addDays(date: PartialDate.Day, days: number): PartialDate.Day;
export function addDays(date: PartialDate.Time, days: number): PartialDate.Time;
export function addDays(date: PartialDate.Day | PartialDate.Time, days: number) {
	const shifted = new Date(0);
	shifted.setUTCFullYear(date.year, date.month - 1, date.day + days);
	return date.with({
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth() + 1,
		day: shifted.getUTCDate(),
	});
}
