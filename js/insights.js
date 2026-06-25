import { isGlucoseInRange, glucoseTypeLabel, classifyBloodPressure } from "./config.js";

function daysAgo(n) {
  return Date.now() - n * 86400000;
}

function inWindow(iso, days) {
  return new Date(iso).getTime() >= daysAgo(days);
}

function pctInRange(readings, goals, days) {
  const subset = readings.filter((r) => inWindow(r.recorded_at, days));
  if (!subset.length) return null;
  const ok = subset.filter((r) => isGlucoseInRange(r, goals)).length;
  return Math.round((ok / subset.length) * 100);
}

function avg(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function trendLabel(currentAvg, previousAvg, unit, lowerIsBetter = true) {
  if (currentAvg == null || previousAvg == null) return null;
  const diff = currentAvg - previousAvg;
  if (Math.abs(diff) < 2) {
    return { type: "info", text: `Tu promedio se mantiene estable (${currentAvg.toFixed(0)} ${unit}).` };
  }
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  const dir = diff > 0 ? "subió" : "bajó";
  return {
    type: improved ? "good" : "warn",
    text: `Tu promedio ${dir} ${Math.abs(diff).toFixed(0)} ${unit} vs la semana anterior (${currentAvg.toFixed(0)} vs ${previousAvg.toFixed(0)}).`,
  };
}

export function computeGlucoseInsights(readings, goals) {
  const items = [];
  const last7 = pctInRange(readings, goals, 7);
  const last30 = pctInRange(readings, goals, 30);

  if (last7 != null) {
    items.push({
      type: last7 >= 80 ? "good" : last7 >= 60 ? "info" : "warn",
      text: `${last7}% de lecturas de glucosa en rango en los últimos 7 días.`,
    });
  }
  if (last30 != null) {
    items.push({
      type: "info",
      text: `${last30}% en rango en los últimos 30 días.`,
    });
  }

  const fastingRecent = readings.filter(
    (r) => r.glucose_type === "ayunas" && inWindow(r.recorded_at, 14)
  );
  const highFasting = fastingRecent.filter((r) => r.value_mg_dl > goals.fasting);
  if (highFasting.length >= 3) {
    items.push({
      type: "warn",
      text: `${highFasting.length} lecturas de ayunas por encima de ${goals.fasting} mg/dL en 2 semanas. Considera comentarlo con tu médico.`,
    });
  }

  const post1h = readings.filter(
    (r) =>
      r.glucose_type === "post_comida" &&
      (r.hours_post === 1 || r.hours_post == null) &&
      inWindow(r.recorded_at, 14)
  );
  const highPost = post1h.filter((r) => r.value_mg_dl > goals.post_1h);
  if (highPost.length >= 2) {
    items.push({
      type: "warn",
      text: `Varias lecturas post-comida (1h) sobre ${goals.post_1h} mg/dL. Anota qué comiste para identificar disparadores.`,
    });
  }

  const week = readings.filter((r) => inWindow(r.recorded_at, 7));
  const prevWeek = readings.filter(
    (r) => inWindow(r.recorded_at, 14) && !inWindow(r.recorded_at, 7)
  );
  const trend = trendLabel(avg(week.map((r) => r.value_mg_dl)), avg(prevWeek.map((r) => r.value_mg_dl)), "mg/dL");
  if (trend) items.push(trend);

  if (!items.length) {
    items.push({
      type: "info",
      text: "Sigue registrando tus medidas a la misma hora cada día para ver patrones claros.",
    });
    items.push({
      type: "info",
      text: "Anota lo que comiste cuando registres glucosa post-comida.",
    });
  }

  return items;
}

export function computeBpInsights(readings) {
  const items = [];
  const recent = readings.filter((r) => inWindow(r.recorded_at, 30));
  if (!recent.length) {
    items.push({ type: "info", text: "Registra tu presión arterial para ver tendencias y clasificación AHA." });
    return items;
  }

  const elevated = recent.filter((r) => {
    const c = classifyBloodPressure(r.systolic, r.diastolic);
    return c.className !== "bp-normal";
  });
  const pct = Math.round(((recent.length - elevated.length) / recent.length) * 100);
  items.push({
    type: pct >= 70 ? "good" : "warn",
    text: `${pct}% de lecturas de presión en rango normal (últimos 30 días).`,
  });

  const week = recent.filter((r) => inWindow(r.recorded_at, 7));
  const prevWeek = readings.filter(
    (r) => inWindow(r.recorded_at, 14) && !inWindow(r.recorded_at, 7)
  );
  const trend = trendLabel(
    avg(week.map((r) => r.systolic)),
    avg(prevWeek.map((r) => r.systolic)),
    "mmHg systólica"
  );
  if (trend) items.push(trend);

  const latest = readings[0];
  if (latest) {
    const c = classifyBloodPressure(latest.systolic, latest.diastolic);
    items.push({
      type: c.className === "bp-normal" ? "good" : "warn",
      text: `Última lectura: ${latest.systolic}/${latest.diastolic} mmHg — ${c.label}.`,
    });
  }

  return items;
}

export function renderInsights(container, items) {
  container.innerHTML = items
    .map((item) => `<div class="insight-item ${item.type}">• ${item.text}</div>`)
    .join("");
}

export { glucoseTypeLabel };
