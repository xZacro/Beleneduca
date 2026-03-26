import type { YesNoNA } from "./schema/evaluacionSchema";
import type { ResponseAnswer } from "./types";

export function pctFromYesNo(v: YesNoNA | undefined) {
  if (v === "SI") return 100;
  if (v === "NO") return 0;
  return null;
}

export function calcIndicatorPct(answers: Record<string, ResponseAnswer>) {
  if ("hasDocument" in answers) {
    const value = answers.hasDocument;
    return typeof value === "number" ? null : pctFromYesNo(value);
  }

  if ("constituted" in answers) {
    const c = typeof answers.constituted === "number" ? undefined : answers.constituted;
    if (c === "NA") return null;
    if (c === "NO") return 0;
    const m = typeof answers.meetsMonthly === "number" ? undefined : answers.meetsMonthly;
    if (m === "NA" || m == null) return null;
    return m === "SI" ? 100 : 0;
  }

  return null;
}
