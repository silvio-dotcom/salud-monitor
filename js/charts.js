import Chart from "chart.js/auto";
import { glucoseTypeLabel, glucoseGoal } from "./config.js";

let chartInstance = null;

const GLUCOSE_COLORS = {
  ayunas: "#0d9488",
  pre_comida: "#6366f1",
  post_comida: "#f59e0b",
};

const BP_COLORS = {
  systolic: "#dc2626",
  diastolic: "#2563eb",
};

function filterByRange(readings, rangeDays) {
  if (rangeDays === "all") return readings;
  const days = Number(rangeDays);
  const cutoff = Date.now() - days * 86400000;
  return readings.filter((r) => new Date(r.recorded_at).getTime() >= cutoff);
}

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

export function renderGlucoseChart(canvas, readings, goals, rangeDays) {
  destroyChart();
  const filtered = filterByRange(readings, rangeDays).sort(
    (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)
  );

  const types = ["ayunas", "pre_comida", "post_comida"];
  const dateIndex = buildDateIndex(filtered);

  const datasets = types.map((type) => ({
    label: type === "ayunas" ? "Ayunas" : type === "pre_comida" ? "Pre-Comida" : "Post-Comida",
    data: filtered
      .filter((r) => r.glucose_type === type)
      .map((r) => ({ x: dateIndex.get(r.recorded_at.slice(0, 10)), y: r.value_mg_dl })),
    borderColor: GLUCOSE_COLORS[type],
    backgroundColor: GLUCOSE_COLORS[type],
    tension: 0.25,
    pointRadius: 4,
    showLine: true,
  }));

  const refLines = [
    { y: goals.fasting, label: `Ayunas ≤ ${goals.fasting}` },
    { y: goals.pre_meal, label: `Pre ≤ ${goals.pre_meal}` },
    { y: goals.post_1h, label: `Post 1h ≤ ${goals.post_1h}` },
    { y: goals.post_2h, label: `Post 2h ≤ ${goals.post_2h}`, dash: true },
  ];

  refLines.forEach((ref) => {
    const maxX = Math.max(0, dateIndex.size - 1);
    datasets.push({
      label: ref.label,
      data: filtered.length
        ? [
            { x: 0, y: ref.y },
            { x: maxX, y: ref.y },
          ]
        : [],
      borderColor: "rgba(100,116,139,0.45)",
      borderDash: ref.dash ? [6, 4] : [4, 4],
      pointRadius: 0,
      borderWidth: 1,
    });
  });

  renderLegend(document.getElementById("chart-legend"), [
    ...types.map((t) => ({ color: GLUCOSE_COLORS[t], label: glucoseTypeLabel({ glucose_type: t }) })),
    { color: "rgba(100,116,139,0.45)", label: "Metas" },
  ]);

  chartInstance = new Chart(canvas, {
    type: "line",
    data: { datasets: datasets.map((ds) => ({ ...ds, parsing: false })) },
    options: chartOptions("mg/dL", filtered),
  });
}

export function renderBpChart(canvas, readings, rangeDays) {
  destroyChart();
  const filtered = filterByRange(readings, rangeDays).sort(
    (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)
  );

  const dateIndex = buildDateIndex(filtered);
  const toX = (iso) => dateIndex.get(iso.slice(0, 10));

  const datasets = [
    {
      label: "Sistólica",
      data: filtered.map((r) => ({ x: toX(r.recorded_at), y: r.systolic })),
      borderColor: BP_COLORS.systolic,
      tension: 0.25,
      pointRadius: 4,
    },
    {
      label: "Diastólica",
      data: filtered.map((r) => ({ x: toX(r.recorded_at), y: r.diastolic })),
      borderColor: BP_COLORS.diastolic,
      tension: 0.25,
      pointRadius: 4,
    },
    {
      label: "Normal (<120/80)",
      data: filtered.length
        ? [
            { x: 0, y: 120 },
            { x: Math.max(0, dateIndex.size - 1), y: 120 },
          ]
        : [],
      borderColor: "rgba(5,150,105,0.35)",
      borderDash: [4, 4],
      pointRadius: 0,
      borderWidth: 1,
    },
  ];

  renderLegend(document.getElementById("chart-legend"), [
    { color: BP_COLORS.systolic, label: "Sistólica" },
    { color: BP_COLORS.diastolic, label: "Diastólica" },
    { color: "rgba(5,150,105,0.35)", label: "Referencia 120" },
  ]);

  chartInstance = new Chart(canvas, {
    type: "line",
    data: { datasets: datasets.map((ds) => ({ ...ds, parsing: false })) },
    options: chartOptions("mmHg", filtered),
  });
}

function formatAxisDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function chartOptions(unit, readings) {
  const labels = [...new Set(readings.map((r) => formatAxisDate(r.recorded_at)))];
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: false },
    scales: {
      x: {
        type: "linear",
        ticks: {
          callback(value) {
            const idx = Math.round(value);
            return labels[idx] || "";
          },
          maxTicksLimit: 8,
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: false,
        title: { display: true, text: unit },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(ctx) {
            return `${ctx.dataset.label}: ${ctx.parsed.y} ${unit}`;
          },
        },
      },
    },
  };
}

function renderLegend(el, items) {
  if (!el) return;
  el.innerHTML = items
    .map(
      (i) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${i.color}"></span>${i.label}</span>`
    )
    .join("");
}

function buildDateIndex(readings) {
  const dates = [...new Set(readings.map((r) => r.recorded_at.slice(0, 10)))].sort();
  return new Map(dates.map((d, i) => [d, i]));
}

export { glucoseGoal };
