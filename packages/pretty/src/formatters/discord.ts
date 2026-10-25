import { PartialDate as PartialDates } from "@evnt/partial-date";
import type { PartialDate, Venue } from "@evnt/types";
import type { DateGroup } from "../types.js";
import { MarkdownFormatter } from "./markdown.js";
import type { EmojiFormatOptions } from "./emoji.js";

export type TimestampStyle = "off" | "both" | "only";

export interface DiscordFormatOptions extends EmojiFormatOptions {
	timestampStyle: TimestampStyle;
}

export type DiscordFormatInput = Partial<DiscordFormatOptions> & {
	emoji?: Record<string, string> | false;
};

export class DiscordFormatter extends MarkdownFormatter {
	static readonly discordDefaults: DiscordFormatOptions = {
		...MarkdownFormatter.markdownDefaults,
		timestampStyle: "off",
	};

	constructor(options: DiscordFormatInput = DiscordFormatter.discordDefaults) {
		super(options);
	}

	protected override mdLink(text: string, url: string): string {
		return `[${text}](${url})`;
	}

	protected override mdSubtext(text: string): string {
		return text
			.split("\n")
			.map((line) => `-# ${line}`)
			.join("\n");
	}

	private get tsStyle(): TimestampStyle {
		return (this.options as DiscordFormatOptions).timestampStyle ?? "off";
	}

	private unixTs(pd: PartialDate): number {
		return PartialDates.from(pd).startEpochMilliseconds / 1000;
	}

	private tsChar(pd: PartialDate): string {
		return PartialDates.from(pd).has("time") ? "f" : "D";
	}

	private discordTs(pd: PartialDate): string {
		return `<t:${Math.floor(this.unixTs(pd))}:${this.tsChar(pd)}>`;
	}

	protected override formatDate(pd: PartialDate): string {
		if (this.tsStyle === "off") return super.formatDate(pd);
		const ts = this.discordTs(pd);
		if (this.tsStyle === "both") return `${ts} (${super.formatDate(pd)})`;
		return ts;
	}

	protected override formatTime(pd: PartialDate): string {
		if (this.tsStyle === "off") return super.formatTime(pd);
		const ts = this.discordTs(pd);
		if (this.tsStyle === "both") return `${ts} (${super.formatTime(pd)})`;
		return ts;
	}

	protected override formatDateRange(start: PartialDate, end: PartialDate): string {
		if (this.tsStyle === "off") return super.formatDateRange(start, end);
		const ts = `${this.discordTs(start)}–${this.discordTs(end)}`;
		if (this.tsStyle === "both") return `${ts} (${super.formatDateRange(start, end)})`;
		return ts;
	}

	protected override formatTimeRange(start?: PartialDate, end?: PartialDate): string {
		if (this.tsStyle === "off") return super.formatTimeRange(start, end);

		if (start && end) {
			const ts = `${this.discordTs(start)}–${this.discordTs(end)}`;
			if (this.tsStyle === "both") return `${ts} (${super.formatTimeRange(start, end)})`;
			return ts;
		}
		if (start) {
			const ts = this.discordTs(start);
			if (this.tsStyle === "both") return `${ts} (${super.formatTime(start)})`;
			return ts;
		}
		return "";
	}

	protected override clockEmoji(_pd: PartialDate): string {
		if (this.tsStyle !== "off") return "";
		return super.clockEmoji(_pd);
	}

	protected override formatVenueAndDates(venue: Venue | undefined, groups: DateGroup[]): string {
		if (this.tsStyle === "only") {
			const venueStr = venue
				? venue.name
					? this.resolveText(venue.name)
					: (venue.address ?? "")
				: "";

			return groups
				.map((g) => {
					const dateStr = this.formatDateShape(g.dates);
					const timeStr = g.times
						.map((t) => this.formatTimeRange(t.start, t.end))
						.filter(Boolean)
						.join(", ");
					return [dateStr, timeStr, venueStr].filter(Boolean).join(" · ");
				})
				.join("\n");
		}
		return super.formatVenueAndDates(venue, groups);
	}
}
