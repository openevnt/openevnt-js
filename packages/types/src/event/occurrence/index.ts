import type { PartialDate } from "../../types/PartialDate.js";
import type { AnyComponent } from "../component/index.js";
import type { Activity } from "./activity.js";

export interface Occurrence {
	start?: PartialDate;
	end?: PartialDate;
	status?: "cancelled";
	activities?: Activity[];
	components?: AnyComponent[];
}
