import {
  classifyBloodPressure,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  DEFAULT_GOALS,
  DEFAULT_GESTATIONAL_WEEK,
  MEALS,
  MEALS_BY_TYPE,
} from "./config.js";
import {
  getProfile,
  saveProfile,
  listGlucose,
  saveGlucose,
  deleteGlucose,
  listBloodPressure,
  saveBloodPressure,
  deleteBloodPressure,
  tryLoadRepoBackup,
} from "./storage.js";
import { renderGlucoseSummary, renderBpSummary } from "./dashboard.js";
import { renderGlucoseChart, renderBpChart } from "./charts.js";
import { renderAiInsightsBlock } from "./insights.js";
import { loadAiInsights, formatAiInsightMeta, clearAiInsightsCache } from "./ai-insights.js";
import {
  renderHistory,
  filterReadings,
  bindHistoryActions,
  updateHistoryFilterOptions,
} from "./history.js";
import { downloadPdfReport } from "./reports.js";
import { buildSaveCelebration } from "./cat-messages.js";

const state = {
  tab: "glucose",
  chartRange: "7",
  profile: {
    patient_name: "Salud Monitor",
    gestational_week: DEFAULT_GESTATIONAL_WEEK,
    goals: { ...DEFAULT_GOALS },
  },
  glucose: [],
  bloodPressure: [],
  aiInsights: { loading: false, result: null },
};

function toast(msg) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function showCelebration(celeb) {
  const modal = document.getElementById("celebration-modal");
  document.getElementById("celebration-emoji").textContent = celeb.emoji;
  document.getElementById("celebration-title").textContent = celeb.title;
  document.getElementById("celebration-value").textContent = celeb.value;
  document.getElementById("celebration-unit").textContent = celeb.unit;
  document.getElementById("celebration-message").textContent = celeb.message;
  modal.showModal();
}

async function refreshData() {
  const [profile, glucose, bloodPressure] = await Promise.all([
    getProfile(),
    listGlucose(),
    listBloodPressure(),
  ]);
  state.profile = profile;
  state.glucose = glucose;
  state.bloodPressure = bloodPressure;
  document.getElementById("patient-name").textContent = profile.patient_name;
  const week = profile.gestational_week ?? DEFAULT_GESTATIONAL_WEEK;
  document.getElementById("gestational-week").textContent = `Semana ${week}`;
  render();
  refreshAiInsights();
}

function renderInsightsPanel() {
  const insightsEl = document.getElementById("insights-content");
  const week = state.profile.gestational_week ?? DEFAULT_GESTATIONAL_WEEK;

  const meta = state.aiInsights.result
    ? formatAiInsightMeta(state.aiInsights.result, week)
    : `Análisis inteligente · Semana ${week}`;

  const aiBlock = renderAiInsightsBlock({
    meta,
    paragraph: state.aiInsights.result?.paragraph,
    loading: state.aiInsights.loading,
    error: null,
    standalone: true,
  });

  insightsEl.innerHTML = aiBlock || `<p class="ai-insights-loading">Preparando análisis…</p>`;
}

async function refreshAiInsights({ force = false } = {}) {
  if (force) clearAiInsightsCache();
  state.aiInsights.loading = true;
  renderInsightsPanel();

  try {
    state.aiInsights.result = await loadAiInsights({
      tab: state.tab,
      glucose: state.glucose,
      bloodPressure: state.bloodPressure,
      goals: state.profile.goals,
      profile: state.profile,
    });
  } catch {
    state.aiInsights.result = null;
  } finally {
    state.aiInsights.loading = false;
    renderInsightsPanel();
  }
}

function render() {
  const summaryEl = document.getElementById("summary-panel");
  const chartTitle = document.getElementById("chart-title");
  const canvas = document.getElementById("main-chart");
  const listEl = document.getElementById("history-list");
  const emptyEl = document.getElementById("history-empty");
  const search = document.getElementById("history-search").value.trim();
  const typeFilter = document.getElementById("history-filter").value;

  if (state.tab === "glucose") {
    chartTitle.textContent = "Tendencia de glucosa";
    renderGlucoseSummary(summaryEl, state.glucose, state.profile.goals);
    renderGlucoseChart(canvas, state.glucose, state.profile.goals, state.chartRange);
    renderInsightsPanel();
    const filtered = filterReadings(state.glucose, { search, typeFilter, tab: "glucose" });
    renderHistory(listEl, emptyEl, filtered, {
      tab: "glucose",
      goals: state.profile.goals,
    });
  } else {
    chartTitle.textContent = "Tendencia de presión";
    renderBpSummary(summaryEl, state.bloodPressure);
    renderBpChart(canvas, state.bloodPressure, state.chartRange);
    renderInsightsPanel();
    const filtered = filterReadings(state.bloodPressure, { search, typeFilter, tab: "bp" });
    renderHistory(listEl, emptyEl, filtered, { tab: "bp", goals: state.profile.goals });
  }
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  updateHistoryFilterOptions(document.getElementById("history-filter"), tab);
  document.getElementById("history-search").value = "";
  render();
  refreshAiInsights();
}

function openMeasureModal({ kind, record = null }) {
  const modal = document.getElementById("measure-modal");
  const form = document.getElementById("measure-form");
  form.reset();
  document.getElementById("measure-id").value = record?.id || "";
  document.getElementById("measure-modal-title").innerHTML = record
    ? 'Editar Lectura <span class="reading-deco" aria-hidden="true">🐾</span>'
    : 'Nueva Lectura <span class="reading-deco" aria-hidden="true">🐾</span>';

  setMeasureKind(kind || "glucose");

  const dt = record?.recorded_at || new Date().toISOString();
  document.getElementById("measure-datetime").value = toDatetimeLocalValue(dt);

  if (kind === "glucose" && record) {
    setGlucoseType(record.glucose_type, record.meal);
    document.getElementById("measure-glucose-value").value = record.value_mg_dl;
    setHoursPost(record.hours_post || 1);
    document.getElementById("measure-notes").value = record.notes || "";
  } else if (kind === "glucose") {
    setGlucoseType("ayunas");
    setHoursPost(1);
  }

  if (kind === "bp" && record) {
    document.getElementById("measure-systolic").value = record.systolic;
    document.getElementById("measure-diastolic").value = record.diastolic;
    document.getElementById("measure-pulse").value = record.pulse ?? "";
    setArm(record.arm || "izquierdo");
    document.getElementById("measure-notes").value = record.notes || "";
    updateBpClassification();
  } else if (kind === "bp") {
    setArm("izquierdo");
  }

  updateRequiredFields(kind || "glucose");
  modal.showModal();
  if (kind === "glucose") {
    setTimeout(() => document.getElementById("measure-glucose-value")?.focus(), 100);
  }
}

function setMeasureKind(kind) {
  document.getElementById("measure-kind").value = kind;
  document.getElementById("glucose-fields").classList.toggle("hidden", kind !== "glucose");
  document.getElementById("bp-fields").classList.toggle("hidden", kind !== "bp");
  document.querySelectorAll(".pill-toggle-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.kind === kind);
  });
  updateRequiredFields(kind);
}

function updateRequiredFields(kind) {
  const glucoseVal = document.getElementById("measure-glucose-value");
  const sys = document.getElementById("measure-systolic");
  const dia = document.getElementById("measure-diastolic");
  glucoseVal.required = kind === "glucose";
  sys.required = kind === "bp";
  dia.required = kind === "bp";
}

function setGlucoseType(type, selectedMeal) {
  document.getElementById("measure-glucose-type").value = type;
  document.querySelectorAll(".type-segment").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
  syncGlucoseFormFields(type, selectedMeal);
}

function renderMealChoices(type, selected) {
  const container = document.getElementById("meal-choices");
  const meals = MEALS_BY_TYPE[type] || [];
  container.classList.toggle("cols-3", meals.length === 3);
  let html = meals
    .map(
      (key) =>
        `<button type="button" class="meal-choice${selected === key ? " active" : ""}" data-meal="${key}">${MEALS[key]}</button>`
    )
    .join("");
  if (selected && !meals.includes(selected)) {
    html += `<button type="button" class="meal-choice active" data-meal="${selected}">${MEALS[selected] || selected}</button>`;
  }
  container.innerHTML = html;
  const fallback = selected && (meals.includes(selected) || selected) ? selected : meals[0];
  if (fallback) setMeal(fallback);
}

function setMeal(meal) {
  document.getElementById("measure-meal").value = meal;
  document.querySelectorAll(".meal-choice").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.meal === meal);
  });
}

function syncGlucoseFormFields(type, selectedMeal) {
  const mealFields = document.getElementById("meal-fields");
  const hoursFields = document.getElementById("hours-post-fields");
  const showMeal = type === "pre_comida" || type === "post_comida";
  mealFields.classList.toggle("hidden", !showMeal);
  hoursFields.classList.toggle("hidden", type !== "post_comida");
  if (showMeal) renderMealChoices(type, selectedMeal || document.getElementById("measure-meal").value);
  if (type === "post_comida" && !selectedMeal) setHoursPost(1);
}

function setHoursPost(hours) {
  const value = hours === 2 ? 2 : 1;
  document.getElementById("measure-hours-post").value = value;
  document.querySelectorAll(".hours-segment").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.hours) === value);
  });
}

function setArm(arm) {
  document.getElementById("measure-arm").value = arm;
  document.querySelectorAll(".arm-segment").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.arm === arm);
  });
}

function updateBpClassification() {
  const sys = Number(document.getElementById("measure-systolic").value);
  const dia = Number(document.getElementById("measure-diastolic").value);
  const el = document.getElementById("bp-classification");
  if (!sys || !dia) {
    el.textContent = "";
    el.className = "bp-classification";
    return;
  }
  const c = classifyBloodPressure(sys, dia);
  el.textContent = c.label;
  el.className = `bp-classification ${c.className}`;
}

async function handleMeasureSubmit(e) {
  e.preventDefault();
  const kind = document.getElementById("measure-kind").value;
  const id = document.getElementById("measure-id").value || undefined;
  const recorded_at = fromDatetimeLocalValue(document.getElementById("measure-datetime").value);
  const notes = document.getElementById("measure-notes").value.trim();

  try {
    let celebration;
    if (kind === "glucose") {
      const glucose_type = document.getElementById("measure-glucose-type").value;
      const value_mg_dl = Number(document.getElementById("measure-glucose-value").value);
      if (!value_mg_dl) throw new Error("Ingresa el nivel de azúcar.");
      const hours_post =
        glucose_type === "post_comida"
          ? Number(document.getElementById("measure-hours-post").value)
          : null;
      if (glucose_type === "post_comida" && hours_post !== 1 && hours_post !== 2) {
        throw new Error("Selecciona 1 hora o 2 horas post-comida.");
      }
      const meal =
        glucose_type === "pre_comida" || glucose_type === "post_comida"
          ? document.getElementById("measure-meal").value
          : null;
      await saveGlucose({
        id,
        recorded_at,
        glucose_type,
        value_mg_dl,
        meal,
        hours_post,
        notes,
      });
      celebration = buildSaveCelebration({
        kind: "glucose",
        payload: { glucose_type, value_mg_dl, meal, hours_post },
        goals: state.profile.goals,
      });
    } else {
      const systolic = Number(document.getElementById("measure-systolic").value);
      const diastolic = Number(document.getElementById("measure-diastolic").value);
      const pulseVal = document.getElementById("measure-pulse").value;
      if (!systolic || !diastolic) throw new Error("Ingresa sistólica y diastólica.");
      await saveBloodPressure({
        id,
        recorded_at,
        systolic,
        diastolic,
        pulse: pulseVal ? Number(pulseVal) : null,
        arm: document.getElementById("measure-arm").value,
        notes,
      });
      celebration = buildSaveCelebration({
        kind: "bp",
        payload: { systolic, diastolic },
        goals: state.profile.goals,
      });
    }
    document.getElementById("measure-modal").close();
    showCelebration(celebration);
    await refreshData();
  } catch (err) {
    toast(err.message || "Error al guardar");
  }
}

function bindUi() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.chartRange = btn.dataset.range;
      render();
    });
  });

  document.getElementById("fab-new").addEventListener("click", () => {
    openMeasureModal({ kind: state.tab === "glucose" ? "glucose" : "bp" });
  });

  document.getElementById("history-empty")?.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-measure]")) {
      openMeasureModal({ kind: state.tab === "glucose" ? "glucose" : "bp" });
    }
  });

  const disclaimer = document.getElementById("disclaimer-bar");
  if (disclaimer && localStorage.getItem("salud-disclaimer-open") === "0") {
    disclaimer.removeAttribute("open");
  }
  disclaimer?.addEventListener("toggle", () => {
    localStorage.setItem("salud-disclaimer-open", disclaimer.open ? "1" : "0");
  });

  document.getElementById("measure-form").addEventListener("submit", handleMeasureSubmit);

  document.querySelectorAll(".pill-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMeasureKind(btn.dataset.kind));
  });

  document.querySelectorAll(".type-segment").forEach((btn) => {
    btn.addEventListener("click", () => setGlucoseType(btn.dataset.type));
  });

  document.getElementById("meal-choices").addEventListener("click", (e) => {
    const btn = e.target.closest(".meal-choice");
    if (btn) setMeal(btn.dataset.meal);
  });

  document.querySelectorAll(".hours-segment").forEach((btn) => {
    btn.addEventListener("click", () => setHoursPost(Number(btn.dataset.hours)));
  });

  document.querySelectorAll(".arm-segment").forEach((btn) => {
    btn.addEventListener("click", () => setArm(btn.dataset.arm));
  });

  document.getElementById("measure-systolic").addEventListener("input", updateBpClassification);
  document.getElementById("measure-diastolic").addEventListener("input", updateBpClassification);

  document.getElementById("celebration-dismiss").addEventListener("click", () => {
    document.getElementById("celebration-modal").close();
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest("dialog")?.close());
  });

  document.getElementById("history-search").addEventListener("input", render);
  document.getElementById("history-filter").addEventListener("change", render);

  document.getElementById("refresh-insights").addEventListener("click", () => refreshAiInsights({ force: true }));

  bindHistoryActions(document.getElementById("history-list"), {
    onEdit: (id) => {
      if (state.tab === "glucose") {
        const record = state.glucose.find((r) => r.id === id);
        if (record) openMeasureModal({ kind: "glucose", record });
      } else {
        const record = state.bloodPressure.find((r) => r.id === id);
        if (record) openMeasureModal({ kind: "bp", record });
      }
    },
    onDelete: async (id) => {
      if (!confirm("¿Eliminar este registro?")) return;
      if (state.tab === "glucose") await deleteGlucose(id);
      else await deleteBloodPressure(id);
      toast("Registro eliminado");
      await refreshData();
    },
  });

  document.getElementById("export-pdf-btn").addEventListener("click", async () => {
    await downloadPdfReport();
    toast("PDF generado");
  });

  document.getElementById("settings-btn").addEventListener("click", () => {
    const modal = document.getElementById("settings-modal");
    document.getElementById("settings-patient-name").value = state.profile.patient_name;
    const g = state.profile.goals;
    document.getElementById("goal-fasting").value = g.fasting;
    document.getElementById("goal-pre").value = g.pre_meal;
    document.getElementById("goal-post1").value = g.post_1h;
    document.getElementById("goal-post2").value = g.post_2h;
    document.getElementById("settings-gestational-week").value =
      state.profile.gestational_week ?? DEFAULT_GESTATIONAL_WEEK;
    modal.showModal();
  });

  document.getElementById("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const profile = {
      patient_name: document.getElementById("settings-patient-name").value.trim() || "Salud Monitor",
      gestational_week:
        Number(document.getElementById("settings-gestational-week").value) || DEFAULT_GESTATIONAL_WEEK,
      goals: {
        fasting: Number(document.getElementById("goal-fasting").value) || DEFAULT_GOALS.fasting,
        pre_meal: Number(document.getElementById("goal-pre").value) || DEFAULT_GOALS.pre_meal,
        post_1h: Number(document.getElementById("goal-post1").value) || DEFAULT_GOALS.post_1h,
        post_2h: Number(document.getElementById("goal-post2").value) || DEFAULT_GOALS.post_2h,
      },
    };
    await saveProfile(profile);
    document.getElementById("settings-modal").close();
    toast("Configuración guardada");
    clearAiInsightsCache();
    await refreshData();
    refreshAiInsights({ force: true });
  });

  updateHistoryFilterOptions(document.getElementById("history-filter"), state.tab);
}

async function bootstrap() {
  bindUi();
  const restored = await tryLoadRepoBackup({ onlyIfEmpty: true });
  if (restored.ok) toast(`Datos cargados: ${restored.glucose} glucosa, ${restored.bp} presión`);
  else if (import.meta.env.DEV) await maybeSeedDemo();
  await refreshData();
}

bootstrap();

async function maybeSeedDemo() {
  const glucose = await listGlucose();
  if (glucose.length) return;
  const now = Date.now();
  const day = 86400000;
  const samples = [
    { glucose_type: "ayunas", value_mg_dl: 94, offset: 0 },
    { glucose_type: "post_comida", value_mg_dl: 115, meal: "almuerzo", hours_post: 1, offset: day },
    { glucose_type: "ayunas", value_mg_dl: 89, offset: day * 2 },
  ];
  for (const s of samples) {
    await saveGlucose({
      recorded_at: new Date(now - s.offset).toISOString(),
      glucose_type: s.glucose_type,
      value_mg_dl: s.value_mg_dl,
      meal: s.meal || null,
      hours_post: s.hours_post || null,
      notes: "",
    });
  }
}
