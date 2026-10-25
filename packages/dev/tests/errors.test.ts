import { describe, expect, test } from "vitest";
import { SchemaValidationError, JSONParseError } from "../src/index";

describe("SchemaValidationError", () => {
	const issues = [{ message: "must be a string", path: ["name", "en"] }];

	test("stores path, issues, and fileContent", () => {
		const error = new SchemaValidationError("/path/to/file.json", issues, "content");
		expect(error.path).toBe("/path/to/file.json");
		expect(error.issues).toBe(issues);
		expect(error.fileContent).toBe("content");
	});

	test("getCodeFrames points at the value of each issue", () => {
		const error = new SchemaValidationError("/path/file.json", issues, '{"name": {"en": 42}}');
		const frames = error.getCodeFrames();
		expect(frames).toContain("/path/file.json");
		expect(frames).toContain("Issue: must be a string");
		expect(frames).toContain("42");
	});

	test("prettify names the path of each issue", () => {
		const error = new SchemaValidationError("/path/file.json", issues, "{}");
		expect(error.prettify()).toBe("name.en: must be a string");
	});
});

describe("JSONParseError", () => {
	test("stores path and wraps SyntaxError", () => {
		const syntaxError = new SyntaxError("Unexpected token");
		const error = new JSONParseError("/path/to/file.json", syntaxError);
		expect(error.path).toBe("/path/to/file.json");
		expect(error.syntaxError).toBe(syntaxError);
	});

	test("is instance of Error", () => {
		const error = new JSONParseError("/f.json", new SyntaxError("bad"));
		expect(error).toBeInstanceOf(Error);
	});
});
