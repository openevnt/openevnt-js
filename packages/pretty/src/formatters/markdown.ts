import { EmojiFormatter, type EmojiFormatInput, type EmojiFormatOptions } from "./emoji.js";

export class MarkdownFormatter extends EmojiFormatter {
	static readonly markdownDefaults: EmojiFormatOptions = {
		...EmojiFormatter.emojiDefaults,
	};

	constructor(options: EmojiFormatInput = MarkdownFormatter.markdownDefaults) {
		super(options);
	}

	protected override formatHeader(text: string): string {
		return `**${text}**`;
	}

	protected override formatLink(url: string, name?: string): string {
		const emoji = (this.options as EmojiFormatOptions).emoji;
		const icon = emoji === false ? "" : (emoji.link ?? "");
		const text = name ? this.mdLink(name, url) : url;
		return [icon, text].filter(Boolean).join(" ");
	}

	protected mdLink(text: string, url: string): string {
		return `[${text}](${url})`;
	}

	protected mdBold(text: string): string {
		return `**${text}**`;
	}

	protected mdItalic(text: string): string {
		return `*${text}*`;
	}

	protected mdStrikethrough(text: string): string {
		return `~~${text}~~`;
	}

	protected mdSubtext(text: string): string {
		return text;
	}
}
