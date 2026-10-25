import pc from "picocolors";
import { OpenEvntValidator } from "@evnt/schema";
import { SchemaValidationError } from "../errors.js";

export default function (json: unknown, raw: string, label: string) {
	const result = OpenEvntValidator.validate(json);

	if (!result.issues) {
		console.log(pc.green("✓") + ` Valid: ${label}`);
	} else {
		const err = new SchemaValidationError(label, result.issues, raw);
		console.error(pc.red("✗") + ` Invalid: ${label}`);
		console.error(err.getCodeFrames());
		process.exit(1);
	}
}
