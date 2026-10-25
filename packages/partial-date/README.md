# @evnt/partial-date

Partial dates for [Open Evnt](https://evnt.directory).

```
2026[UTC]
2026-06[Europe/London]
2026-06-15[America/New_York]
2026-06-15T18:00[Europe/London]
2026-06-15T18:00[Etc/GMT+5]
```

The string type is `PartialDate` in `@evnt/types`, re-exported here as `PartialDateString`.

## Usage

```ts
import { PartialDate } from "@evnt/partial-date";

const start = PartialDate.from("2026-06-15T18:00[Europe/London]"); // PartialDate.Time
start.hour; // 18
start.toString(); // "2026-06-15T18:00[Europe/London]"

PartialDate.isValid("2026-02-29[UTC]"); // false, there is no 29 February in 2026
new PartialDate.Day(2026, 2, 29, "UTC"); // throws a RangeError
```

Each precision has its own immutable class: `PartialDate.Year`, `PartialDate.Month`,
`PartialDate.Day` and `PartialDate.Time`. The type `PartialDate` is the union of the four, so a
`switch` on `precision` narrows it:

```ts
function label(date: PartialDate) {
	switch (date.precision) {
		case "year":
			return `${date.year}`;
		case "day":
			return `${date.day}/${date.month}`; // both numbers
		// ...
	}
}
```

`instanceof PartialDate.Day` works too, and `has("day")` narrows to a day or a time. `from` with a
string literal already returns the right class; with any other string it returns the union, and it
throws a `RangeError` for anything that is not a valid partial date.

### Changing a date

```ts
start.with({ day: 16 }); // 2026-06-16T18:00[Europe/London], same precision

start.toDay(); // 2026-06-15[Europe/London]
start.toYear().toMonth(2).toDay(28).toTime(9, 30); // 2026-02-28T09:30[Europe/London]
PartialDate.from("2026-02[UTC]").daysInMonth; // 28
```

A class only has the conversions that make sense for it: `Year.toMonth(month)`, `Month.toDay(day)`,
`Day.toTime(hour, minute)`, `Day.toMonth()`, `Time.toDay()`, `Time.toMonth()`, and `toYear()` on
all of them. For code that picks the precision at runtime, such as an editor, `withPrecision` goes
either way and fills missing fields with their first or last value:

```ts
date.withPrecision("time"); // a day becomes its 00:00
PartialDate.from("2026-02[UTC]").withPrecision("day", "last"); // 2026-02-28[UTC]
```

### Periods and order

A partial date covers a period: a whole year, month or day, or the single instant of a time
([spec §3](https://evnt.directory/spec/open-evnt-partialdate)). `startEpochMilliseconds` is the first
instant of the period and `endEpochMilliseconds` the first instant after it. A time that a clock change
skips uses the offset from before the change, and a time that happens twice is the first of the two.

`PartialDate.fromEpochMilliseconds` goes the other way, from an instant to the time a clock in that
zone shows, to the minute.

```ts
const day = PartialDate.from("2026-03-29[Europe/Vilnius]");
(day.endEpochMilliseconds - day.startEpochMilliseconds) / 3_600_000; // 23
PartialDate.fromEpochMilliseconds(Date.parse("2026-11-14T16:05Z"), "Europe/Vilnius"); // 2026-11-14T18:05[Europe/Vilnius]

PartialDate.from("2025-11-12[Europe/London]").isAfter("2025-11-12T18:00[Europe/London]"); // false
dates.sort(PartialDate.compare); // by start, the finer precision first on a tie
```

`contains`, `intersects` and `covers` (an epoch millisecond) work on the same periods.

### Formatting

```ts
PartialDate.from("2026-11[Europe/Vilnius]").toLocaleString("en"); // "November 2026"
```

Without options, `toLocaleString` shows only the fields the precision has. It always formats in the
date's own time zone.

## Temporal

None of the above needs Temporal. The conversions do, and throw a `TypeError` without it:

```ts
const time = PartialDate.from("2026-11-14T18:00[Europe/Vilnius]");
time.toPlainDate(); // Temporal.PlainDate, on days and times
time.toZonedDateTime(); // Temporal.ZonedDateTime, on times
time.toMonth().toPlainYearMonth(); // Temporal.PlainYearMonth, on months

time.with(time.toPlainDateTime().add({ weeks: 1 })); // 2026-11-21T18:00[Europe/Vilnius]
PartialDate.from(zonedDateTime); // a time in that zone
```

For environments without native Temporal, use
[temporal-polyfill-lite](https://npmx.dev/package/temporal-polyfill-lite).

## From 0.1

| 0.1 (`PartialDateUtil`)            | now                                             |
| ---------------------------------- | ----------------------------------------------- |
| `parse(text)`                      | `PartialDate.from(text)`                        |
| `format(parsed)`                   | `date.toString()`                               |
| `getPrecision(text)`               | `date.precision` or `instanceof`                |
| `has(text, precision)`             | `date.has(precision)`                           |
| `lowerPrecision(text, "day")`      | `time.toDay()`, or `withPrecision("day")`       |
| `setPrecision(text, p, "low")`     | `date.withPrecision(p, "first")`                |
| `setPrecision(text, p, "high")`    | `date.withPrecision(p, "last")`                 |
| `withTimezone(text, zone)`         | `date.with({ timeZoneId: zone })`               |
| `parsedFromTemporal(value)`        | `date.with(value)` or `PartialDate.from(zoned)` |
| `toInstant(text, "low")`           | `date.startEpochMilliseconds`                   |
| `toInstant(text, "high")`          | `date.endEpochMilliseconds`                     |
| `isContainedIn(inner, outer)`      | `outer.contains(inner)`                         |
| `asPlainDate(text)` and the others | `date.toPlainDate()` and the others             |
| `asFormattableTemporal(text)`      | `date.toLocaleString(locales, options)`         |
| `PartialDateRegex`                 | `PartialDate.isValid`                           |

`endEpochMilliseconds` is the first instant after the period; `toInstant(text, "high")` was the last
minute in it (23:59). `getPrecisionEquality` is gone: compare `withPrecision(...)` of both dates with
`equals`.
