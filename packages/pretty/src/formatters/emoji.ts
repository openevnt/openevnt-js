import { PartialDate as PartialDates } from "@evnt/partial-date";
import type { EventStatus, PartialDate, Venue } from "@evnt/types";
import type { DateGroup } from "../types.js";
import type { FormatOptions } from "./base.js";
import { PlainTextFormatter } from "./base.js";

export interface EmojiFormatOptions extends FormatOptions {
	emoji: Record<string, string> | false;
	statusIcons: Record<EventStatus, string>;
}

export type EmojiFormatInput = Partial<EmojiFormatOptions> & {
	emoji?: Record<string, string> | false;
};

const hasTime = (pd: PartialDate) => PartialDates.from(pd).has("time");

export class EmojiFormatter extends PlainTextFormatter {
	static readonly emojiDefaults: EmojiFormatOptions = {
		...PlainTextFormatter.defaultOptions,
		emoji: {
			calendar: "📅",
			clock: "🕐",
			venue: "📍",
			link: "🔗",
		},
		statusIcons: {
			uncertain: "🟡",
			postponed: "🟡",
			cancelled: "🔴",
		},
	};

	constructor(options: EmojiFormatInput = EmojiFormatter.emojiDefaults) {
		const merged = { ...EmojiFormatter.emojiDefaults, ...options };
		if (merged.emoji === false) {
			merged.emoji = {};
			merged.statusIcons = { uncertain: "", postponed: "", cancelled: "" };
		}
		super(merged);
	}

	private get emojiMap(): Record<string, string> {
		const cfg = this.options as EmojiFormatOptions;
		return cfg.emoji === false ? {} : cfg.emoji;
	}

	private get statusIconMap(): Record<EventStatus, string> {
		return (this.options as EmojiFormatOptions).statusIcons;
	}

	override formatStatus(status: EventStatus, text: string): string {
		const icon = this.statusIconMap[status] ?? "";
		return [icon, text].filter(Boolean).join(" ");
	}

	protected override formatDateGroup(group: DateGroup): string {
		const lines: string[] = [];

		const dateStr = this.formatDateShape(group.dates);
		if (dateStr) lines.push([this.emojiMap.calendar, dateStr].filter(Boolean).join(" "));

		const timeStr = group.times
			.map((t) => this.formatTimeRange(t.start, t.end))
			.filter(Boolean)
			.join(", ");
		if (timeStr) {
			const firstTime = group.times[0]?.start ?? group.times[0]?.end;
			const clockIcon =
				firstTime && hasTime(firstTime) ? this.clockEmoji(firstTime) : this.emojiMap.clock;
			lines.push([clockIcon ?? this.emojiMap.clock ?? "🕐", timeStr].filter(Boolean).join(" "));
		}

		return lines.join("\n");
	}

	protected override formatVenue(venue: Venue): string {
		return [this.emojiMap.venue, super.formatVenue(venue)].filter(Boolean).join(" ");
	}

	protected clockEmoji(pd: PartialDate): string {
		const date = PartialDates.from(pd);
		if (date.precision !== "time") return this.emojiMap.clock ?? "🕐";
		const hour12 = date.hour % 12 || 12;
		const base = date.minute >= 30 ? 0x1f55c : 0x1f550;
		return String.fromCodePoint(base + hour12 - 1);
	}

	protected override formatLink(url: string, name?: string): string {
		const icon = this.emojiMap.link ?? "";
		return [icon, super.formatLink(url, name)].filter(Boolean).join(" ");
	}
}
