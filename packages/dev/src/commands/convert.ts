import type { OpenEvnt } from "@evnt/types";
import pc from "picocolors";
import { formats, type FormatId } from "@evnt/convert";

const help = `Convert an OpenEvnt event to another format.

Supported formats: ${Object.entries(formats)
	.map(([key, fmt]) => `  ${key} — ${fmt.description ?? fmt.name} (.${fmt.extensions.join(", .")})`)
	.join("\n")}`;

export default async function (event: unknown, flags: { format?: string; out?: string }) {
	const fmtName = flags.format as FormatId | undefined;

	if (!fmtName || !(fmtName in formats)) {
		console.error(help);
		if (fmtName) console.error(`\nUnknown format: ${fmtName}`);
		process.exit(1);
	}

	const format = formats[fmtName]!;

	if (!("to" in format)) {
		console.error(`Format "${fmtName}" does not support conversion to OpenEvnt → ${format.name}`);
		console.error(`  Only "from" is defined (${format.name} → OpenEvnt).`);
		process.exit(1);
	}

	const document = format.to(event as OpenEvnt);
	const output = typeof document === "string" ? document : JSON.stringify(document, null, "\t");

	if (flags.out) {
		const { writeFileSync } = await import("node:fs");
		writeFileSync(flags.out, output, "utf-8");
		console.error(pc.green("✓") + ` Written to ${flags.out}`);
	} else {
		process.stdout.write(output);
		if (!output.endsWith("\n")) process.stdout.write("\n");
	}
}
