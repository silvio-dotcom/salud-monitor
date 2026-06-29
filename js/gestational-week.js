import { DEFAULT_GESTATIONAL_WEEK } from "./config.js";

/** Lunes 00:00 hora local de la semana que contiene `date`. */
export function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mondayKey(date = new Date()) {
  const m = getMonday(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(m.getDate())}`;
}

function parseMondayKey(key) {
  const [y, mo, d] = String(key).split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function weeksBetweenMondayKeys(fromKey, toKey) {
  const from = parseMondayKey(fromKey);
  const to = parseMondayKey(toKey);
  return Math.round((to.getTime() - from.getTime()) / (7 * 86400000));
}

/** Calcula la semana gestacional; avanza +1 cada lunes desde el ancla. */
export function syncGestationalWeek(profile = {}) {
  const baseWeek =
    profile.gestational_week_at_anchor ?? profile.gestational_week ?? DEFAULT_GESTATIONAL_WEEK;
  const anchorKey = profile.gestational_week_anchor;
  const currentKey = mondayKey();

  if (!anchorKey) {
    return {
      ...profile,
      gestational_week: baseWeek,
      gestational_week_anchor: currentKey,
      gestational_week_at_anchor: baseWeek,
    };
  }

  const weeksElapsed = weeksBetweenMondayKeys(anchorKey, currentKey);
  const week = Math.min(42, Math.max(1, baseWeek + weeksElapsed));

  return { ...profile, gestational_week: week };
}

/** Fija ancla al lunes actual cuando el usuario ajusta la semana manualmente. */
export function anchorGestationalWeek(profile, week) {
  const w = Math.min(42, Math.max(1, Number(week) || DEFAULT_GESTATIONAL_WEEK));
  return {
    ...profile,
    gestational_week: w,
    gestational_week_anchor: mondayKey(),
    gestational_week_at_anchor: w,
  };
}
