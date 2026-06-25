import { jsPDF } from "jspdf";
import { formatDateTime, glucoseTypeLabel, classifyBloodPressure, isGlucoseInRange } from "./config.js";
import { exportAllData } from "./storage.js";

export async function downloadJsonExport() {
  const data = await exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `salud-monitor-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function generateMedicalPdf({ profile, glucose, blood_pressure }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;

  doc.setFontSize(16);
  doc.text("Reporte Médico — Salud Monitor", margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Paciente: ${profile.patient_name}`, margin, y);
  y += 5;
  doc.text(`Generado: ${new Date().toLocaleString("es-MX")}`, margin, y);
  y += 5;
  doc.text("Seguimiento personal. No sustituye evaluación clínica.", margin, y);
  y += 10;
  doc.setTextColor(0);

  const cutoff = Date.now() - 30 * 86400000;
  const g30 = glucose.filter((r) => new Date(r.recorded_at).getTime() >= cutoff);
  const bp30 = blood_pressure.filter((r) => new Date(r.recorded_at).getTime() >= cutoff);

  y = sectionHeader(doc, "Glucosa (últimos 30 días)", margin, y);
  y = tableHeader(doc, margin, y, ["Fecha", "Tipo", "mg/dL"]);
  if (!g30.length) {
    y = tableRow(doc, margin, y, ["—", "Sin registros", "—"]);
  } else {
    for (const r of g30.slice(0, 40)) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      const inRange = isGlucoseInRange(r, profile.goals);
      y = tableRow(
        doc,
        margin,
        y,
        [formatDateTime(r.recorded_at), glucoseTypeLabel(r), String(r.value_mg_dl)],
        { highlightCols: inRange ? [] : [2] }
      );
    }
  }

  y += 6;
  if (y > 250) {
    doc.addPage();
    y = margin;
  }
  y = sectionHeader(doc, "Presión arterial (últimos 30 días)", margin, y);
  y = tableHeader(doc, margin, y, ["Fecha", "Clasificación", "mmHg"]);
  if (!bp30.length) {
    y = tableRow(doc, margin, y, ["—", "Sin registros", "—"]);
  } else {
    for (const r of bp30.slice(0, 40)) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      const c = classifyBloodPressure(r.systolic, r.diastolic);
      const inRange = c.className === "bp-normal";
      y = tableRow(
        doc,
        margin,
        y,
        [formatDateTime(r.recorded_at), c.label, `${r.systolic}/${r.diastolic}`],
        { highlightCols: inRange ? [] : [1, 2] }
      );
    }
  }

  y += 8;
  if (y > 260) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    `Metas glucosa: ayunas ≤${profile.goals.fasting}, pre-comida ≤${profile.goals.pre_meal}, post 1h ≤${profile.goals.post_1h}, post 2h ≤${profile.goals.post_2h} mg/dL`,
    margin,
    y
  );

  doc.save(`reporte-salud-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function sectionHeader(doc, title, margin, y) {
  doc.setFontSize(12);
  doc.setTextColor(168, 85, 247);
  doc.text(title, margin, y);
  doc.setTextColor(0);
  return y + 7;
}

function tableHeader(doc, margin, y, cols) {
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  doc.text(cols[0], margin, y);
  doc.text(cols[1], margin + 55, y);
  doc.text(cols[2], margin + 130, y);
  doc.setFont(undefined, "normal");
  return y + 5;
}

const PDF_RED = [220, 38, 38];

function tableRow(doc, margin, y, cols, { highlightCols = [] } = {}) {
  doc.setFontSize(8);
  const positions = [margin, margin + 55, margin + 130];
  const widths = [50, 70, null];
  cols.forEach((col, i) => {
    doc.setTextColor(...(highlightCols.includes(i) ? PDF_RED : [0, 0, 0]));
    const opts = widths[i] ? { maxWidth: widths[i] } : undefined;
    doc.text(String(col), positions[i], y, opts);
  });
  doc.setTextColor(0);
  return y + 5;
}

export async function downloadPdfReport() {
  const data = await exportAllData();
  await generateMedicalPdf(data);
}
