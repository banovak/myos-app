// Reports: lab results are one kind of document; prescriptions, scans and
// letters are the others. Only lab results feed the markers table and the
// "lab:" series. Everything is kept as printed; nothing is interpreted.
import type { Lab, ReportKind } from "./types";

export const REPORT_KINDS: [ReportKind, string][] = [["lab", "Lab results"], ["prescription", "Prescription"], ["scan", "Scan or imaging"], ["letter", "Letter or referral"], ["other", "Other document"]];
export const reportKind = (l: Lab): ReportKind => l.kind || "lab";
export const isLab = (l: Lab): boolean => reportKind(l) === "lab";
export const kindName = (k: ReportKind | string): string => (REPORT_KINDS.find((x) => x[0] === k) || [k, k])[1] as string;
/** what a report is called in a list: its title, or the lab's name for bloodwork */
export const reportTitle = (l: Lab): string => l.title || (isLab(l) ? l.lab || "Lab report" : kindName(reportKind(l)));
export const reportIcon = (l: Lab): string => (isLab(l) ? "lab" : "report");
export const labsOnly = (D: { labs: Lab[] }): Lab[] => D.labs.filter(isLab);
/** a placeholder for the title field, by kind */
export const titleHint: Record<ReportKind, string> = { lab: "", prescription: "Glasses prescription, Amoxicillin", scan: "Knee MRI, chest X-ray", letter: "Referral to dermatology", other: "Discharge summary" };
