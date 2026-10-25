import { describe, expect, test } from "vitest";
import { MarkdownFormatter, type EmojiFormatInput } from "../src/index";
import type { OpenEvnt, PartialDate } from "@evnt/types";

const renderMarkdown = (event: OpenEvnt, options?: EmojiFormatInput) =>
	new MarkdownFormatter(options).formatEvent(event);

const date = "2025-01-01[UTC]" as PartialDate;

const baseEvent: OpenEvnt = {
	v: "0.2",
	id: "https://example.com/events/test",
	name: { en: "Test Event" },
};

describe("renderMarkdown", () => {
	test("renders event name", () => {
		const result = renderMarkdown(baseEvent);
		expect(result).toContain("Test Event");
	});

	test("handles minimal event without crashing", () => {
		const event: OpenEvnt = { ...baseEvent, name: {} };
		const result = renderMarkdown(event);
		expect(typeof result).toBe("string");
	});

	test("renders the venue name", () => {
		const event: OpenEvnt = {
			...baseEvent,
			venue: { name: { en: "Test Venue" } },
			occurrences: [{ start: date }],
		};
		const result = renderMarkdown(event);
		expect(result).toContain("Test Venue");
	});

	test("renders the venue address when it has no name", () => {
		const event: OpenEvnt = {
			...baseEvent,
			venue: { address: "Vilnius" },
			occurrences: [{ start: date }],
		};
		expect(renderMarkdown(event)).toContain("📍 Vilnius");
	});

	test("renders date from occurrence", () => {
		const event: OpenEvnt = { ...baseEvent, occurrences: [{ start: date }] };
		const result = renderMarkdown(event);
		expect(result).toContain("Jan");
	});

	test("renders link components when showLinks is enabled", () => {
		const event: OpenEvnt = {
			...baseEvent,
			occurrences: [{ start: date }],
			components: [
				{
					$type: "directory.evnt.component.link#0",
					url: "https://example.com",
				},
			],
		};
		const result = renderMarkdown(event, { showLinks: true });
		expect(result).toContain("example.com");
	});

	test("leaves out disabled links", () => {
		const event: OpenEvnt = {
			...baseEvent,
			components: [
				{
					$type: "directory.evnt.component.link#0",
					url: "https://example.com/tickets",
					disabled: true,
				},
			],
		};
		const result = renderMarkdown(event, { showLinks: true });
		expect(result).not.toContain("tickets");
	});

	test("shows status when showStatus is enabled", () => {
		const event: OpenEvnt = {
			...baseEvent,
			status: "cancelled",
			occurrences: [{ start: date }],
		};
		const result = renderMarkdown(event, { showStatus: true });
		expect(result).toContain("Cancelled");
	});

	test("does not show status by default", () => {
		const event: OpenEvnt = {
			...baseEvent,
			status: "cancelled",
			occurrences: [{ start: date }],
		};
		const result = renderMarkdown(event);
		expect(result).not.toContain("Cancelled");
	});

	test("emoji: false disables emoji icons", () => {
		const result = renderMarkdown(baseEvent, { emoji: false });
		expect(result).toContain("Test Event");
	});
});

describe("UniCon 2026 (real-world event)", () => {
	const uniCon: OpenEvnt = {
		v: "0.2",
		id: "https://unicon.lv/2026",
		name: { en: "UniCon 2026" },
		venue: {
			name: { en: "Kipsala International Exhibition Centre" },
			address: "Kipsalas iela 1, LV-1043 Riga, Latvia",
			countryCode: "LV",
		},
		occurrences: [
			{
				start: "2026-08-14T14:00[Europe/Riga]",
				end: "2026-08-14T20:00[Europe/Riga]",
			},
			{
				start: "2026-08-15T12:00[Europe/Riga]",
				end: "2026-08-15T20:00[Europe/Riga]",
			},
			{
				start: "2026-08-16T12:00[Europe/Riga]",
				end: "2026-08-16T20:00[Europe/Riga]",
			},
		],
	};

	test("venue once, before the dates", () => {
		const result = renderMarkdown(uniCon);
		expect(result.match(/Kipsala/g)).toHaveLength(1);
		const venueIdx = result.indexOf("Kipsala");
		const dateIdx = result.indexOf("📅");
		expect(venueIdx).toBeLessThan(dateIdx);
	});

	test("Aug 15–16 merge into a range (same times), Aug 14 stays separate", () => {
		const result = renderMarkdown(uniCon);
		expect(result).toContain("Aug 14");
		expect(result).toContain("Aug 15");
		expect(result).not.toMatch(/Aug 16(?!\d)/);
	});

	test("renders without parenthetical time offsets", () => {
		const result = renderMarkdown(uniCon);
		expect(result).not.toContain("(");
		expect(result).not.toContain(")");
	});
});
