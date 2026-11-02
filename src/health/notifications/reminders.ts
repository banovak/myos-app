// Reminders → local notifications. No push server. Reconcile on every sync and
// app open: cancel every Health notification, then schedule the next
// occurrences of every enabled reminder whose target still exists, for roughly
// the next 7 days, soonest first, never more than 64 pending (iOS's limit).
// Private reminders say "My OS Health: time for a check-in" and nothing else;
// no health value ever goes into a notification.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { iso } from "../model/dates";
import { firesBetween, remDone, remTarget } from "../model/reminders";
import type { D, Reminder } from "../model/types";

const CHANNEL = "health-reminders";
const TAG = "health";
export const PRIVATE_TEXT = "My OS Health: time for a check-in";
const MAX_PENDING = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function notificationsAllowed(): Promise<boolean> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch { return false; }
}
/** ask when the user saves their first reminder, never at install */
export async function requestNotifications(): Promise<boolean> {
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Health reminders", importance: Notifications.AndroidImportance.DEFAULT });
  const p = await Notifications.requestPermissionsAsync();
  return p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export type ReminderPayload = { tag: typeof TAG; reminderId: string; target_kind: Reminder["target_kind"]; target_id: string | null };

// Saves come in bursts; reconcile once they settle.
let pending: ReturnType<typeof setTimeout> | null = null;
export function reconcileReminders(D: D): Promise<void> {
  if (pending) clearTimeout(pending);
  return new Promise((res) => { pending = setTimeout(() => { pending = null; reconcileNow(D).then(res, () => res()); }, 1500); });
}
export async function reconcileNow(D: D): Promise<void> {
  if (!(await notificationsAllowed())) return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => (n.content.data as any)?.tag === TAG).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const now = new Date(), horizon = new Date(now.getTime() + 7 * 864e5);
  const fires: { when: Date; r: Reminder }[] = [];
  for (const r of D.reminders || []) {
    if (!r.enabled) continue;
    if (r.target_kind !== "custom" && !remTarget(D, r)) continue; // target gone: inert
    for (const when of firesBetween(r, now, horizon)) {
      if (r.skip_if_done && r.target_kind !== "custom" && remDone(D, r, iso(when))) continue;
      fires.push({ when, r });
    }
  }
  fires.sort((a, b) => a.when.getTime() - b.when.getTime());
  for (const f of fires.slice(0, MAX_PENDING)) {
    const data: ReminderPayload = { tag: TAG, reminderId: f.r.id, target_kind: f.r.target_kind, target_id: f.r.target_id };
    await Notifications.scheduleNotificationAsync({
      content: f.r.private ? { title: PRIVATE_TEXT, data } : { title: f.r.title || PRIVATE_TEXT, data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: f.when, ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}) } as any,
    });
  }
}

export async function cancelAllHealthNotifications(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((n) => (n.content.data as any)?.tag === TAG).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch { /* notifications unavailable */ }
}
export const payloadOf = (resp: Notifications.NotificationResponse | null): ReminderPayload | null => {
  const d = resp?.notification.request.content.data as any;
  return d && d.tag === TAG ? (d as ReminderPayload) : null;
};
