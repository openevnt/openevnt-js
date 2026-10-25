import type { PartialDate as PartialDateString } from "@evnt/types";

export type { PartialDateString };

const PRECISIONS: readonly PartialDate.Precision[] = ["year", "month", "day", "time"];

const PARTIAL_DATE_PATTERN =
	/^(?<year>[0-9]{4})(?:-(?<month>[0-9]{2})(?:-(?<day>[0-9]{2})(?:T(?<hour>[0-9]{2}):(?<minute>[0-9]{2}))?)?)?\[(?<timeZoneId>[A-Za-z][A-Za-z0-9_/+-]*)\]$/;

const MILLISECONDS_PER_DAY = 86_400_000;

const wallClockFormats = new Map<string, Intl.DateTimeFormat>();

const wallClockFormat = (timeZoneId: string): Intl.DateTimeFormat | undefined => {
	let format = wallClockFormats.get(timeZoneId);
	if (format) return format;
	try {
		format = new Intl.DateTimeFormat("en-US", {
			timeZone: timeZoneId,
			hourCycle: "h23",
			era: "short",
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
		});
	} catch {
		return undefined;
	}
	wallClockFormats.set(timeZoneId, format);
	return format;
};

const isTimeZoneId = (timeZoneId: string) =>
	/^[A-Za-z]/.test(timeZoneId) && wallClockFormat(timeZoneId) !== undefined;

const daysInMonth = (year: number, month: number) => {
	const date = new Date(0);
	date.setUTCFullYear(year, month, 0);
	return date.getUTCDate();
};

const wallClockAsEpochMilliseconds = (
	year: number,
	month: number,
	day: number,
	hour = 0,
	minute = 0,
	second = 0,
) => {
	const date = new Date(0);
	date.setUTCFullYear(year, month - 1, day);
	date.setUTCHours(hour, minute, second, 0);
	return date.getTime();
};

const wallClockAt = (epochMilliseconds: number, timeZoneId: string) => {
	const parts = Object.fromEntries(
		wallClockFormat(timeZoneId)!
			.formatToParts(epochMilliseconds)
			.map((part) => [part.type, part.value]),
	);
	const yearOfEra = Number(parts.year);
	return {
		year: parts.era === "BC" ? 1 - yearOfEra : yearOfEra,
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour),
		minute: Number(parts.minute),
		second: Number(parts.second),
	};
};

const offsetAt = (epochMilliseconds: number, timeZoneId: string) => {
	const wholeSeconds = Math.floor(epochMilliseconds / 1000) * 1000;
	const wall = wallClockAt(wholeSeconds, timeZoneId);
	return (
		wallClockAsEpochMilliseconds(
			wall.year,
			wall.month,
			wall.day,
			wall.hour,
			wall.minute,
			wall.second,
		) - wholeSeconds
	);
};

const instantOfWallClock = (wall: number, timeZoneId: string) => {
	const offsetBefore = offsetAt(wall - MILLISECONDS_PER_DAY, timeZoneId);
	const offsetAfter = offsetAt(wall + MILLISECONDS_PER_DAY, timeZoneId);
	const matching = [wall - offsetBefore, wall - offsetAfter].filter(
		(instant) => instant + offsetAt(instant, timeZoneId) === wall,
	);
	return matching.length ? Math.min(...matching) : wall - offsetBefore;
};

const isIntegerIn = (value: number, lowest: number, highest: number) =>
	Number.isInteger(value) && value >= lowest && value <= highest;

const problemWith = (fields: PartialDate.Fields): string | undefined => {
	const { year, month, day, hour, minute, timeZoneId } = fields;
	if (!isIntegerIn(year, 0, 9999)) return `year ${year} is not between 0 and 9999`;
	if (month === undefined && day !== undefined) return "a day needs a month";
	if (day === undefined && hour !== undefined) return "a time needs a day";
	if ((hour === undefined) !== (minute === undefined)) return "an hour and a minute go together";
	if (month !== undefined && !isIntegerIn(month, 1, 12)) return `month ${month} does not exist`;
	if (day !== undefined && !isIntegerIn(day, 1, daysInMonth(year, month!)))
		return `${year}-${month} has no day ${day}`;
	if (hour !== undefined && !isIntegerIn(hour, 0, 23)) return `hour ${hour} does not exist`;
	if (minute !== undefined && !isIntegerIn(minute, 0, 59)) return `minute ${minute} does not exist`;
	if (!isTimeZoneId(timeZoneId)) return `${timeZoneId} is not an IANA time zone`;
	return undefined;
};

const fieldsOfString = (value: string): PartialDate.Fields | undefined => {
	const groups = PARTIAL_DATE_PATTERN.exec(value)?.groups;
	if (!groups) return undefined;
	const numberOrUndefined = (digits: string | undefined) =>
		digits === undefined ? undefined : Number(digits);
	return {
		year: Number(groups.year),
		month: numberOrUndefined(groups.month),
		day: numberOrUndefined(groups.day),
		hour: numberOrUndefined(groups.hour),
		minute: numberOrUndefined(groups.minute),
		timeZoneId: groups.timeZoneId!,
	};
};

const twoDigits = (value: number) => String(value).padStart(2, "0");

const DEFAULT_LOCALE_FORMATS: Record<PartialDate.Precision, Intl.DateTimeFormatOptions> = {
	year: { year: "numeric" },
	month: { year: "numeric", month: "long" },
	day: { year: "numeric", month: "long", day: "numeric" },
	time: { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" },
};

const requireTemporal = () => {
	if (typeof Temporal === "undefined")
		throw new TypeError(
			"Temporal is not available; load a polyfill such as temporal-polyfill-lite",
		);
	return Temporal;
};

export type PartialDate = PartialDate.Year | PartialDate.Month | PartialDate.Day | PartialDate.Time;

export namespace PartialDate {
	export type Precision = "year" | "month" | "day" | "time";

	export interface Fields {
		year: number;
		month?: number | undefined;
		day?: number | undefined;
		hour?: number | undefined;
		minute?: number | undefined;
		timeZoneId: string;
	}

	export abstract class Base {
		abstract readonly precision: Precision;
		readonly year: number;
		readonly timeZoneId: string;
		readonly #fields: Fields;
		#startEpochMilliseconds: number | undefined;
		#endEpochMilliseconds: number | undefined;

		protected constructor(fields: Fields) {
			const problem = problemWith(fields);
			if (problem) throw new RangeError(`Not a PartialDate: ${problem}`);
			this.#fields = fields;
			this.year = fields.year;
			this.timeZoneId = fields.timeZoneId;
		}

		has(precision: "time"): this is Time;
		has(precision: "day"): this is Day | Time;
		has(precision: "month"): this is Month | Day | Time;
		has(precision: Precision): boolean;
		has(precision: Precision): boolean {
			return PRECISIONS.indexOf(this.precision) >= PRECISIONS.indexOf(precision);
		}

		toYear(): Year {
			return new Year(this.year, this.timeZoneId);
		}

		withPrecision(precision: "year"): Year;
		withPrecision(precision: "month", fill?: "first" | "last"): Month;
		withPrecision(precision: "day", fill?: "first" | "last"): Day;
		withPrecision(precision: "time", fill?: "first" | "last"): Time;
		withPrecision(precision: Precision, fill?: "first" | "last"): PartialDate;
		withPrecision(precision: Precision, fill: "first" | "last" = "first"): PartialDate {
			const { year, timeZoneId } = this;
			const last = fill === "last";
			const month = this.#fields.month ?? (last ? 12 : 1);
			const day = this.#fields.day ?? (last ? daysInMonth(year, month) : 1);
			switch (precision) {
				case "year":
					return new Year(year, timeZoneId);
				case "month":
					return new Month(year, month, timeZoneId);
				case "day":
					return new Day(year, month, day, timeZoneId);
				case "time":
					return new Time(
						year,
						month,
						day,
						this.#fields.hour ?? (last ? 23 : 0),
						this.#fields.minute ?? (last ? 59 : 0),
						timeZoneId,
					);
			}
		}

		get startEpochMilliseconds(): number {
			const { year, month = 1, day = 1, hour, minute } = this.#fields;
			this.#startEpochMilliseconds ??= instantOfWallClock(
				wallClockAsEpochMilliseconds(year, month, day, hour, minute),
				this.timeZoneId,
			);
			return this.#startEpochMilliseconds;
		}

		get endEpochMilliseconds(): number {
			const { year, month = 1, day = 1 } = this.#fields;
			this.#endEpochMilliseconds ??=
				this.precision === "time"
					? this.startEpochMilliseconds
					: instantOfWallClock(
							wallClockAsEpochMilliseconds(
								this.precision === "year" ? year + 1 : year,
								this.precision === "month" ? month + 1 : month,
								this.precision === "day" ? day + 1 : day,
							),
							this.timeZoneId,
						);
			return this.#endEpochMilliseconds;
		}

		isAfter(other: Base | string): boolean {
			const that = from(other);
			return (
				this.startEpochMilliseconds >= that.endEpochMilliseconds &&
				this.startEpochMilliseconds !== that.startEpochMilliseconds
			);
		}

		isBefore(other: Base | string): boolean {
			return from(other).isAfter(this);
		}

		covers(epochMilliseconds: number): boolean {
			if (this.precision === "time") return epochMilliseconds === this.startEpochMilliseconds;
			return (
				this.startEpochMilliseconds <= epochMilliseconds &&
				epochMilliseconds < this.endEpochMilliseconds
			);
		}

		contains(other: Base | string): boolean {
			const that = from(other);
			if (that.precision === "time") return this.covers(that.startEpochMilliseconds);
			return (
				this.startEpochMilliseconds <= that.startEpochMilliseconds &&
				that.endEpochMilliseconds <= this.endEpochMilliseconds
			);
		}

		intersects(other: Base | string): boolean {
			const that = from(other);
			if (this.precision === "time") return that.covers(this.startEpochMilliseconds);
			if (that.precision === "time") return this.covers(that.startEpochMilliseconds);
			return (
				this.startEpochMilliseconds < that.endEpochMilliseconds &&
				that.startEpochMilliseconds < this.endEpochMilliseconds
			);
		}

		equals(other: Base | string): boolean {
			return this.toString() === from(other).toString();
		}

		toString(): PartialDateString {
			const { year, month, day, hour, minute, timeZoneId } = this.#fields;
			let text = String(year).padStart(4, "0");
			if (month !== undefined) text += `-${twoDigits(month)}`;
			if (day !== undefined) text += `-${twoDigits(day)}`;
			if (hour !== undefined) text += `T${twoDigits(hour)}:${twoDigits(minute!)}`;
			return `${text}[${timeZoneId}]` as PartialDateString;
		}

		toJSON(): PartialDateString {
			return this.toString();
		}

		valueOf(): never {
			throw new TypeError("Use PartialDate.compare or isBefore/isAfter to compare PartialDates");
		}

		toLocaleString(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions): string {
			return new Intl.DateTimeFormat(locales, {
				...(options ?? DEFAULT_LOCALE_FORMATS[this.precision]),
				timeZone: this.timeZoneId,
			}).format(this.startEpochMilliseconds);
		}
	}

	export class Year extends Base {
		readonly precision = "year";

		constructor(year: number, timeZoneId: string) {
			super({ year, timeZoneId });
		}

		with(fields: { year?: number; timeZoneId?: string }): Year {
			return new Year(fields.year ?? this.year, fields.timeZoneId ?? this.timeZoneId);
		}

		toMonth(month: number): Month {
			return new Month(this.year, month, this.timeZoneId);
		}
	}

	export class Month extends Base {
		readonly precision = "month";
		readonly month: number;

		constructor(year: number, month: number, timeZoneId: string) {
			super({ year, month, timeZoneId });
			this.month = month;
		}

		get daysInMonth(): number {
			return daysInMonth(this.year, this.month);
		}

		with(fields: { year?: number; month?: number; timeZoneId?: string }): Month {
			return new Month(
				fields.year ?? this.year,
				fields.month ?? this.month,
				fields.timeZoneId ?? this.timeZoneId,
			);
		}

		toDay(day: number): Day {
			return new Day(this.year, this.month, day, this.timeZoneId);
		}

		toPlainYearMonth(): Temporal.PlainYearMonth {
			return new (requireTemporal().PlainYearMonth)(this.year, this.month);
		}
	}

	export class Day extends Base {
		readonly precision = "day";
		readonly month: number;
		readonly day: number;

		constructor(year: number, month: number, day: number, timeZoneId: string) {
			super({ year, month, day, timeZoneId });
			this.month = month;
			this.day = day;
		}

		with(fields: { year?: number; month?: number; day?: number; timeZoneId?: string }): Day {
			return new Day(
				fields.year ?? this.year,
				fields.month ?? this.month,
				fields.day ?? this.day,
				fields.timeZoneId ?? this.timeZoneId,
			);
		}

		toMonth(): Month {
			return new Month(this.year, this.month, this.timeZoneId);
		}

		toTime(hour: number, minute: number): Time {
			return new Time(this.year, this.month, this.day, hour, minute, this.timeZoneId);
		}

		toPlainDate(): Temporal.PlainDate {
			return new (requireTemporal().PlainDate)(this.year, this.month, this.day);
		}
	}

	export class Time extends Base {
		readonly precision = "time";
		readonly month: number;
		readonly day: number;
		readonly hour: number;
		readonly minute: number;

		constructor(
			year: number,
			month: number,
			day: number,
			hour: number,
			minute: number,
			timeZoneId: string,
		) {
			super({ year, month, day, hour, minute, timeZoneId });
			this.month = month;
			this.day = day;
			this.hour = hour;
			this.minute = minute;
		}

		with(fields: {
			year?: number;
			month?: number;
			day?: number;
			hour?: number;
			minute?: number;
			timeZoneId?: string;
		}): Time {
			return new Time(
				fields.year ?? this.year,
				fields.month ?? this.month,
				fields.day ?? this.day,
				fields.hour ?? this.hour,
				fields.minute ?? this.minute,
				fields.timeZoneId ?? this.timeZoneId,
			);
		}

		toMonth(): Month {
			return new Month(this.year, this.month, this.timeZoneId);
		}

		toDay(): Day {
			return new Day(this.year, this.month, this.day, this.timeZoneId);
		}

		toPlainDate(): Temporal.PlainDate {
			return new (requireTemporal().PlainDate)(this.year, this.month, this.day);
		}

		toPlainDateTime(): Temporal.PlainDateTime {
			return new (requireTemporal().PlainDateTime)(
				this.year,
				this.month,
				this.day,
				this.hour,
				this.minute,
			);
		}

		toZonedDateTime(): Temporal.ZonedDateTime {
			return requireTemporal()
				.Instant.fromEpochMilliseconds(this.startEpochMilliseconds)
				.toZonedDateTimeISO(this.timeZoneId);
		}
	}

	export function isValid(value: unknown): value is PartialDateString {
		if (typeof value !== "string") return false;
		const fields = fieldsOfString(value);
		return fields !== undefined && problemWith(fields) === undefined;
	}

	export function from(value: PartialDateString.YearMonthDayTime): Time;
	export function from(value: PartialDateString.YearMonthDay): Day;
	export function from(value: PartialDateString.YearMonth): Month;
	export function from(value: PartialDateString.YearOnly): Year;
	export function from(value: Base | string | Fields): PartialDate;
	export function from(value: Base | string | Fields): PartialDate {
		if (value instanceof Base) return value as PartialDate;
		const fields =
			typeof value === "string"
				? fieldsOfString(value)
				: {
						year: value.year,
						month: value.month,
						day: value.day,
						hour: value.hour,
						minute: value.minute,
						timeZoneId: value.timeZoneId,
					};
		if (!fields) throw new RangeError(`${value} is not a PartialDate`);
		const { year, month, day, hour, minute, timeZoneId } = fields;
		if (hour !== undefined || minute !== undefined)
			return new Time(year, month!, day!, hour!, minute!, timeZoneId);
		if (day !== undefined) return new Day(year, month!, day, timeZoneId);
		if (month !== undefined) return new Month(year, month, timeZoneId);
		return new Year(year, timeZoneId);
	}

	export function fromEpochMilliseconds(epochMilliseconds: number, timeZoneId: string): Time {
		if (!Number.isFinite(epochMilliseconds))
			throw new RangeError(`${epochMilliseconds} is not a point in time`);
		if (!isTimeZoneId(timeZoneId)) throw new RangeError(`${timeZoneId} is not an IANA time zone`);
		const { year, month, day, hour, minute } = wallClockAt(epochMilliseconds, timeZoneId);
		return new Time(year, month, day, hour, minute, timeZoneId);
	}

	export function now(timeZoneId = new Intl.DateTimeFormat().resolvedOptions().timeZone): Time {
		return fromEpochMilliseconds(Date.now(), timeZoneId);
	}

	export function compare(one: Base | string, other: Base | string): -1 | 0 | 1 {
		const a = from(one);
		const b = from(other);
		const byStart = Math.sign(a.startEpochMilliseconds - b.startEpochMilliseconds);
		if (byStart !== 0) return byStart as -1 | 1;
		return Math.sign(PRECISIONS.indexOf(b.precision) - PRECISIONS.indexOf(a.precision)) as
			| -1
			| 0
			| 1;
	}
}
