import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { OpenEvntValidator } from "../src/index";

const examples = join(import.meta.dirname, "../../../../evnt/examples");
const read = (folder: string) =>
	readdirSync(join(examples, folder))
		.filter((name) => name.endsWith(".evnt.json"))
		.map((name) => [name, JSON.parse(readFileSync(join(examples, folder, name), "utf8"))] as const);

describe.skipIf(!existsSync(examples))(`evnt examples in ${examples}`, () => {
	test.each(existsSync(examples) ? read("valid") : [])("valid/%s", (_, document) => {
		expect(OpenEvntValidator.validate(document).issues).toBeUndefined();
	});

	test.each(existsSync(examples) ? read("invalid") : [])("invalid/%s", (_, document) => {
		expect(OpenEvntValidator.validate(document).issues?.length).toBeGreaterThan(0);
	});
});
