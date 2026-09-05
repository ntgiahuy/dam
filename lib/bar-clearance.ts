import type { BeamProject } from "./types";

/** Shop cột: khoảng hở tịnh 2 thanh chủ kề nhau ≥ 25 mm. */
export const MIN_MAIN_CLEAR_BOTTOM_MM = 25;
/** Lớp trên dầm: ≥ 50 mm (cùng cách tính khoảng hở của shop cột). */
export const MIN_MAIN_CLEAR_TOP_MM = 50;

export function minMainClearMm(face: "top" | "bottom") {
  return face === "top" ? MIN_MAIN_CLEAR_TOP_MM : MIN_MAIN_CLEAR_BOTTOM_MM;
}

/** Cạnh trong đai = B − 2 lớp bảo vệ (shop cột `stirrupInner`). */
export function stirrupInnerBmm(B: number, cover: number) {
  return Math.max((Number(B) || 0) - 2 * (Number(cover) || 25), 40);
}

/** Khoảng hở tịnh giữa 2 thanh kề (shop cột `barClearGapMm`). */
export function barClearGapMm(innerSpan: number, bars: number, dia: number) {
  const n = Math.max(0, Math.round(Number(bars) || 0));
  const d = Math.max(0, Number(dia) || 0);
  if (n <= 1) return innerSpan;
  return (innerSpan - n * d) / (n - 1);
}

export function formatClearMm(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export type MainBarClearance = {
  face: "top" | "bottom";
  innerB: number;
  B: number;
  qty: number;
  dia: number;
  gap: number;
  min: number;
  ok: boolean;
};

export function mainBarClearance(
  B: number,
  cover: number,
  qty: number,
  dia: number,
  face: "top" | "bottom",
): MainBarClearance {
  const innerB = stirrupInnerBmm(B, cover);
  const n = Math.max(0, Math.round(Number(qty) || 0));
  const d = Math.max(0, Number(dia) || 0);
  const min = minMainClearMm(face);
  const gap = barClearGapMm(innerB, n, d);
  return {
    face,
    innerB,
    B,
    qty: n,
    dia: d,
    gap,
    min,
    ok: n <= 1 || gap + 1e-9 >= min,
  };
}

function coversSpanForClearance(
  startAxis: number,
  endAxis: number,
  spanIndex: number,
  face: "top" | "bottom",
) {
  const a = Math.min(startAxis, endAxis);
  const e = Math.max(startAxis, endAxis);
  if (face === "bottom") return a <= spanIndex && e >= spanIndex + 1;
  if (a === e) return a === spanIndex || a === spanIndex + 1;
  return a <= spanIndex && e >= spanIndex;
}

export function narrowestBForBar(
  project: BeamProject,
  startAxis: number,
  endAxis: number,
  face: "top" | "bottom",
) {
  let minB = Infinity;
  for (let i = 0; i < project.spans.length; i++) {
    if (!coversSpanForClearance(startAxis, endAxis, i, face)) continue;
    const B = project.spans[i]?.B;
    if (Number.isFinite(B) && (B as number) < minB) minB = B as number;
  }
  if (!Number.isFinite(minB)) minB = project.spans[0]?.B ?? 200;
  return minB;
}

export function mainBarClearanceFor(
  project: BeamProject,
  bar: { qty: number; dia: number; startAxis: number; endAxis: number },
  face: "top" | "bottom",
) {
  const B = narrowestBForBar(project, bar.startAxis, bar.endAxis, face);
  return mainBarClearance(B, project.info.cover || 25, bar.qty, bar.dia, face);
}

export function mainLayerClearanceOk(project: BeamProject, face: "top" | "bottom") {
  const bars = face === "top" ? project.mainTop : project.mainBottom;
  if (!bars.length) return true;
  return bars.every((b) => mainBarClearanceFor(project, b, face).ok);
}

export function describeMainBarClearance(info: MainBarClearance) {
  const layer = info.face === "top" ? "lớp trên" : "lớp dưới";
  const base = `B trong đai ${Math.round(info.innerB)} mm − ${info.qty}Ø${info.dia} → khoảng hở ${formatClearMm(info.gap)} mm`;
  if (info.ok) return `${base} (≥ ${info.min} mm ${layer}).`;
  return `${base} — nhỏ hơn ${info.min} mm (${layer}). Tăng B dầm hoặc giảm số thanh / Ø.`;
}
