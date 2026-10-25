import { expect } from "vitest";
import { OpenEvntValidator } from "@evnt/schema";

export const expectValid = (event: unknown) =>
	expect(OpenEvntValidator.validate(event).issues).toBeUndefined();
