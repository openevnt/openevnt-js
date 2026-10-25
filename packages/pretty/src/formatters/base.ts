import { TranslationsUtil, type MaybeTranslations } from "@evnt/translations";
import type {
	EventStatus,
	LinkComponent,
	OpenEvnt,
	PartialDate,
	SourceComponent,
	Venue,
} from "@evnt/types";
import type { DateGroup } from "../types.js";
import { groupDates } from "../analyze.js";
import { formatDate, formatDateRange, formatTime, formatTimeRange } from "../date.js";

export interface FormatOptions {
	language: string;
	timezone: string | null;
	groupConsecutiveDates: boolean;
	showStatus: boolean;
	showLinks: boolean;
	compactDates: boolean;
	maxDates: number;
}

const statusTexts: Record<EventStatus, string> = {
	uncertain: "Uncertain",
	postponed: "Postponed",
	cancelled: "Cancelled",
};

export class PlainTextFormatter {
	static readonly defaultOptions: FormatOptions = {
		language: "en",
		timezone: null,
		groupConsecutiveDates: true,
		showStatus: false,
		showLinks: false,
		compactDates: true,
		maxDates: 5,
	};

	constructor(protected options: FormatOptions = PlainTextFormatter.defaultOptions) {}

	formatEvent(event: OpenEvnt): string {
		const lines: string[] = [];

		const name = this.resolveText(event.name);
		lines.push(this.formatHeader(name));

		if (this.options.showStatus && event.status) {
			const text = statusTexts[event.status] ?? event.status;
			lines.push(this.formatStatus(event.status, text));
		}

		const groups = groupDates(event.occurrences ?? [], this.options.groupConsecutiveDates);
		const totalDates = groups.length;
		const shownCount =
			this.options.maxDates > 0 ? Math.min(totalDates, this.options.maxDates) : totalDates;

		lines.push(this.formatVenueAndDates(event.venue, groups.slice(0, shownCount)));
		if (totalDates > shownCount) {
			lines.push(`+ ${totalDates - shownCount} more dates`);
		}

		if (this.options.showLinks) {
			for (const comp of event.components ?? []) {
				if (comp.$type === "directory.evnt.component.link#0") {
					const link = comp as LinkComponent;
					if (!link.disabled)
						lines.push(
							this.formatLink(link.url, link.name ? this.resolveText(link.name) : undefined),
						);
				}
				if (comp.$type === "directory.evnt.component.source#0") {
					lines.push(this.formatLink((comp as SourceComponent).url));
				}
			}
		}

		return lines.filter(Boolean).join("\n");
	}

	protected formatHeader(text: string): string {
		return text;
	}

	formatStatus(_status: EventStatus, text: string): string {
		return text;
	}

	protected formatVenueAndDates(venue: Venue | undefined, groups: DateGroup[]): string {
		const venueStr = venue ? this.formatVenue(venue) : "";
		const dateLines = groups.map((g) => this.formatDateGroup(g));
		return [venueStr, dateLines.join("\n\n")].filter(Boolean).join("\n");
	}

	protected formatDateGroup(group: DateGroup): string {
		const lines: string[] = [];

		const dateStr = this.formatDateShape(group.dates);
		if (dateStr) lines.push(dateStr);

		const timeStr = group.times
			.map((t) => this.formatTimeRange(t.start, t.end))
			.filter(Boolean)
			.join(", ");
		if (timeStr) lines.push(timeStr);

		return lines.join("\n");
	}

	protected formatVenue(venue: Venue): string {
		return venue.name ? this.resolveText(venue.name) : (venue.address ?? "");
	}

	protected formatDateShape(shape: DateGroup["dates"]): string {
		switch (shape.type) {
			case "single":
				return this.formatDate(shape.date);
			case "range":
				return this.formatDateRange(shape.from, shape.to);
			case "list":
				return shape.dates.map((d) => this.formatDate(d)).join(", ");
		}
	}

	protected formatDate(pd: PartialDate): string {
		return formatDate(pd, this.options);
	}

	protected formatDateRange(start: PartialDate, end: PartialDate): string {
		return formatDateRange(start, end, this.options);
	}

	protected formatTimeRange(start?: PartialDate, end?: PartialDate): string {
		return formatTimeRange(start, end, this.options);
	}

	protected formatTime(pd: PartialDate): string {
		return formatTime(pd, this.options);
	}

	protected formatLink(url: string, name?: string): string {
		return name ?? url;
	}

	protected resolveText(translations: MaybeTranslations): string {
		return TranslationsUtil.translate(translations, [this.options.language]);
	}
}
