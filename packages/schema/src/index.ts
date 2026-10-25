import type { AnyComponent, Occurrence, OpenEvnt, Venue } from "@evnt/types";
import { COMPONENT_TYPE_PATTERN, openEvnt, type Path, type Validation } from "./checks.js";
import type { StandardSchemaV1 } from "./standard-schema.js";

export type { StandardSchemaV1 };

export type ComponentValidators = Readonly<Record<string, StandardSchemaV1>>;

export type ComponentFrom<Validators extends ComponentValidators> = {
	[Type in keyof Validators & string]: StandardSchemaV1.InferOutput<Validators[Type]> & {
		$type: Type;
	};
}[keyof Validators & string];

export type OpenEvntWithComponents<Extra> = Omit<
	OpenEvnt,
	"venue" | "occurrences" | "components"
> & {
	venue?: Omit<Venue, "components"> & { components?: (AnyComponent | Extra)[] };
	occurrences?: (Omit<Occurrence, "components"> & { components?: (AnyComponent | Extra)[] })[];
	components?: (AnyComponent | Extra)[];
};

export interface OpenEvntValidator<Output = OpenEvnt> extends StandardSchemaV1<unknown, Output> {
	validate(value: unknown): StandardSchemaV1.Result<Output>;
	validateAsync(value: unknown): Promise<StandardSchemaV1.Result<Output>>;
	parse(value: unknown): Output;
	parseAsync(value: unknown): Promise<Output>;
}

const describeIssue = ({ message, path = [] }: StandardSchemaV1.Issue) =>
	path.length
		? `${path.map((segment) => String(typeof segment === "object" ? segment.key : segment)).join(".")}: ${message}`
		: message;

export class OpenEvntValidationError extends Error {
	readonly issues: readonly StandardSchemaV1.Issue[];

	constructor(issues: readonly StandardSchemaV1.Issue[]) {
		super(issues.map(describeIssue).join("\n"));
		this.name = "OpenEvntValidationError";
		this.issues = issues;
	}
}

const isPromise = <Value>(value: Value | Promise<Value>): value is Promise<Value> =>
	typeof (value as { then?: unknown } | null)?.then === "function";

const replaceAt = (root: unknown, path: Path, replacement: unknown): unknown => {
	const [segment, ...rest] = path;
	if (segment === undefined) return replacement;
	const key = typeof segment === "object" ? segment.key : segment;
	const copy = (Array.isArray(root) ? [...root] : { ...(root as object) }) as Record<
		PropertyKey,
		unknown
	>;
	copy[key] = replaceAt(copy[key], rest, replacement);
	return copy;
};

const conclude = <Output>(
	value: unknown,
	validation: Validation,
	componentResults: readonly StandardSchemaV1.Result<unknown>[],
): StandardSchemaV1.Result<Output> => {
	const issues = [...validation.issues];
	let output = value;
	componentResults.forEach((result, index) => {
		const pending = validation.pendingComponents[index]!;
		if (result.issues)
			issues.push(
				...result.issues.map((issue) => ({
					message: issue.message,
					path: [...pending.path, ...(issue.path ?? [])],
				})),
			);
		else if (result.value !== pending.value) output = replaceAt(output, pending.path, result.value);
	});
	return issues.length ? { issues } : { value: output as Output };
};

export function createOpenEvntValidator<const Validators extends ComponentValidators = {}>(
	componentValidators: Validators = {} as Validators,
): OpenEvntValidator<OpenEvntWithComponents<ComponentFrom<Validators>>> {
	type Output = OpenEvntWithComponents<ComponentFrom<Validators>>;
	type Result = StandardSchemaV1.Result<Output>;

	for (const [type, validator] of Object.entries(componentValidators)) {
		if (!COMPONENT_TYPE_PATTERN.test(type))
			throw new TypeError(`${type} is not a component type such as com.example.ticketTier#0`);
		if (typeof validator?.["~standard"]?.validate !== "function")
			throw new TypeError(`The validator for ${type} does not implement Standard Schema`);
	}

	const run = (value: unknown): Result | Promise<Result> => {
		const validation: Validation = { issues: [], pendingComponents: [], componentValidators };
		openEvnt(value, [], validation);
		const componentResults = validation.pendingComponents.map((pending) =>
			pending.validator["~standard"].validate(pending.value),
		);
		if (componentResults.some(isPromise))
			return Promise.all(componentResults).then((settled) =>
				conclude<Output>(value, validation, settled),
			);
		return conclude<Output>(
			value,
			validation,
			componentResults as StandardSchemaV1.Result<unknown>[],
		);
	};

	const validate = (value: unknown): Result => {
		const result = run(value);
		if (isPromise(result)) {
			result.catch(() => {});
			throw new TypeError("A component validator is asynchronous; use validateAsync or parseAsync");
		}
		return result;
	};

	const valueOrThrow = (result: Result): Output => {
		if (result.issues) throw new OpenEvntValidationError(result.issues);
		return result.value;
	};

	return {
		"~standard": { version: 1, vendor: "evnt", validate: run },
		validate,
		validateAsync: async (value) => run(value),
		parse: (value) => valueOrThrow(validate(value)),
		parseAsync: async (value) => valueOrThrow(await run(value)),
	};
}

export const OpenEvntValidator: OpenEvntValidator = createOpenEvntValidator();

// All canonical types come from @evnt/types
export * from "@evnt/types";
