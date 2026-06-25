import {
  isGlucoseInRange,
  glucoseTypeLabel,
  classifyBloodPressure,
} from "./config.js";

const CACHE_KEY = "salud-ai-insights-v1";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

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
    return entry.result;
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
  const items = [];
  const { stats, tab } = payload;

  items.push({
    type: "info",
    text: `Semana ${week} de embarazo: en esta etapa del tercer trimestre conviene mantener un registro constante de glucosa y presión, tal como lo estás haciendo.`,
  });

  if (tab === "glucose" || stats.glucose_count_14d > 0) {
    if (stats.glucose_count_14d === 0) {
      items.push({
        type: "info",
        text: "Aún no hay lecturas recientes de glucosa. En embarazo, ayunas y post-comida ayudan a detectar cambios temprano.",
      });
    } else {
      if (stats.glucose_in_range_pct != null) {
        items.push({
          type: stats.glucose_in_range_pct >= 75 ? "good" : stats.glucose_in_range_pct >= 50 ? "info" : "warn",
          text:
            stats.glucose_in_range_pct >= 75
              ? `En los últimos 14 días, ${stats.glucose_in_range_pct}% de tus glucosas estuvieron en meta — muy buen control para la semana ${week}.`
              : stats.glucose_in_range_pct >= 50
                ? `${stats.glucose_in_range_pct}% de glucosas en meta en 14 días. Revisa horarios de comida y anota qué comiste cuando suba post-comida.`
                : `Solo ${stats.glucose_in_range_pct}% en meta en 14 días. Vale la pena comentarlo en tu próxima cita de control prenatal.`,
        });
      }
      if (stats.avg_fasting != null) {
        const ok = stats.avg_fasting <= payload.goals.fasting;
        items.push({
          type: ok ? "good" : "warn",
          text: ok
            ? `Promedio de ayunas ~${Math.round(stats.avg_fasting)} mg/dL — dentro de tu meta (${payload.goals.fasting}).`
            : `Promedio de ayunas ~${Math.round(stats.avg_fasting)} mg/dL, por encima de ${payload.goals.fasting}. En embarazo la resistencia a insulina puede aumentar en semanas finales.`,
        });
      }
    }
  }

  if (tab === "bp" || stats.bp_count_14d > 0) {
    if (stats.bp_count_14d === 0) {
      items.push({
        type: "info",
        text: "Registra presión 2–3 veces por semana. A partir de la semana 20, el control ayuda a detectar señales de preeclampsia.",
      });
    } else {
      const latest = stats.latest_bp;
      const elevated = latest && (latest.systolic >= 140 || latest.diastolic >= 90);
      items.push({
        type: elevated ? "warn" : stats.avg_systolic != null && stats.avg_systolic < 120 ? "good" : "info",
        text: elevated
          ? `Última presión ${latest.systolic}/${latest.diastolic} mmHg. Si persiste o tienes dolor de cabeza, visión borrosa o hinchazón súbita, contacta a tu médico hoy.`
          : stats.avg_systolic != null
            ? `Promedio reciente ~${Math.round(stats.avg_systolic)}/${Math.round(stats.avg_diastolic)} mmHg — adecuado para monitoreo en semana ${week}.`
            : "Sigue registrando presión en reposo, mismo brazo y horario similar.",
      });
    }
  }

  if (items.length < 3) {
    items.push({
      type: "good",
      text: "Cada lectura que guardas es una pista para ti y tu equipo médico. ¡Sigue así! 🐾",
    });
  }

  return { items: items.slice(0, 4), source: "local" };
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
  if (!Array.isArray(data.items) || !data.items.length) throw new Error("Respuesta IA vacía");
  return { items: data.items.slice(0, 4), source: "ai" };
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
    return `Insight IA · Semana ${week} de embarazo`;
  }
  return `Análisis inteligente · Semana ${week} de embarazo`;
}
