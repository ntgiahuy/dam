import type { BeamProject, ExtraBar, MainBar, Span } from "./types";
import { roundTo } from "./utils";

/** Unit weight kg/m — TCVN practice d²/162.2 (matches the sample PDF). */
export function unitWeight(dia: number) {
  return (dia * dia) / 162.2;
}

/** Vertical spacing between extra-bar layers, measured from the main steel plane (mm). */
export const EXTRA_LAYER_SPACING_MM = 50;

/**
 * Offset from the main-bar plane toward mid-depth.
 * Layer 1 sits in that plane (between the two main bars).
 * Layer 2 is 50 mm inward; layer 3 is 50 mm beyond layer 2.
 */
export function extraLayerOffsetMm(layer: number) {
  const n = Math.max(1, Math.round(Number.isFinite(layer) ? layer : 1));
  return (n - 1) * EXTRA_LAYER_SPACING_MM;
}

export function hookLength(dia: number, type: number, override?: number) {
  if (override && override > 0) return override;
  if (type === 3) return Math.max(20 * dia, 200);
  return 0;
}

function supportFaces(project: BeamProject, axisIndex: number) {
  const xs = axisPositions(project.spans);
  const last = Math.max(0, xs.length - 1);
  const i = Math.max(0, Math.min(axisIndex, last));
  const axis = xs[i] ?? 0;
  const sup = project.supports[i] ?? project.supports[0];
  const { width, leftToAxis } = supportGeometry(sup?.B ?? 200, sup?.B1 ?? 100);
  const left = axis - leftToAxis;
  return { axis, left, right: left + width };
}

/**
 * Dạng đầu thanh bổ sung (theo shop dầm):
 * 0 — cắt tại tim trục
 * 1 — cắt thẳng tại mép trong gối (không vào cột)
 * 2 — neo vào gối (kéo tới mép ngoài)
 * 3 — móc 90° tại tim trục
 */
export function extraTermination(
  project: BeamProject,
  axisIndex: number,
  type: number,
  side: "left" | "right",
  dia: number,
) {
  const f = supportFaces(project, axisIndex);
  const hook = type === 3 ? hookLength(dia, 3) : 0;
  if (type === 1) return { x: side === "left" ? f.right : f.left, hook };
  if (type === 2) return { x: side === "left" ? f.left : f.right, hook };
  return { x: f.axis, hook };
}

export function axisPositions(spans: Span[]): number[] {
  const xs = [0];
  let x = 0;
  for (const s of spans) {
    x += s.L;
    xs.push(x);
  }
  return xs;
}

export function totalLength(spans: Span[]) {
  return spans.reduce((a, s) => a + s.L, 0);
}

export function typicalH(spans: Span[]) {
  return spans[0]?.H ?? 500;
}

export function typicalB(spans: Span[]) {
  return spans[0]?.B ?? 200;
}

export function typicalB1(spans: Span[]) {
  return spans[0]?.B1 ?? 100;
}

/**
 * B1 = khoảng từ mép trái gối đến tim trục (mm).
 * 0 hợp lệ: tim trùng mép trái, gối nằm bên phải trục.
 * B/2 = gối cân giữa. Không quy 0 về B/2.
 */
export function supportGeometry(B: number, B1: number) {
  const width = B > 0 ? B : 200;
  const leftToAxis = Number.isFinite(B1) ? B1 : width / 2;
  return { width, leftToAxis };
}

export interface ResolvedBar {
  sourceId: string;
  face: "top" | "bottom";
  kind: "main" | "extra";
  layer: number;
  dia: number;
  qty: number;
  x1: number;
  x2: number;
  startType: number;
  endType: number;
  hookStart: number;
  hookEnd: number;
  straight: number;
  cutLength: number;
}

export function extraBarGeometry(project: BeamProject, bar: ExtraBar, face: "top" | "bottom") {
  const xs = axisPositions(project.spans);
  const last = project.spans.length;
  const s = Math.max(0, Math.min(bar.startAxis, last));
  const e = Math.max(0, Math.min(bar.endAxis, last));
  const leftAxis = Math.min(s, e);
  const rightAxis = Math.max(s, e);
  const leftType = s <= e ? bar.startType : bar.endType;
  const rightType = s <= e ? bar.endType : bar.startType;

  let x1: number;
  let x2: number;
  let hookStart: number;
  let hookEnd: number;

  if (leftAxis === rightAxis) {
    const leftL = leftAxis > 0 ? project.spans[leftAxis - 1].L : 0;
    const rightL = leftAxis < project.spans.length ? project.spans[leftAxis].L : 0;
    const adj = leftL && rightL ? (leftL + rightL) / 3 : (leftL || rightL) / 3;
    const len = Math.max(roundTo(adj, 50), 800);
    const x = xs[leftAxis] ?? 0;
    if (leftAxis === 0) {
      x1 = x;
      x2 = x + len;
    } else if (leftAxis === last) {
      x2 = x;
      x1 = x - len;
    } else {
      x1 = x - len / 2;
      x2 = x + len / 2;
    }
    hookStart = hookLength(bar.dia, leftType);
    hookEnd = hookLength(bar.dia, rightType);
  } else {
    const leftT = extraTermination(project, leftAxis, leftType, "left", bar.dia);
    const rightT = extraTermination(project, rightAxis, rightType, "right", bar.dia);
    x1 = leftT.x;
    x2 = rightT.x;
    hookStart = leftT.hook;
    hookEnd = rightT.hook;
  }

  let startType = leftType;
  let endType = rightType;

  if (x2 < x1) {
    const t = x1;
    x1 = x2;
    x2 = t;
    const h = hookStart;
    hookStart = hookEnd;
    hookEnd = h;
    const tp = startType;
    startType = endType;
    endType = tp;
  }

  const straight = x2 - x1;
  const cutLength =
    bar.lengthOverride && bar.lengthOverride > 0 ? bar.lengthOverride : straight + hookStart + hookEnd;
  void face;
  return { x1, x2, hookStart, hookEnd, straight, cutLength, startType, endType };
}

export function extraBarLength(
  project: BeamProject,
  bar: ExtraBar,
  face: "top" | "bottom",
): number {
  return Math.round(extraBarGeometry(project, bar, face).cutLength);
}

export function resolveMainBars(
  project: BeamProject,
  bars: MainBar[],
  face: "top" | "bottom",
): ResolvedBar[] {
  const xs = axisPositions(project.spans);
  const H = typicalH(project.spans);
  return bars.map((b) => {
    const x1 = xs[Math.min(b.startAxis, xs.length - 1)] ?? 0;
    const x2 = xs[Math.min(b.endAxis, xs.length - 1)] ?? x1;
    const atStart = b.startAxis === 0;
    const atEnd = b.endAxis === project.spans.length;
    const startType = atStart ? 3 : 0;
    const endType = atEnd ? 3 : 0;
    const hook = face === "top" ? Math.round(H * 0.85) : Math.max(20 * b.dia, 400);
    const hookStart = startType ? hook : 0;
    const hookEnd = endType ? hook : 0;
    const inset = 50;
    const straight = Math.max(x2 - x1 - inset, 0);
    const cutLength = straight + hookStart + hookEnd;
    return {
      sourceId: b.id,
      face,
      kind: "main",
      layer: 1,
      dia: b.dia,
      qty: b.qty,
      x1: x1 + inset / 2,
      x2: x2 - inset / 2,
      startType,
      endType,
      hookStart,
      hookEnd,
      straight,
      cutLength,
    };
  });
}

export function resolveExtraBars(
  project: BeamProject,
  bars: ExtraBar[],
  face: "top" | "bottom",
): ResolvedBar[] {
  return bars.map((b) => {
    const g = extraBarGeometry(project, b, face);
    return {
      sourceId: b.id,
      face,
      kind: "extra" as const,
      layer: b.layer,
      dia: b.dia,
      qty: b.qty,
      x1: g.x1,
      x2: g.x2,
      startType: g.startType,
      endType: g.endType,
      hookStart: g.hookStart,
      hookEnd: g.hookEnd,
      straight: g.straight,
      cutLength: g.cutLength,
    };
  });
}

export type BarShape = "straight" | "u-top" | "u-bottom" | "stirrup" | "l-left" | "l-right";

export interface ScheduleRow {
  mark: string;
  markNum: number;
  sub?: number;
  shape: BarShape;
  segs: number[];
  dia: number;
  barLength: number;
  qtyEach: number;
  qtyTotal: number;
  totalM: number;
  weight: number;
  bars: ResolvedBar[];
}

export interface StirrupResolved {
  dia: number;
  innerB: number;
  innerH: number;
  hook: number;
  cutLength: number;
  countEach: number;
  labels: { x: number; text: string; mark: string }[];
  ticks: { x: number; dense: boolean }[];
}

export function resolveStirrups(project: BeamProject): StirrupResolved {
  const B = typicalB(project.spans);
  const H = typicalH(project.spans);
  const cover = project.info.cover || 25;
  const innerB = B - 2 * cover;
  const innerH = H - 2 * cover;
  const dia = project.stirrups[0]?.dia ?? 6;
  const hook = 50;
  const cutLength = 2 * (innerB + innerH) + 2 * hook;
  const xs = axisPositions(project.spans);
  const labels: StirrupResolved["labels"] = [];
  const ticks: StirrupResolved["ticks"] = [];
  let countEach = 0;

  project.spans.forEach((span, i) => {
    const st = project.stirrups[i] ?? project.stirrups[0];
    if (!st) return;
    const x0 = xs[i];
    const zones = [
      { z: st.left, dense: true },
      { z: st.mid, dense: false },
      { z: st.right, dense: true },
    ];
    let cursor = x0;
    for (const { z, dense } of zones) {
      countEach += z.count;
      if (z.count > 0) {
        labels.push({
          x: cursor + z.length / 2,
          text: `${z.count}Ø${st.dia}a${z.spacing}`,
          mark: "9",
        });
        const gap = z.length / Math.max(z.count, 1);
        for (let k = 0; k < z.count; k++) {
          ticks.push({ x: cursor + gap * (k + 0.5), dense });
        }
      }
      cursor += z.length;
    }
    void span;
  });

  for (const s of project.secondary) {
    if (s.shear) countEach += s.stirrupsEachSide * 2;
  }

  return { dia, innerB, innerH, hook, cutLength, countEach, labels, ticks };
}

function shapeFamily(bar: ResolvedBar) {
  const hs = bar.hookStart > 0;
  const he = bar.hookEnd > 0;
  if (hs && he) return "u";
  if (hs || he) return "l";
  return "s";
}

function groupKey(bar: ResolvedBar) {
  const len = Math.round(bar.cutLength / 10) * 10;
  return `${bar.face}|${bar.kind}|${bar.dia}|${len}|${shapeFamily(bar)}|${bar.layer}`;
}

export interface ComputedModel {
  xs: number[];
  total: number;
  H: number;
  B: number;
  B1: number;
  mainBottom: ResolvedBar[];
  extraBottom: ResolvedBar[];
  mainTop: ResolvedBar[];
  extraTop: ResolvedBar[];
  stirrups: StirrupResolved;
  schedule: ScheduleRow[];
  byDia: { dia: number; weight: number }[];
  totalWeight: number;
}

export function computeModel(project: BeamProject): ComputedModel {
  const xs = axisPositions(project.spans);
  const total = totalLength(project.spans);
  const H = typicalH(project.spans);
  const B = typicalB(project.spans);
  const B1 = typicalB1(project.spans);
  const mainBottom = resolveMainBars(project, project.mainBottom, "bottom");
  const extraBottom = resolveExtraBars(project, project.extraBottom, "bottom");
  const mainTop = resolveMainBars(project, project.mainTop, "top");
  const extraTop = resolveExtraBars(project, project.extraTop, "top");
  const stirrups = resolveStirrups(project);
  const sl = Math.max(1, project.info.quantity);

  const schedule: ScheduleRow[] = [];
  let mark = 1;

  const pushGroup = (
    bars: ResolvedBar[],
    shapeFor: (b: ResolvedBar) => BarShape,
  ) => {
    const map = new Map<string, ResolvedBar[]>();
    for (const b of bars) {
      const k = groupKey(b);
      const arr = map.get(k) ?? [];
      arr.push(b);
      map.set(k, arr);
    }
    const groups = [...map.values()].sort((a, b) => a[0].x1 - b[0].x1);
    for (const g of groups) {
      const b = g[0];
      const qtyEach = g.reduce((s, x) => s + x.qty, 0);
      const qtyTotal = qtyEach * sl;
      const barLength = Math.round(b.cutLength);
      const totalM = (barLength * qtyTotal) / 1000;
      const weight = totalM * unitWeight(b.dia);
      const shape = shapeFor(b);
      const segs =
        shape === "u-top" || shape === "u-bottom"
          ? [b.hookStart || b.hookEnd, Math.round(b.straight), b.hookEnd || b.hookStart]
          : shape === "l-left"
            ? [b.hookStart, Math.round(b.straight)]
            : shape === "l-right"
              ? [Math.round(b.straight), b.hookEnd]
              : [Math.round(b.straight)];
      if (b.kind === "main" && b.qty > 1) {
        for (let i = 0; i < b.qty; i++) {
          schedule.push({
            mark: i === 0 ? String(mark) : `${mark}.${i + 1}`,
            markNum: mark,
            sub: i + 1,
            shape,
            segs,
            dia: b.dia,
            barLength,
            qtyEach: i === 0 ? qtyEach : 0,
            qtyTotal: i === 0 ? qtyTotal : 0,
            totalM: i === 0 ? totalM : 0,
            weight: i === 0 ? weight : 0,
            bars: g,
          });
        }
        // Keep one row in the table for the group; shop drawing uses .1 .2 .3
        // Filter later for table vs shop
      } else {
        schedule.push({
          mark: String(mark),
          markNum: mark,
          shape,
          segs,
          dia: b.dia,
          barLength,
          qtyEach,
          qtyTotal,
          totalM,
          weight,
          bars: g,
        });
      }
      mark += 1;
    }
  };

  pushGroup(mainBottom, (b) =>
    b.hookStart && b.hookEnd ? "u-bottom" : b.hookStart ? "l-left" : b.hookEnd ? "l-right" : "straight",
  );
  pushGroup(extraBottom, (b) =>
    b.hookStart && b.hookEnd ? "u-bottom" : b.hookStart ? "l-left" : b.hookEnd ? "l-right" : "straight",
  );
  pushGroup(mainTop, (b) =>
    b.hookStart && b.hookEnd ? "u-top" : b.hookStart ? "l-left" : b.hookEnd ? "l-right" : "straight",
  );
  pushGroup(extraTop, (b) =>
    b.hookStart && b.hookEnd ? "u-bottom" : b.hookStart ? "l-left" : b.hookEnd ? "l-right" : "straight",
  );

  // Collapse main-bar sub-rows for the TABLE: keep first of each markNum with qty
  const tableRows: ScheduleRow[] = [];
  const seen = new Set<number>();
  for (const r of schedule) {
    if (r.sub && r.sub > 1) continue;
    if (seen.has(r.markNum)) continue;
    seen.add(r.markNum);
    tableRows.push({ ...r, mark: String(r.markNum) });
  }

  if (stirrups.countEach > 0) {
    const stirrupRow: ScheduleRow = {
      mark: String(mark),
      markNum: mark,
      shape: "stirrup",
      segs: [stirrups.innerB, stirrups.innerH, stirrups.hook],
      dia: stirrups.dia,
      barLength: stirrups.cutLength,
      qtyEach: stirrups.countEach,
      qtyTotal: stirrups.countEach * sl,
      totalM: (stirrups.cutLength * stirrups.countEach * sl) / 1000,
      weight: ((stirrups.cutLength * stirrups.countEach * sl) / 1000) * unitWeight(stirrups.dia),
      bars: [],
    };
    tableRows.push(stirrupRow);
  }

  const byDiaMap = new Map<number, number>();
  for (const r of tableRows) {
    byDiaMap.set(r.dia, (byDiaMap.get(r.dia) ?? 0) + r.weight);
  }
  const byDia = [...byDiaMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dia, weight]) => ({ dia, weight }));

  return {
    xs,
    total,
    H,
    B,
    B1,
    mainBottom,
    extraBottom,
    mainTop,
    extraTop,
    stirrups,
    schedule: tableRows,
    byDia,
    totalWeight: byDia.reduce((s, x) => s + x.weight, 0),
  };
}

export function supportWidthLabel(project: BeamProject, i: number) {
  const sup = project.supports[i];
  const B = sup?.B ?? 200;
  if (i === 0 || i === project.spans.length) return String(B);
  const b1 = project.spans[Math.min(i, project.spans.length - 1)]?.B1 ?? 100;
  return `${b1}${b1}`;
}

export function barNotation(qty: number, dia: number) {
  return `${qty}Ø${dia}`;
}

/** Dịch nguyên đoạn trục bắt đầu → kết thúc, giữ nguyên độ dài, kẹp trong [0, lastAxis]. */
export function shiftAxisRange(start: number, end: number, delta: number, lastAxis: number) {
  const last = Math.max(0, lastAxis);
  let a = start + delta;
  let b = end + delta;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let fix = 0;
  if (lo < 0) fix = -lo;
  if (hi + fix > last) fix = last - hi;
  if (lo + fix < 0) fix = -lo;
  a = Math.max(0, Math.min(last, a + fix));
  b = Math.max(0, Math.min(last, b + fix));
  return { startAxis: a, endAxis: b };
}

export function placeAxisRange(start: number, end: number, newStart: number, lastAxis: number) {
  return shiftAxisRange(start, end, newStart - Math.min(start, end), lastAxis);
}

export function canShiftAxisRange(start: number, end: number, delta: number, lastAxis: number) {
  const next = shiftAxisRange(start, end, delta, lastAxis);
  return next.startAxis !== start || next.endAxis !== end;
}

/** B / B1 trên tab nhịp và tab gối là cùng một số liệu — ghi vào cả hai. */
export function syncSpanSupportGeometry(
  project: BeamProject,
  spanIndex: number,
  supportIndex: number,
  patch: { B?: number; B1?: number },
): BeamProject {
  const hasB = patch.B !== undefined;
  const hasB1 = patch.B1 !== undefined;
  if (!hasB && !hasB1) return project;
  const geo = {
    ...(hasB ? { B: patch.B as number } : {}),
    ...(hasB1 ? { B1: patch.B1 as number } : {}),
  };
  const spanIdx = Math.max(0, Math.min(spanIndex, project.spans.length - 1));
  const supIdx = Math.max(0, Math.min(supportIndex, project.supports.length - 1));
  return {
    ...project,
    spans: project.spans.map((s, i) => (i === spanIdx ? { ...s, ...geo } : s)),
    supports: project.supports.map((s, i) => (i === supIdx ? { ...s, ...geo } : s)),
  };
}

export function applySpanParams(project: BeamProject, fromIndex: number, fields: (keyof Span)[]): BeamProject {
  const src = project.spans[fromIndex];
  if (!src) return project;
  let next: BeamProject = {
    ...project,
    spans: project.spans.map((s, i) => {
      if (i === fromIndex) return s;
      const copy = { ...s };
      for (const f of fields) {
        // @ts-expect-error indexed assign
        copy[f] = src[f];
      }
      return copy;
    }),
    stirrups: project.stirrups.map((st, i) => {
      if (i === fromIndex) return st;
      if (fields.includes("L") && project.spans[i]) {
        const ratio = src.L / Math.max(project.spans[i].L, 1);
        void ratio;
      }
      return st;
    }),
  };
  if (fields.includes("B") || fields.includes("B1")) {
    next = {
      ...next,
      supports: next.supports.map((s) => ({
        ...s,
        ...(fields.includes("B") ? { B: src.B } : {}),
        ...(fields.includes("B1") ? { B1: src.B1 } : {}),
      })),
    };
  }
  return next;
}

export function applySupportToAll(project: BeamProject, fromIndex: number): BeamProject {
  const src = project.supports[fromIndex];
  if (!src) return project;
  return {
    ...project,
    supports: project.supports.map((s, i) =>
      i === fromIndex ? s : { ...s, type: src.type, B: src.B, B1: src.B1, H: src.H },
    ),
    spans: project.spans.map((s) => ({ ...s, B: src.B, B1: src.B1 })),
  };
}
