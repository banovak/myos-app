// Level 2 storage: the user's own Supabase project. A faithful port of the web
// app's store/supabase.js: the same app-state ↔ row mapping (toRows / load),
// the same diff-based save (only changed rows, deletes for rows that vanished),
// the same conflict keys, 1000-row paging, and imported rows kept out of the
// diff. Photos and files are end-to-end encrypted (crypto.ts) before upload.
import { AppState } from "react-native";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { D, FileRef, Photo, VaultMeta } from "../model/types";
import { uid as newId } from "../model/dates";
import { largeSecureStore } from "./session";
import * as vault from "./crypto";
import { extFor, plainUriIfCached, readBytes, wipePlain, writePlain } from "./media";
import type { HealthStore, StoreHooks, SyncState, VaultState } from "./types";

const BUCKET = "health-media";
/** a photo as its row holds it: the storage path, whether it is encrypted, its fit and label */
const photoRow = (p: Photo) => ({ ...(p.enc ? { path: p.path, enc: true } : { path: p.path }), ...(p.fit ? { fit: p.fit } : {}), ...(p.label ? { label: p.label } : {}) });
const ORDER = ["metrics", "concerns", "regimens", "regimen_logs", "courses", "plans", "challenges", "entries", "lab_reports", "lab_results", "charts", "suggestions", "daily_metrics", "cycle_days", "reminders", "profile"] as const;
type Table = (typeof ORDER)[number];
const CONFLICT: Partial<Record<Table, string>> = { metrics: "owner,key", daily_metrics: "owner,on_date,source,key", cycle_days: "owner,on_date,source", profile: "owner" };
type Rows = Record<Table, any[]>;

// Rows from an integration (Apple Health, Oura, Whoop, Strava) are never written or deleted
// by the manual save. Only manual rows take part in the diff.
const writable = (rows: Rows): Rows =>
  Object.fromEntries(Object.entries(rows).map(([t, rs]) => [t, t === "daily_metrics" ? [] : t === "cycle_days" || t === "regimen_logs" ? rs.filter((r: any) => (r.source || "manual") === "manual") : rs])) as Rows;
const keyOf = (t: Table, r: any): string =>
  t === "metrics" ? r.key : t === "daily_metrics" ? `${r.on_date}|${r.source}|${r.key}` : t === "cycle_days" ? `${r.on_date}|${r.source}` : t === "profile" ? "me" : r.id;
const rid = newId;

/* app state -> table rows (identical to the web) */
export function toRows(D: D): Rows {
  return {
    metrics: Object.entries(D.metrics || {}).map(([key, m], i) => { const kind = m.kind || (m.rating ? "rating" : "number"); return { key, label: m.l, unit: m.u || "", is_rating: kind === "rating", kind, sort_order: i }; }),
    // kind, episodes and colour travel only when set (an illness, a coloured concern), so older rows keep saving without the columns
    concerns: D.concerns.map((c) => ({ id: c.id, title: c.title, regions: c.regions || [], started_on: c.started_on || null, resolved_on: c.resolved_on || null, status: c.status || "active", notes: c.notes || "", tracking: c.tracking || {}, ...(c.kind === "illness" ? { kind: "illness", episodes: c.episodes || [] } : {}), ...(c.color ? { color: c.color } : {}) })),
    // periods only travels when there is more than one stint, and only counts on the way back when it agrees with
    // started_on / ended_on: a row saved by a build or the web that does not know stints keeps the ends right
    regimens: D.regimens.map((r) => ({ id: r.id, name: r.name, category: r.category, dose: r.dose || "", frequency: r.frequency || "", started_on: r.started_on, ended_on: r.ended_on || null, regions: r.regions || [], concern_id: r.concern_id || null, color: r.color || null, notes: r.notes || "", target: r.target || null, match: r.match || { source: "manual" }, changes: r.changes || [], photos: (r.photos || []).filter((p) => p.path).map(photoRow), ...(r.periods && r.periods.length > 1 ? { periods: r.periods } : {}) })),
    regimen_logs: (D.regLogs || []).map((l) => ({ id: l.id, regimen_id: l.regimen_id, on_date: l.on_date, at_time: l.time || null, source: l.source || "manual", source_ref: l.source_ref || null, note: l.note || "" })),
    courses: D.courses.map((k) => ({ id: k.id, title: k.title, kind: k.kind, provider: k.provider || "", practice: k.practice || "", cadence: k.cadence || "", started_on: k.started_on, ended_on: k.ended_on || null, concern_id: k.concern_id || null, metric: k.metric || null, cost: k.cost == null || (k.cost as any) === "" ? null : +k.cost, color: k.color || null, notes: k.notes || "" })),
    plans: D.plans.map((p, i) => ({ id: p.id, year: +p.year, title: p.title, kind: p.kind, per_year: +p.per_year || 1, notes: p.notes || "", category: p.category || "", sort_order: i })),
    challenges: D.challenges.map((c) => ({ id: c.id, title: c.title, started_on: c.started_on, days: c.days ? +c.days : null, regimen_ids: c.regimen_ids || [], rules: c.rules || [], notes: c.notes || "", kind: c.kind || "challenge", config: c.config || {} })),
    entries: D.entries.map((e) => ({
      id: e.id, occurred_at: e.occurred_at, type: e.type, title: e.title, notes: e.notes || "", regions: e.regions || [],
      concern_id: e.concern_id || null, parent_entry_id: e.parent_entry_id || null, details: e.details || {}, source: e.source || "manual",
      photos: (e.photos || []).filter((p) => p.path).map(photoRow),
      files: (e.files || []).filter((f) => f.path).map((f) => ({ path: f.path, name: f.name, size: f.size || null, enc: !!f.enc, type: f.type || null })),
    })),
    // kind and title travel only for the other documents (a prescription, a scan), so lab rows keep saving without the columns
    lab_reports: D.labs.map((l) => ({ id: l.id, collected_on: l.date, lab: l.lab || "", file: l.file && typeof l.file === "object" && l.file.path ? { path: l.file.path, name: l.file.name, enc: !!l.file.enc, type: l.file.type || null } : null, notes: l.notes || "", ...(l.kind && l.kind !== "lab" ? { kind: l.kind } : {}), ...(l.title ? { title: l.title } : {}) })),
    lab_results: D.labs.flatMap((l) => l.results.map((r, i) => ({ id: `${l.id}~${i}`, report_id: l.id, marker: r.marker, value: +r.value, unit: r.unit || "", range_text: r.range || "", flag_text: r.flag || "", sort_order: i }))),
    charts: D.charts.map((c, i) => { const { id, title, ...config } = c as any; return { id, title: title || "", config, sort_order: i }; }),
    suggestions: D.suggestions.map((s) => ({ id: s.id, source: s.source || "calendar", source_ref: s.source_ref || null, title: s.title, occurred_at: s.occurred_at, details: s.details || {}, found: s.found || "", status: s.status })),
    reminders: (D.reminders || []).map((r) => ({ id: r.id, title: r.title || "", target_kind: r.target_kind || "custom", target_id: r.target_id || null, schedule: r.schedule || {}, private: !!r.private, skip_if_done: r.skip_if_done !== false, enabled: r.enabled !== false })),
    cycle_days: (D.cycle || []).map((c) => ({ on_date: c.on_date, source: c.source || "manual", flow: c.flow || "none", symptoms: c.symptoms || [], note: c.note || "", source_ref: c.source_ref || null })),
    daily_metrics: Object.entries(D.hk || {}).flatMap(([key, pts]) => (pts || []).map((p) => ({ on_date: p.d, source: "apple_health", key, value: +p.v }))),
    profile: [{ base_photo: D.basePhotoPath ? (D.basePhotoEnc ? { path: D.basePhotoPath, enc: true } : { path: D.basePhotoPath }) : null, points: D.points || [], custom_regions: D.customRegions || {}, widgets: D.widgets || null, chart_layout: D.chartLayout || "top", chart_zones: D.chartZones || null, settings: D.settings || {} }],
  };
}
const snapshotOf = (rows: Rows) => Object.fromEntries(ORDER.map((t) => [t, new Map(rows[t].map((r: any) => [keyOf(t, r), JSON.stringify(r)]))])) as Record<Table, Map<string, string>>;

export type SupabaseStore = HealthStore & {
  client: SupabaseClient;
  session(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<boolean>;
  mfaNeeded(): Promise<boolean>;
  mfaEnabled(): Promise<boolean>;
  mfaSignIn(code: string): Promise<void>;
  mfaEnroll(): Promise<{ id: string; totp: { qr_code: string; secret: string; uri: string } }>;
  mfaVerify(factorId: string, code: string): Promise<void>;
  vaultRestore(): Promise<boolean>;
  uid(): string | null;
  /** import path for Apple Health rows: only touches source='apple_health' rows */
  upsertImported(table: "daily_metrics" | "cycle_days" | "regimen_logs", rows: any[]): Promise<void>;
};

export function createSupabaseStore(cfg: { supabaseUrl: string; supabaseKey: string }, hooks: StoreHooks): SupabaseStore {
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { storage: largeSecureStore, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  // keep tokens fresh while the app is in the foreground
  AppState.addEventListener("change", (s) => { if (s === "active") sb.auth.startAutoRefresh(); else sb.auth.stopAutoRefresh(); });

  const T = (n: Table) => sb.schema("health").from(n);
  const status = (s: SyncState, m?: string) => hooks.onStatus(s, m);
  let uid: string | null = null, snap: Record<Table, Map<string, string>> | null = null, timer: ReturnType<typeof setTimeout> | null = null;
  let busy = false, latest: D | null = null, again = false, retry: ReturnType<typeof setTimeout> | null = null, vaultKey: Uint8Array | null = null;
  let flushing: Promise<void> | null = null;

  async function selectAll(t: Table): Promise<any[]> {
    const out: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await T(t).select("*").range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) return out;
    }
  }
  async function sign(paths: string[]): Promise<Record<string, string>> {
    const m: Record<string, string> = {};
    for (let i = 0; i < paths.length; i += 100) {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths.slice(i, i + 100), 1800);
      if (error) throw error;
      (data || []).forEach((d) => { if (d.signedUrl && d.path) m[d.path] = d.signedUrl; });
    }
    return m;
  }
  async function upload(bytes: Uint8Array, path: string): Promise<void> {
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { upsert: true, contentType: "application/octet-stream" });
    if (error) throw error;
  }
  // every photo and file is encrypted on this device before upload; storage only ever holds ciphertext
  async function sealed(bytes: Uint8Array, path: string): Promise<void> {
    if (!vaultKey) { const e: any = new Error("Photos and files are locked on this device. Unlock them under Security."); e.code = "VAULT_LOCKED"; throw e; }
    await upload(await vault.encryptBytes(vaultKey, bytes), path);
  }
  async function uploadMedia(D: D): Promise<void> {
    for (const e of D.entries) {
      for (const p of e.photos || []) {
        if (!p.path && p.src && /^file:/.test(p.src)) {
          const path = `${uid}/photos/${e.id}-${rid()}.bin`;
          const bytes = await readBytes(p.src);
          await sealed(bytes, path);
          await writePlain(path, bytes, ".jpg");
          p.path = path; p.enc = true; delete p.src;
        }
      }
      for (const f of e.files || []) {
        if (!f.path && f.localUri) {
          const path = `${uid}/files/${e.id}-${rid()}.bin`;
          const bytes = await readBytes(f.localUri);
          await sealed(bytes, path);
          await writePlain(path, bytes, extFor(f.type));
          f.path = path; f.enc = true; f.type = f.type || "application/octet-stream"; f.size = f.size || bytes.length; delete f.localUri;
        }
      }
    }
    for (const r of D.regimens) {
      for (const p of r.photos || []) {
        if (!p.path && p.src && /^file:/.test(p.src)) {
          const path = `${uid}/photos/reg-${r.id}-${rid()}.bin`;
          const bytes = await readBytes(p.src);
          await sealed(bytes, path);
          await writePlain(path, bytes, ".jpg");
          p.path = path; p.enc = true; delete p.src;
        }
      }
    }
    for (const p of D.settings.providers || []) {
      const ph = p.photo;
      if (ph && !ph.path && ph.src && /^file:/.test(ph.src)) {
        const path = `${uid}/photos/prov-${p.id}-${rid()}.bin`;
        const bytes = await readBytes(ph.src);
        await sealed(bytes, path);
        await writePlain(path, bytes, ".jpg");
        ph.path = path; ph.enc = true; delete ph.src;
      }
    }
    for (const l of D.labs) {
      const f = l.file;
      if (f && typeof f === "object" && !f.path && f.localUri) {
        const path = `${uid}/labs/${l.id}-${rid()}.bin`;
        const bytes = await readBytes(f.localUri);
        await sealed(bytes, path);
        await writePlain(path, bytes, extFor(f.type || "application/pdf"));
        f.path = path; f.enc = true; f.type = f.type || "application/pdf"; f.size = f.size || bytes.length; delete f.localUri;
      }
    }
    if (D.basePhoto && /^file:/.test(D.basePhoto) && !D.basePhotoPath) {
      const path = `${uid}/base-${rid()}.bin`;
      const bytes = await readBytes(D.basePhoto);
      await sealed(bytes, path);
      D.basePhoto = await writePlain(path, bytes, ".jpg");
      D.basePhotoPath = path; D.basePhotoEnc = true;
    }
  }
  async function flushNow(): Promise<void> {
    if (busy) { again = true; return; }
    busy = true;
    if (retry) clearTimeout(retry);
    status("saving");
    const D = latest!;
    try {
      await uploadMedia(D);
      const rows = writable(toRows(D)), old = snap || snapshotOf(Object.fromEntries(ORDER.map((t) => [t, []])) as unknown as Rows);
      for (const t of ORDER) {
        const changed = rows[t].filter((r: any) => old[t].get(keyOf(t, r)) !== JSON.stringify(r)).map((r: any) => ({ ...r, owner: uid }));
        if (!changed.length) continue;
        const { error } = await T(t).upsert(changed, CONFLICT[t] ? { onConflict: CONFLICT[t] } : undefined);
        if (error) throw error;
      }
      for (const t of [...ORDER].reverse()) {
        if (t === "profile") continue;
        const cur = new Set(rows[t].map((r: any) => keyOf(t, r)));
        const gone = [...old[t].keys()].filter((k) => !cur.has(k));
        if (!gone.length) continue;
        if (t === "metrics") { const { error } = await T(t).delete().in("key", gone); if (error) throw error; }
        else if (t === "cycle_days") { for (const k of gone) { const [on_date, source] = k.split("|"); const { error } = await T(t).delete().match({ on_date, source }); if (error) throw error; } }
        else if (t === "daily_metrics") { for (const k of gone) { const [on_date, source, key] = k.split("|"); const { error } = await T(t).delete().match({ on_date, source, key }); if (error) throw error; } }
        else { const { error } = await T(t).delete().in("id", gone); if (error) throw error; }
      }
      snap = snapshotOf(rows);
      status("saved");
    } catch (e: any) {
      status("error", e?.message || String(e));
      retry = setTimeout(() => { flushing = flushNow(); }, 15000);
    } finally {
      busy = false;
      if (again) { again = false; flushing = flushNow(); }
    }
  }

  const store: SupabaseStore = {
    mode: "supabase",
    client: sb,
    uid: () => uid,
    async session() {
      const { data } = await sb.auth.getSession();
      const next = data.session ? data.session.user.id : null;
      if (next !== uid) {
        // a different account than the one this store last served: drop everything held for the old one
        snap = null; latest = null; vaultKey = null;
        if (uid) {
          await wipePlain();
          const { cancelAllHealthNotifications } = await import("../notifications/reminders");
          await cancelAllHealthNotifications().catch(() => {});
        }
      }
      uid = next;
      if (uid && !vaultKey) vaultKey = await vault.recallVaultKey(uid);
      return data.session;
    },
    async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; await this.session(); },
    async signUp(email, password) { const { data, error } = await sb.auth.signUp({ email, password }); if (error) throw error; await this.session(); return !data.session; },
    async signOut() {
      await this.flush();
      await sb.auth.signOut();
      uid = null; snap = null; latest = null; vaultKey = null;
      await wipePlain();
      const { cancelAllHealthNotifications } = await import("../notifications/reminders");
      await cancelAllHealthNotifications().catch(() => {});
    },
    async mfaEnabled() { const { data, error } = await sb.auth.mfa.listFactors(); if (error) throw error; return data.totp.some((f) => f.status === "verified"); },
    async mfaNeeded() { const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2"; },
    async mfaEnroll() {
      const { data: all, error: e0 } = await sb.auth.mfa.listFactors(); if (e0) throw e0;
      for (const f of all.all.filter((f) => f.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "My OS Health" });
      if (error) throw error;
      return data as any;
    },
    async mfaVerify(factorId, code) { const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code }); if (error) throw error; },
    async mfaSignIn(code) {
      const { data, error } = await sb.auth.mfa.listFactors(); if (error) throw error;
      const f = data.totp.find((x) => x.status === "verified");
      if (!f) throw new Error("No two-step factor found.");
      await this.mfaVerify(f.id, code);
    },
    vaultState(meta): VaultState { return !meta ? "none" : vaultKey ? "unlocked" : "locked"; },
    async vaultRestore() { if (uid) vaultKey = await vault.recallVaultKey(uid); return !!vaultKey; },
    async vaultSetup(pass) {
      const { meta, key } = await vault.vaultSetup(pass);
      vaultKey = key;
      if (uid) { await vault.rememberVaultKey(uid, key); await vault.noteVaultUid(uid); }
      return meta as VaultMeta;
    },
    async vaultUnlock(pass, meta) {
      const key = await vault.vaultUnlock(pass, meta as vault.VaultMeta);
      vaultKey = key;
      if (uid) { await vault.rememberVaultKey(uid, key); await vault.noteVaultUid(uid); }
    },
    async vaultForget() { vaultKey = null; if (uid) await vault.forgetVaultKey(uid); await wipePlain(); },
    async photoUri(p: Photo) {
      if (p.src) return p.src;
      if (!p.path) return null;
      if (!p.enc) { const m = await sign([p.path]); return m[p.path] || null; }
      const hit = plainUriIfCached(p.path, ".jpg");
      if (hit) return hit;
      if (!vaultKey) return null;
      const { data, error } = await sb.storage.from(BUCKET).download(p.path);
      if (error) throw error;
      const ct = new Uint8Array(await data.arrayBuffer());
      return await writePlain(p.path, await vault.decryptBytes(vaultKey, ct), ".jpg");
    },
    async fileUri(f) {
      if (!f || typeof f === "string") return null;
      if (f.localUri) return f.localUri;
      if (!f.path) return null;
      const ext = extFor(f.type);
      if (!f.enc) { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(f.path, 300); if (error) throw error; return data.signedUrl; }
      const hit = plainUriIfCached(f.path, ext);
      if (hit) return hit;
      if (!vaultKey) return null;
      const { data, error } = await sb.storage.from(BUCKET).download(f.path);
      if (error) throw error;
      const ct = new Uint8Array(await data.arrayBuffer());
      return await writePlain(f.path, await vault.decryptBytes(vaultKey, ct), ext);
    },
    async wipeCache() { await wipePlain(); },
    async email() { const { data } = await sb.auth.getUser(); return data.user ? data.user.email || "" : ""; },
    async load() {
      const by = {} as Record<Table, any[]>;
      await Promise.all(ORDER.map(async (t) => { by[t] = await selectAll(t); }));
      if (!by.profile.length && !by.entries.length && !by.metrics.length) { snap = null; return null; }
      const paths = [...by.entries.flatMap((e) => (e.photos || []).filter((p: Photo) => !p.enc).map((p: Photo) => p.path!)), ...by.regimens.flatMap((r) => (Array.isArray(r.photos) ? r.photos : []).filter((p: Photo) => !p.enc).map((p: Photo) => p.path!)), ...(by.profile[0] && by.profile[0].base_photo && !by.profile[0].base_photo.enc ? [by.profile[0].base_photo.path] : [])];
      const signed = paths.length ? await sign(paths) : {};
      /** a stored photo as the app holds it: a signed url for an unencrypted one */
      const photoBack = (x: Photo): Photo => ({ ...(x.enc ? { path: x.path, enc: true } : { path: x.path, src: signed[x.path!] }), ...(x.fit ? { fit: x.fit } : {}), ...(x.label ? { label: x.label } : {}) });
      const p = by.profile[0] || {};
      const asc = (k: string) => (a: any, b: any) => (a[k] || 0) - (b[k] || 0);
      const hk: D["hk"] = {};
      by.daily_metrics.filter((r) => r.source === "apple_health").sort((a, b) => (a.on_date < b.on_date ? -1 : 1)).forEach((r) => (hk[r.key] = hk[r.key] || []).push({ d: r.on_date, v: +r.value }));
      const D: D = {
        metrics: Object.fromEntries(by.metrics.sort(asc("sort_order")).map((m) => { const kind = m.kind || (m.is_rating ? "rating" : "number"); return [m.key, kind === "rating" ? { l: m.label, u: m.unit, kind, rating: true } : { l: m.label, u: m.unit, kind }]; })),
        concerns: by.concerns.map((c) => ({ id: c.id, title: c.title, regions: c.regions, started_on: c.started_on, resolved_on: c.resolved_on, status: c.status, notes: c.notes, tracking: c.tracking || {}, ...(c.kind === "illness" ? { kind: "illness" as const, episodes: Array.isArray(c.episodes) ? c.episodes : [] } : {}), ...(c.color ? { color: c.color } : {}) })),
        regimens: by.regimens.map((r) => ({ id: r.id, name: r.name, category: r.category, dose: r.dose, frequency: r.frequency, started_on: r.started_on, ended_on: r.ended_on, regions: r.regions, concern_id: r.concern_id, color: r.color, notes: r.notes, target: r.target, match: r.match || { source: "manual" }, changes: r.changes || [], ...(Array.isArray(r.photos) && r.photos.length ? { photos: r.photos.map(photoBack) } : {}), ...(Array.isArray(r.periods) && r.periods.length > 1 && r.periods[0].from === r.started_on && (r.periods[r.periods.length - 1].to || null) === (r.ended_on || null) ? { periods: r.periods } : {}) })),
        regLogs: by.regimen_logs.map((l) => ({ id: l.id, regimen_id: l.regimen_id, on_date: l.on_date, time: l.at_time, source: l.source, source_ref: l.source_ref, note: l.note })),
        courses: by.courses.map((k) => ({ id: k.id, title: k.title, kind: k.kind, provider: k.provider, practice: k.practice, cadence: k.cadence, started_on: k.started_on, ended_on: k.ended_on, concern_id: k.concern_id, metric: k.metric, cost: k.cost == null ? null : +k.cost, color: k.color, notes: k.notes })),
        plans: by.plans.sort(asc("sort_order")).map((x) => ({ id: x.id, year: x.year, title: x.title, kind: x.kind, per_year: x.per_year, notes: x.notes, category: x.category || "" })),
        challenges: by.challenges.map((c) => ({ id: c.id, title: c.title, started_on: c.started_on, days: c.days, regimen_ids: c.regimen_ids, rules: c.rules, notes: c.notes, kind: c.kind || "challenge", config: c.config || {} })),
        reminders: by.reminders.map((r) => ({ id: r.id, title: r.title, target_kind: r.target_kind, target_id: r.target_id, schedule: r.schedule || {}, private: r.private, skip_if_done: r.skip_if_done, enabled: r.enabled })),
        cycle: by.cycle_days.map((c) => ({ on_date: c.on_date, source: c.source, flow: c.flow, symptoms: c.symptoms || [], note: c.note || "", source_ref: c.source_ref })),
        entries: by.entries.map((e) => ({ id: e.id, occurred_at: e.occurred_at, type: e.type, title: e.title, notes: e.notes, regions: e.regions, concern_id: e.concern_id, parent_entry_id: e.parent_entry_id, details: e.details, source: e.source, photos: (e.photos || []).map(photoBack), files: e.files || [] })),
        labs: by.lab_reports.map((l) => ({ id: l.id, date: l.collected_on, lab: l.lab, file: l.file, notes: l.notes, kind: l.kind || "lab", ...(l.title ? { title: l.title } : {}), results: by.lab_results.filter((r) => r.report_id === l.id).sort(asc("sort_order")).map((r) => ({ marker: r.marker, value: +r.value, unit: r.unit, range: r.range_text, flag: r.flag_text })) })),
        charts: by.charts.sort(asc("sort_order")).map((c) => ({ id: c.id, title: c.title, ...c.config })),
        suggestions: by.suggestions.map((s) => ({ id: s.id, source: s.source, source_ref: s.source_ref, title: s.title, occurred_at: s.occurred_at, details: s.details, found: s.found, status: s.status })),
        hk,
        points: p.points || [], customRegions: p.custom_regions || {}, widgets: p.widgets || null, chartLayout: p.chart_layout || "top", chartZones: p.chart_zones || null, settings: p.settings || {},
        basePhotoPath: p.base_photo ? p.base_photo.path : null, basePhotoEnc: !!(p.base_photo && p.base_photo.enc),
        basePhoto: null,
      };
      if (p.base_photo) {
        D.basePhoto = p.base_photo.enc ? (vaultKey ? await this.photoUri({ path: p.base_photo.path, enc: true }).catch(() => null) : null) : signed[p.base_photo.path] || null;
      }
      snap = snapshotOf(writable(toRows(D)));
      return D;
    },
    save(D) {
      latest = D;
      if (timer) clearTimeout(timer);
      status("saving");
      timer = setTimeout(() => { flushing = flushNow(); }, 600);
    },
    async flush() {
      if (timer) { clearTimeout(timer); timer = null; if (latest) flushing = flushNow(); }
      while (flushing || busy) { const f = flushing; flushing = null; if (f) await f; else await new Promise((r) => setTimeout(r, 50)); }
    },
    async upsertImported(table, rows) {
      if (!rows.length) return;
      const tagged = rows.map((r) => ({ ...r, owner: uid, source: "apple_health" }));
      for (let i = 0; i < tagged.length; i += 500) {
        const { error } = await T(table).upsert(tagged.slice(i, i + 500), { onConflict: CONFLICT[table] || "owner,source,source_ref" });
        if (error) throw error;
      }
    },
  };
  return store;
}
