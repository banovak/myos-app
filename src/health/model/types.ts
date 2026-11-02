// The app state D, the same shape the web app keeps in memory and maps to rows
// in store/supabase.ts. Keeping this identical is what makes phone and web
// interoperable.
export type MetricKind = "number" | "rating" | "time" | "time_night" | "duration";
/** a measure; for a rating the unit is its scale, "/5" (1 to 5) or "/10" (0 to 10) */
export type Metric = { l: string; u: string; kind?: MetricKind; rating?: boolean };
export type Per = "day" | "week" | "month";

/** how a photo sits in its box, as the user set it: scale, the offset as fractions of the box, and a tilt in degrees. Drawn over the whole photo (contain), not a crop */
export type Fit = { s: number; x: number; y: number; r?: number };
export type Photo = {
  path?: string;
  fit?: Fit;
  /** what the photo is of, as the user named it: Front, Back, Left side… */
  label?: string;
  enc?: boolean;
  /** signed url (unencrypted legacy) or a data/file uri for a local pending upload */
  src?: string;
  /** sample-data placeholder kinds */
  ph?: string;
  w?: number;
  hue?: number;
};
export type FileRef = {
  path?: string;
  name: string;
  size?: number | null;
  enc?: boolean;
  type?: string | null;
  /** local file waiting to be encrypted and uploaded */
  localUri?: string;
};

export type EntryType = "photo" | "appointment" | "measurement" | "procedure" | "observation" | "food_trial";
export type Entry = {
  id: string;
  occurred_at: string;
  type: EntryType;
  title: string;
  notes: string;
  regions: string[];
  concern_id: string | null;
  parent_entry_id: string | null;
  details: Record<string, any>;
  source: string;
  photos: Photo[];
  files: FileRef[];
  /** transient: the suggestion this entry was accepted from */
  fromSuggestion?: string;
};

export type Tracking = { metrics?: string[]; per?: Per };
/** one bout of an illness: when it started, when it ended (null while still on), what it was */
export type Episode = { from: string; to: string | null; label?: string; notes?: string };
export type Concern = {
  id: string;
  title: string;
  regions: string[];
  started_on: string | null;
  resolved_on: string | null;
  status: "active" | "resolved" | "recurring";
  notes?: string;
  tracking?: Tracking;
  /** an illness is a concern that comes in episodes: one record per group ("Viral", "Lupus"), a bout at a time */
  kind?: "illness";
  /** the episodes of an illness, earliest first; started_on / resolved_on are the first start and the last end (null while one is open) */
  episodes?: Episode[];
  /** the colour it draws in on History and charts */
  color?: string | null;
};

export type RegimenCategory = "supplement" | "medication" | "skin" | "hair" | "activity" | "other" | "diet";
export type DoseChange = { on: string; dose: string; frequency: string; prev_dose: string; prev_frequency: string };
/** one stretch of doing it: a start and, once stopped, a stop */
export type Stint = { from: string; to: string | null };
export type Regimen = {
  id: string;
  name: string;
  category: RegimenCategory;
  dose?: string;
  frequency?: string;
  started_on: string;
  ended_on: string | null;
  regions: string[];
  concern_id: string | null;
  color?: string | null;
  notes?: string;
  target?: { count: number; per: Per } | null;
  match?: { source: string; activity?: string };
  changes?: DoseChange[];
  /** the product, the label, the dose: for the record */
  photos?: Photo[];
  /** the stints, when it was stopped and started again (more than one); started_on and ended_on are the first start and the last stop */
  periods?: Stint[];
};
export type RegLog = { id: string; regimen_id: string; on_date: string; time: string | null; source: string; source_ref?: string | null; note: string };

export type Course = {
  id: string;
  title: string;
  kind: string;
  provider?: string;
  practice?: string;
  cadence?: string;
  started_on: string;
  ended_on: string | null;
  concern_id: string | null;
  metric?: string | null;
  cost?: number | null;
  color?: string | null;
  notes?: string;
};
export type Plan = { id: string; year: number; title: string; kind: string; per_year: number; notes: string; category: string };

export type RuleKind = "photo" | "metric" | "regimen";
export type Rule = { label: string; kind: RuleKind; region?: string; metric?: string; regimen?: string; per: Per };
export type ExpKind = "challenge" | "phases" | "before_after";
export type Phase = { name: string; from: string; to: string };
export type ExpConfig = {
  phases?: Phase[];
  measures?: string[];
  photo_region?: string;
  event_date?: string;
  label?: string;
  window?: number;
  cycle?: boolean;
};
export type Challenge = {
  id: string;
  title: string;
  started_on: string;
  days: number | null;
  regimen_ids: string[];
  rules: Rule[];
  notes: string;
  kind: ExpKind;
  config: ExpConfig;
};

export type LabResult = { marker: string; value: number; unit: string; range: string; flag: string };
/** what a report is: lab results (the default, and the only kind that feeds the markers table), or another document with a file and, if useful, its own values */
export type ReportKind = "lab" | "prescription" | "scan" | "letter" | "other";
/** a report: a lab's bloodwork, a prescription, a scan, a letter. `lab` is who it came from; `results` are its values as printed */
export type Lab = { id: string; date: string; lab: string; file: FileRef | string | null; notes?: string; results: LabResult[]; kind?: ReportKind; title?: string };

export type ChartStyle = "line" | "area" | "column" | "dots";
export type Chart = {
  id: string;
  title: string;
  /** absent = a chart: time along the x axis, data on up to two y axes. "month" = one regimen's ticks on a calendar; "cycle" = the cycle on a calendar */
  kind?: "cycle" | "month";
  months?: number;
  /** the regimen a calendar shows */
  reg?: string;
  y1: string | null;
  y1Type?: ChartStyle;
  y1Color?: string;
  y1Avg?: boolean;
  /** more series drawn on the left axis, sharing its scale (two 1–5 ratings, say); colours are picked for them */
  y1More?: string[];
  y2: string | null;
  y2Type?: ChartStyle;
  y2Color?: string;
  y2Avg?: boolean;
  y2More?: string[];
  bands: string[];
  photos: string[];
  sessions?: string[];
  markers?: string[];
  range: "3m" | "6m" | "12m" | "all" | "custom";
  from?: string;
  to?: string;
  grid?: boolean;
  /** the x and y axis lines; on unless turned off */
  axes?: boolean;
  /** the plot scrolls sideways: the range is how far back, `window` (months) how much shows at once; hold to read values */
  scroll?: boolean;
  window?: number;
  /** a fixed y range per axis instead of the automatic one; both ends needed to count */
  y1Range?: [number | null, number | null];
  y2Range?: [number | null, number | null];
};

export type Suggestion = {
  id: string;
  source: string;
  source_ref: string | null;
  title: string;
  occurred_at: string;
  details: Record<string, any>;
  found: string;
  status: "pending" | "accepted" | "dismissed";
};

export type Repeat = "daily" | "weekly" | "monthly" | "once";
export type Schedule = { repeat?: Repeat; time?: string; days?: number[]; monthday?: number; date?: string };
export type ReminderKind = "custom" | "challenge" | "concern" | "regimen" | "quick";
export type Reminder = {
  id: string;
  title: string;
  target_kind: ReminderKind;
  target_id: string | null;
  schedule: Schedule;
  private: boolean;
  skip_if_done: boolean;
  enabled: boolean;
};

export type Flow = "none" | "spotting" | "light" | "medium" | "heavy" | "unspecified";
export type CycleDay = { on_date: string; source: string; flow: Flow; symptoms: string[]; note: string; source_ref: string | null };

export type WidgetType =
  | "appointments" | "concerns" | "regimens" | "diet" | "challenge" | "savedchart" | "labs" | "photos" | "recent" | "teeth" | "quick" | "plan" | "integrations" | "suggestions";
export type Widget = { id: string; type: WidgetType; src?: string; chartId?: string; /** appointments: false hides the last-visit rows */ showPast?: boolean };
/** a region on the body (no parent; x, y in % of the figure; on the front unless `side` says back), or a point on a
 * region's canvas (`parent` = the region; x, y in % of its 4:5 canvas, which for the face is the head drawing) */
export type Point = { id: string; region: string; x: number; y: number; parent?: string; side?: "front" | "back"; /** older data: a head-drawing point */ zone?: "head" | "body" };

export type ToothStatus = "watch" | "cavity" | "filled" | "crown" | "root_canal" | "implant" | "bridge" | "extracted" | "missing";
export type ToothRec = { s: ToothStatus[]; since: string; note: string };
export type PlanCat = { id: string; name: string };
/** a doctor, dentist, physio: picked on appointments, with a page of what you have had with them */
export type Provider = {
  id: string; name: string; role?: string; practice?: string; phone?: string; address?: string; link?: string;
  photo?: Photo | null; archived?: boolean; added_on?: string;
};
export type HealthCard = {
  blood?: string;
  allergies?: Record<string, string>[];
  vaccines?: Record<string, string>[];
  conditions?: Record<string, string>[];
  providers?: Record<string, string>[];
  contacts?: Record<string, string>[];
};
export type VaultMeta = { v: 1; kdf: "PBKDF2-SHA256"; iterations: number; salt: string; check: string };
export type Settings = {
  accent?: string;
  card?: HealthCard;
  /** your providers; the card's providers rows mirror the active ones, strings only, for the web */
  providers?: Provider[];
  cycle_on?: boolean;
  planCats?: PlanCat[];
  planCatsEyes?: boolean; // the Eye health default has been added once
  planCatsOther?: boolean; // the Other default has been added once
  customKinds?: Record<string, string>;
  dismissedStories?: Record<string, string>;
  vault?: VaultMeta;
  teeth?: Record<string, ToothRec>;
  toothNumbering?: "fdi" | "universal";
  /** how weight and height are shown and entered; values are always stored in kg and cm */
  units?: { weight?: "kg" | "lb"; height?: "cm" | "ft" };
  /** what to do with each Apple Health item: both (merged, Health wins a shared day), health, manual, off; absent = both */
  hkUse?: Record<string, "both" | "health" | "manual" | "off">;
};

export type D = {
  metrics: Record<string, Metric>;
  concerns: Concern[];
  regimens: Regimen[];
  regLogs: RegLog[];
  courses: Course[];
  plans: Plan[];
  challenges: Challenge[];
  entries: Entry[];
  labs: Lab[];
  charts: Chart[];
  suggestions: Suggestion[];
  reminders: Reminder[];
  cycle: CycleDay[];
  hk: Record<string, { d: string; v: number }[]>;
  points: Point[];
  customRegions: Record<string, string>;
  widgets: { left: Widget[]; right: Widget[] };
  chartLayout: string;
  chartZones: string[][] | null;
  settings: Settings;
  basePhoto: string | null;
  basePhotoPath: string | null;
  basePhotoEnc: boolean;
};
