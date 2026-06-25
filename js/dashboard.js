import {
  formatDateTime,
  glucoseTypeLabel,
  isGlucoseInRange,
  classifyBloodPressure,
  ARMS,
} from "./config.js";

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function latestOfType(readings, type, extraFilter) {
  return readings.find((r) => {
    if (r.glucose_type !== type) return false;
    return extraFilter ? extraFilter(r) : true;
  });
}

export function renderGlucoseSummary(container, readings, goals) {
  const fasting = latestOfType(readings, "ayunas");
  const preMeal = latestOfType(readings, "pre_comida");
  const postMeal = latestOfType(readings, "post_comida");

  const cards = [
    {
      label: "Última Ayunas",
      meta: fasting && isToday(fasting.recorded_at) ? "Hoy" : fasting ? formatDateTime(fasting.recorded_at) : "—",
      value: fasting?.value_mg_dl,
      unit: "mg/dL",
      inRange: fasting ? isGlucoseInRange(fasting, goals) : null,
    },
    {
      label: "Pre-Comida",
      meta: preMeal ? formatDateTime(preMeal.recorded_at) : "Sin registro",
      value: preMeal?.value_mg_dl,
      unit: "mg/dL",
      inRange: preMeal ? isGlucoseInRange(preMeal, goals) : null,
    },
    {
      label: "Post-Comida",
      meta: postMeal ? `${glucoseTypeLabel(postMeal).replace("Post-Comida ", "")}` : "Sin registro",
      value: postMeal?.value_mg_dl,
      unit: "mg/dL",
      inRange: postMeal ? isGlucoseInRange(postMeal, goals) : null,
    },
  ];

  container.innerHTML = cards
    .map((c) => {
      const rangeClass =
        c.inRange === true ? "in-range" : c.inRange === false ? "out-range" : "neutral";
      const display = c.value != null ? c.value : "—";
      return `
        <article class="summary-card ${rangeClass}">
          <div class="summary-label">${c.label}</div>
          <div class="summary-value">${display}<span class="summary-unit">${c.value != null ? ` ${c.unit}` : ""}</span></div>
          <div class="summary-meta">${c.meta}</div>
        </article>`;
    })
    .join("");
}

function bpSummaryRangeClass(className) {
  if (className === "bp-normal") return "in-range";
  if (className === "bp-elevated") return "warn-range";
  if (className === "bp-high") return "out-range";
  return "neutral";
}

export function renderBpSummary(container, readings) {
  const latest = readings[0];
  const classification = latest
    ? classifyBloodPressure(latest.systolic, latest.diastolic)
    : null;

  const cards = [
    {
      label: "Última Medición",
      meta: latest ? formatDateTime(latest.recorded_at) : "Sin registro",
      value: latest ? `${latest.systolic}/${latest.diastolic}` : "—",
      unit: latest ? "mmHg" : "",
      sub: classification?.label || "",
      rangeClass: bpSummaryRangeClass(classification?.className),
    },
    {
      label: "Pulso",
      meta: latest?.arm ? `Brazo ${ARMS[latest.arm] || latest.arm}` : "",
      value: latest?.pulse ?? "—",
      unit: latest?.pulse != null ? "lpm" : "",
      sub: "",
      rangeClass: "neutral",
    },
    {
      label: "Clasificación",
      meta: latest ? "Según tus metas (≤121/81 normal)" : "",
      value: classification?.label || "—",
      unit: "",
      sub: "",
      rangeClass: bpSummaryRangeClass(classification?.className),
    },
  ];

  container.innerHTML = cards
    .map(
      (c) => `
      <article class="summary-card ${c.rangeClass}">
        <div class="summary-label">${c.label}</div>
        <div class="summary-value">${c.value}${c.unit ? `<span class="summary-unit"> ${c.unit}</span>` : ""}</div>
        <div class="summary-meta">${c.meta || c.sub}</div>
      </article>`
    )
    .join("");
}
