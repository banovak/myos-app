// Yearly plan items and courses of care.
import { byDateDesc, fmtShort, today } from "./dates";
import { appts } from "./series";
import type { Course, D, Entry, Plan, PlanCat } from "./types";
import { DEF_PLAN_CATS } from "./vocab";

export const YEAR = (): number => +today().slice(0, 4);
const asc = (a: Entry, b: Entry) => (a.occurred_at < b.occurred_at ? -1 : 1);

export function planStats(D: D, p: Plan) {
  const ap = appts(D).filter((e) => e.details.plan_id === p.id);
  return {
    done: ap.filter((e) => e.details.status === "done" && e.occurred_at.startsWith(String(p.year))).length,
    target: +p.per_year || 1,
    last: ap.filter((e) => e.details.status === "done").sort(byDateDesc())[0],
    next: ap.filter((e) => e.details.status === "upcoming" && e.occurred_at >= today()).sort(asc)[0],
  };
}
export function courseStats(D: D, k: Course) {
  const ss = appts(D).filter((e) => e.details.course_id === k.id);
  const done = ss.filter((e) => e.details.status === "done").sort(asc);
  return { done, next: ss.filter((e) => e.details.status === "upcoming").sort(asc)[0], spent: done.reduce((n, e) => n + (+e.details.cost || 0), 0) };
}
export function planStatus(p: Plan, s: ReturnType<typeof planStats>): [string, "mut" | "up" | ""] {
  return s.done >= s.target ? [`Done for ${p.year}`, "mut"] : s.next ? [`Booked ${fmtShort(s.next.occurred_at)}`, "up"] : +p.year < YEAR() ? ["Not done", ""] : ["Not booked yet", ""];
}
export const plansFor = (D: D, y: number): Plan[] => D.plans.filter((p) => +p.year === +y);
export function planCats(D: D): PlanCat[] {
  if (!Array.isArray(D.settings.planCats)) D.settings.planCats = DEF_PLAN_CATS.map((c) => ({ ...c }));
  // Eye health and Other joined the defaults later; once, they are added to categories made before them (they can be deleted)
  if (!D.settings.planCatsEyes) { D.settings.planCatsEyes = true; if (!D.settings.planCats.some((c) => c.id === "eyes")) D.settings.planCats.push({ id: "eyes", name: "Eye health" }); }
  if (!D.settings.planCatsOther) { D.settings.planCatsOther = true; if (!D.settings.planCats.some((c) => c.id === "other")) D.settings.planCats.push({ id: "other", name: "Other" }); }
  return D.settings.planCats!;
}
