import {
  isGlucoseInRange,
  glucoseTypeLabel,
  classifyBloodPressure,
} from "./config.js";

const CACHE_KEY = "salud-ai-insights-v2";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_PARAGRAPH_CHARS = 320;

function daysAgo(n) {
  return Date.now() - n * 86400000;
}

function inWindow(iso, days) {
  return new Date(iso).getTime() >= daysAgo(days);
}

function avg(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function trimParagraph(text) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_PARAGRAPH_CHARS) return clean;
  const cut = clean.slice(0, MAX_PARAGRAPH_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 200 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function itemsToParagraph(items) {
  return trimParagraph(items.map((item) => item.text).join(" "));
}

function normalizeInsightResult(data, source = "ai") {
  if (data?.paragraph) {
    return { paragraph: trimParagraph(data.paragraph), source: data.source || source };
  }
  if (Array.isArray(data?.items) && data.items.length) {
    return { paragraph: itemsToParagraph(data.items), source: data.source || source };
  }
  throw new Error("Respuesta IA vacía");
}

function cacheKey(payload) {
  return JSON.stringify({
    tab: payload.tab,
    week: payload.gestational_week,
    g: payload.glucose?.length,
    bp: payload.blood_pressure?.length,
    gHash: payload.glucose?.slice(0, 5).map((r) => `${r.recorded_at}:${r.value_mg_dl}`),
    bpHash: payload.blood_pressure?.slice(0, 3).map((r) => `${r.recorded_at}:${r.systolic}`),
  });
}

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (entry.key !== key || Date.now() - entry.at > CACHE_TTL_MS) return null;
    if (entry.result?.paragraph) return entry.result;
    if (entry.result?.items) return normalizeInsightResult(entry.result, entry.result.source || "local");
    return null;
  } catch {
    return null;
  }
}

function writeCache(key, result) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ key, at: Date.now(), result }));
  } catch {
    /* quota */
  }
}

export function clearAiInsightsCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem("salud-ai-insights-v1");
  } catch {
    /* ignore */
  }
}

export function buildAiPayload({ tab, glucose, bloodPressure, goals, profile }) {
  const gestational_week = profile.gestational_week ?? 33;
  const recentGlucose = glucose
    .filter((r) => inWindow(r.recorded_at, 14))
    .slice(0, 40)
    .map((r) => ({
      date: r.recorded_at.slice(0, 10),
      type: glucoseTypeLabel(r),
      value_mg_dl: r.value_mg_dl,
      in_range: isGlucoseInRange(r, goals),
    }));

  const recentBp = bloodPressure
    .filter((r) => inWindow(r.recorded_at, 14))
    .slice(0, 20)
    .map((r) => {
      const c = classifyBloodPressure(r.systolic, r.diastolic);
      return {
        date: r.recorded_at.slice(0, 10),
        systolic: r.systolic,
        diastolic: r.diastolic,
        classification: c.label,
      };
    });

  const fasting = recentGlucose.filter((r) => r.type.startsWith("Ayunas"));
  const post = recentGlucose.filter((r) => r.type.startsWith("Post"));

  return {
    tab,
    patient_name: profile.patient_name,
    gestational_week,
    goals,
    stats: {
      glucose_count_14d: recentGlucose.length,
      glucose_in_range_pct:
        recentGlucose.length > 0
          ? Math.round((recentGlucose.filter((r) => r.in_range).length / recentGlucose.length) * 100)
          : null,
      avg_fasting: avg(fasting.map((r) => r.value_mg_dl)),
      avg_post: avg(post.map((r) => r.value_mg_dl)),
      bp_count_14d: recentBp.length,
      avg_systolic: avg(recentBp.map((r) => r.systolic)),
      avg_diastolic: avg(recentBp.map((r) => r.diastolic)),
      latest_bp: recentBp[0] || null,
    },
    glucose: recentGlucose,
    blood_pressure: recentBp,
  };
}

export function generateLocalPregnancyInsights(payload) {
  const week = payload.gestational_week ?? 33;
  const { stats, tab } = payload;

  if (tab === "glucose") {
    if (stats.glucose_count_14d === 0) {
      return {
        paragraph: trimParagraph(
          `Semana ${week} de embarazo: registra glucosa en ayunas y post-comida para detectar cambios a tiempo. Cada lectura ayuda a ti y a tu médico a ver el panorama completo. 🐾`
        ),
        source: "local",
      };
    }

    const pct = stats.glucose_in_range_pct;
    const fasting = stats.avg_fasting != null ? Math.round(stats.avg_fasting) : null;
    let text = `Semana ${week}: en 14 días, ${pct}% de tus glucosas estuvieron en meta.`;

    if (fasting != null) {
      text +=
        pct >= 75
          ? ` Tu ayunas promedia ~${fasting} mg/dL y se ve estable — muy buen control en este tramo del embarazo. 🐾`
          : ` Tu ayunas promedia ~${fasting} mg/dL; anota qué comiste cuando suba post-comida y compártelo en tu cita.`;
    } else {
      text += " Sigue registrando a la misma hora para ver patrones más claros.";
    }

    return { paragraph: trimParagraph(text), source: "local" };
  }

  if (stats.bp_count_14d === 0) {
    return {
      paragraph: trimParagraph(
        `Semana ${week}: en el tercer trimestre conviene medir presión 2–3 veces por semana, en reposo y mismo brazo. Así detectas cambios temprano junto a tu equipo médico. 🐾`
      ),
      source: "local",
    };
  }

  const latest = stats.latest_bp;
  const bpClass = latest ? classifyBloodPressure(latest.systolic, latest.diastolic).className : null;
  const avgSys = stats.avg_systolic != null ? Math.round(stats.avg_systolic) : null;
  const avgDia = stats.avg_diastolic != null ? Math.round(stats.avg_diastolic) : null;

  let text;
  if (latest && bpClass === "bp-high") {
    text = `Semana ${week}: tu última presión fue ${latest.systolic}/${latest.diastolic} mmHg. Si se repite o tienes dolor de cabeza, visión borrosa o hinchazón súbita, contacta a tu médico hoy.`;
  } else if (latest && bpClass === "bp-elevated") {
    text = `Semana ${week}: última presión ${latest.systolic}/${latest.diastolic} mmHg — ligeramente elevada. Sigue monitoreando en reposo y coméntalo en tu próxima cita. 🐾`;
  } else if (avgSys != null && avgDia != null) {
    text = `Semana ${week}: tu presión reciente promedia ~${avgSys}/${avgDia} mmHg, adecuada para monitoreo en esta etapa. Sigue midiendo en reposo, mismo brazo y horario similar. 🐾`;
  } else {
    text = `Semana ${week}: vas bien con el seguimiento de presión. Mantén mediciones en reposo y comenta cualquier cambio en tu próxima cita prenatal. 🐾`;
  }

  return { paragraph: trimParagraph(text), source: "local" };
}

async function fetchRemoteAiInsights(payload) {
  const url = import.meta.env.VITE_INSIGHTS_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url) return null;

  const headers = { "Content-Type": "application/json" };
  if (anonKey) headers.Authorization = `Bearer ${anonKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`IA no disponible (${res.status})`);
  const data = await res.json();
  return normalizeInsightResult(data, "ai");
}

export async function loadAiInsights(context) {
  const payload = buildAiPayload(context);
  const key = cacheKey(payload);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const remote = await fetchRemoteAiInsights(payload);
    if (remote) {
      writeCache(key, remote);
      return remote;
    }
  } catch {
    /* fallback below */
  }

  const local = generateLocalPregnancyInsights(payload);
  writeCache(key, local);
  return local;
}

export function formatAiInsightMeta(result, gestationalWeek) {
  const week = gestationalWeek ?? 33;
  if (result?.source === "ai") {
    return `Insight IA · Semana ${week}`;
  }
  return `Análisis inteligente · Semana ${week}`;
}
