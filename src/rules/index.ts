import type { Rule } from "../types.js";
import { frontmatterRule } from "./frontmatter.js";
import { bloatRule } from "./bloat.js";

/** Synchronous rules run against each skill. */
export const rules: Rule[] = [frontmatterRule, bloatRule];
