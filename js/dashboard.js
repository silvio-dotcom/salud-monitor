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

function rangeClass(inRange) {
  if (inRange === true) return "in-range";
  if (inRange === false) return "out-range";
  return "neutral";
}

function statusChip(inRange) {
  if (inRange === true) return `<span class="status-chip good">En meta</span>`;
  if (inRange === false) return `<span class="status-chip bad">Fuera de meta</span>`;
  return "";
}

function bpRangeClass(className) {
  if (className === "bp-normal") return "in-range";
  if (className === "bp-elevated") return "warn-range";
  if (className === "bp-high") return "out-range";
  return "neutral";
}

function bpStatusChip(className) {
  if (className === "bp-normal") return `<span class="status-chip good">Normal</span>`;
  if (className === "bp-elevated") return `<span class="status-chip warn">Elevada</span>`;
  if (className === "bp-high") return `<span class="status-chip bad">Alta</span>`;
  return "";
}

function miniCard(label, value, unit, meta, inRange) {
  const display = value != null ? value : "—";
  return `
    <article class="summary-mini ${rangeClass(inRange)}">
      <div class="summary-label">${label}</div>
      <div class="summary-mini-value">${display}${value != null && unit ? `<span class="summary-unit">${unit}</span>` : ""}</div>
      <div class="summary-meta">${meta}</div>
    </article>`;
}

export function renderGlucoseSummary(container, readings, goals) {
  const latest = readings[0];
  const fasting = latestOfType(readings, "ayunas");
  const preMeal = latestOfType(readings, "pre_comida");
  const postMeal = latestOfType(readings, "post_comida");

  const heroInRange = latest ? isGlucoseInRange(latest, goals) : null;
  const heroValue = latest?.value_mg_dl ?? "—";
  const heroMeta = latest
    ? `${glucoseTypeLabel(latest)} · ${isToday(latest.recorded_at) ? "Hoy" : formatDateTime(latest.recorded_at)}`
    : "Sin registros — pulsa + para agregar";

  const hero = `
    <article class="summary-hero ${rangeClass(heroInRange)}">
      <div class="summary-hero-top">
        <span class="summary-chip">Glucosa</span>
        ${statusChip(heroInRange)}
      </div>
      <div class="summary-hero-value">${heroValue}${latest ? `<span class="summary-unit"> mg/dL</span>` : ""}</div>
      <div class="summary-hero-meta">${heroMeta}</div>
    </article>`;

  const minis = [
    miniCard(
      "Ayunas",
      fasting?.value_mg_dl,
      " mg/dL",
      fasting ? (isToday(fasting.recorded_at) ? "Hoy" : formatDateTime(fasting.recorded_at)) : "—",
      fasting ? isGlucoseInRange(fasting, goals) : null
    ),
    miniCard(
      "Pre-comida",
      preMeal?.value_mg_dl,
      " mg/dL",
      preMeal ? formatDateTime(preMeal.recorded_at) : "—",
      preMeal ? isGlucoseInRange(preMeal, goals) : null
    ),
    miniCard(
      "Post-comida",
      postMeal?.value_mg_dl,
      " mg/dL",
      postMeal ? glucoseTypeLabel(postMeal).replace("Post-Comida ", "") : "—",
      postMeal ? isGlucoseInRange(postMeal, goals) : null
    ),
  ].join("");

  container.innerHTML = `
    <div class="summary-section">
      ${hero}
      <div class="summary-mini-grid">${minis}</div>
    </div>`;
}

export function renderBpSummary(container, readings) {
  const latest = readings[0];
  const classification = latest ? classifyBloodPressure(latest.systolic, latest.diastolic) : null;
  const rc = bpRangeClass(classification?.className);

  const heroValue = latest ? `${latest.systolic}/${latest.diastolic}` : "—";
  const heroMeta = latest
    ? `${formatDateTime(latest.recorded_at)}${latest.arm ? ` · Brazo ${ARMS[latest.arm] || latest.arm}` : ""}`
    : "Sin registros — pulsa + para agregar";

  const hero = `
    <article class="summary-hero ${rc}">
      <div class="summary-hero-top">
        <span class="summary-chip">Presión arterial</span>
        ${classification ? bpStatusChip(classification.className) : ""}
      </div>
      <div class="summary-hero-value">${heroValue}${latest ? `<span class="summary-unit"> mmHg</span>` : ""}</div>
      <div class="summary-hero-meta">${heroMeta}${classification ? ` · ${classification.label}` : ""}</div>
    </article>`;

  const pulseMini = miniCard(
    "Pulso",
    latest?.pulse ?? null,
    latest?.pulse != null ? " lpm" : "",
    latest?.pulse != null ? "Última lectura" : "Sin dato",
    null
  );

  const refMini = `
    <article class="summary-mini neutral">
      <div class="summary-label">Referencia</div>
      <div class="summary-mini-value">≤121/81<span class="summary-unit"> normal</span></div>
      <div class="summary-meta">Tus metas personalizadas</div>
    </article>`;

  container.innerHTML = `
    <div class="summary-section">
      ${hero}
      <div class="summary-mini-grid summary-mini-grid-2">
        ${pulseMini}
        ${refMini}
      </div>
    </div>`;
}
