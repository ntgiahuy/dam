import type { BeamProject, ExtraBar, MainBar, Span } from "./types";
import { roundTo } from "./utils";
import { hook90ExtensionMm } from "./tcvn5574";

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
  if (type === 4) return hook90ExtensionMm(dia);
  return 0;
}

export function adjacentSpanLength(project: BeamProject, axisIndex: number, side: "left" | "right") {
  if (side === "left") {
    return project.spans[axisIndex]?.L ?? project.spans[axisIndex - 1]?.L ?? 0;
  }
  return project.spans[axisIndex - 1]?.L ?? project.spans[axisIndex]?.L ?? 0;
}

/** Nhịp kề gối theo phía cắt: trái = spans[axis], phải = spans[axis-1]. */
export function adjacentSpanIndex(
  project: BeamProject,
  axisIndex: number,
  side: "left" | "right",
): number | null {
  if (side === "left") {
    return axisIndex >= 0 && axisIndex < project.spans.length ? axisIndex : null;
  }
  return axisIndex > 0 && axisIndex <= project.spans.length ? axisIndex - 1 : null;
}

/** l₀ — nhịp thông thủy giữa hai mép trong gối (mm). */
export function clearSpanMm(project: BeamProject, spanIndex: number) {
  if (spanIndex < 0 || spanIndex >= project.spans.length) return 0;
  const left = supportFaces(project, spanIndex);
  const right = supportFaces(project, spanIndex + 1);
  return Math.max(0, right.left - left.right);
}

/**
 * h₀ — chiều cao làm việc tiết diện (mm).
 * a = lớp bảo vệ + đai + d/2 thanh đang xét.
 */
export function effectiveDepthMm(project: BeamProject, spanIndex: number, barDia: number) {
  const span = project.spans[spanIndex] ?? project.spans[0];
  const H = span?.H ?? 500;
  const cover = project.info.cover || 25;
  const stirrup = project.stirrups[spanIndex]?.dia ?? project.stirrups[0]?.dia ?? 8;
  const ds = Math.max(barDia || 1, 1);
  return Math.max(H - cover - stirrup - ds / 2, ds);
}

/** max(h₀, 15d, l₀/16) — đoạn neo cắt thép M+ giữa nhịp. */
export function saggingExtraAnchorMm(l0: number, h0: number, dia: number) {
  const ds = Math.max(dia || 1, 1);
  return Math.max(h0, 15 * ds, l0 / 16);
}

/**
 * Chiều dài thép bổ sung M+ giữa nhịp, lớp dưới:
 * l₀/2 + 2·max(h₀, 15d, l₀/16)
 * Shop: dư 50 mm mỗi đầu rồi làm tròn 50 mm (khớp bản vẽ sxCAD: 6141→6250, 6281→6400).
 */
export function saggingExtraLengthRawMm(l0: number, h0: number, dia: number) {
  return l0 / 2 + 2 * saggingExtraAnchorMm(l0, h0, dia);
}

export function saggingExtraLengthMm(l0: number, h0: number, dia: number) {
  if (!(l0 > 0)) return 0;
  const raw = saggingExtraLengthRawMm(l0, h0, dia);
  const shop = roundTo(raw + 100, 50);
  return Math.max(0, Math.min(shop, l0));
}

/**
 * Khoảng từ mép trong gối vào nhịp. Hai đầu dạng 1 cho ra đúng saggingExtraLengthMm.
 */
export function saggingExtraInsetMm(l0: number, h0: number, dia: number) {
  const len = saggingExtraLengthMm(l0, h0, dia);
  return Math.max((l0 - Math.min(len, l0)) / 2, 0);
}

/**
 * Đoạn kéo vào nhịp của thép bổ sung M- tại gối, lớp trên.
 * l₀/4, làm tròn 50 mm (9825 → 2456 → 2450).
 */
export function hoggingExtraExtensionMm(l0: number) {
  if (!(l0 > 0)) return 0;
  return roundTo(l0 / 4, 50);
}

/** Lớp bảo vệ đầu biên dầm — lùi 50 mm từ mỗi mép ngoài bê tông. */
export const BEAM_END_COVER_MM = 50;

/**
 * Móc đứng M- gối biên = 2/3 H dầm, làm tròn 50 mm.
 * H=500 → 333 → 350 mm.
 */
export function hoggingEdgeHookMm(H: number) {
  return roundTo((Math.max(H || 500, 1) * 2) / 3, 50);
}

function beamEndCoverStartX(project: BeamProject) {
  return supportFaces(project, 0).left + BEAM_END_COVER_MM;
}

function beamEndCoverEndX(project: BeamProject) {
  return supportFaces(project, project.spans.length).right - BEAM_END_COVER_MM;
}

/** M- gối biên: móc tại tim nếu tim đã cách mép ngoài ≥ 50 mm (khớp shop 2450). */
function hoggingEdgeStartX(project: BeamProject) {
  const f = supportFaces(project, 0);
  return Math.max(f.axis, f.left + BEAM_END_COVER_MM);
}

function hoggingEdgeEndX(project: BeamProject) {
  const f = supportFaces(project, project.spans.length);
  return Math.min(f.axis, f.right - BEAM_END_COVER_MM);
}

function hoggingBarAtSupport(
  project: BeamProject,
  axisIndex: number,
  leftType: number,
  rightType: number,
) {
  const f = supportFaces(project, axisIndex);
  const last = project.spans.length;
  const span = project.spans[axisIndex] ?? project.spans[axisIndex - 1] ?? project.spans[0];
  const hook = hoggingEdgeHookMm(span?.H ?? typicalH(project.spans));

  const endX = (type: number, side: "left" | "right") => {
    if (type === 1) {
      const si =
        side === "left"
          ? axisIndex > 0
            ? axisIndex - 1
            : null
          : axisIndex < project.spans.length
            ? axisIndex
            : null;
      const l0 = si != null ? clearSpanMm(project, si) : 0;
      const ext = hoggingExtraExtensionMm(l0);
      return side === "left" ? f.left - ext : f.right + ext;
    }
    return f.axis;
  };

  let x1 = endX(leftType, "left");
  let x2 = endX(rightType, "right");
  let hookStart = 0;
  let hookEnd = 0;
  if (axisIndex === 0) {
    const l0 = clearSpanMm(project, 0);
    const ext = hoggingExtraExtensionMm(l0);
    x1 = hoggingEdgeStartX(project);
    x2 = x1 + ext;
    hookStart = hook;
  }
  if (axisIndex === last) {
    const l0 = clearSpanMm(project, last - 1);
    const ext = hoggingExtraExtensionMm(l0);
    x2 = hoggingEdgeEndX(project);
    x1 = x2 - ext;
    hookEnd = hook;
  }
  if (x2 <= x1) {
    hookStart = 0;
    hookEnd = 0;
  }
  return { x1, x2, hookStart, hookEnd };
}

/**
 * Dạng đầu thanh bổ sung:
 * 1 — lớp trên: M- tại gối, từ mép trong kéo vào nhịp l₀/4
 *     lớp dưới: M+ giữa nhịp, l₀/2 + 2·max(h₀, 15d, l₀/16)
 * 2 — lớp trên: M- tại gối, tới tim cột
 *     lớp dưới: cắt thẳng tại mép trong gối
 * 3 — cắt thẳng tại tim cột
 * 4 — móc 90° tại tim cột (đuôi theo TCVN 5574:2018)
 */
export function extraTermination(
  project: BeamProject,
  axisIndex: number,
  type: number,
  side: "left" | "right",
  dia: number,
  face: "top" | "bottom" = "top",
) {
  const f = supportFaces(project, axisIndex);
  const inner = side === "left" ? f.right : f.left;
  const intoSpan = side === "left" ? 1 : -1;

  if (type === 1) {
    if (face === "bottom") {
      const si = adjacentSpanIndex(project, axisIndex, side);
      if (si != null) {
        const l0 = clearSpanMm(project, si);
        if (l0 > 0) {
          const h0 = effectiveDepthMm(project, si, dia);
          const off = saggingExtraInsetMm(l0, h0, dia);
          return { x: inner + intoSpan * off, hook: 0 };
        }
      }
    } else {
      const si = adjacentSpanIndex(project, axisIndex, side);
      if (si != null) {
        const l0 = clearSpanMm(project, si);
        if (l0 > 0) {
          const off = hoggingExtraExtensionMm(l0);
          return { x: inner + intoSpan * off, hook: 0 };
        }
      }
    }
    const off = roundTo(adjacentSpanLength(project, axisIndex, side) / 8, 10);
    return { x: inner + intoSpan * Math.max(off, 0), hook: 0 };
  }
  if (type === 2) {
    if (face === "top") return { x: f.axis, hook: 0 };
    return { x: inner, hook: 0 };
  }
  if (type === 4) {
    const last = project.spans.length;
    if (axisIndex === 0 && side === "left") {
      return { x: beamEndCoverStartX(project), hook: hook90ExtensionMm(dia) };
    }
    if (axisIndex === last && side === "right") {
      return { x: beamEndCoverEndX(project), hook: hook90ExtensionMm(dia) };
    }
    return { x: f.axis, hook: hook90ExtensionMm(dia) };
  }
  return { x: f.axis, hook: 0 };
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

function normalizeEndType(t: number) {
  if (t === 1 || t === 2 || t === 3 || t === 4) return t;
  if (t === 0) return 3;
  return 2;
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
  const leftRaw = normalizeEndType(s <= e ? bar.startType : bar.endType);
  const rightRaw = normalizeEndType(s <= e ? bar.endType : bar.startType);
  const leftType = face === "top" ? (leftRaw === 1 ? 1 : 2) : leftRaw;
  const rightType = face === "top" ? (rightRaw === 1 ? 1 : 2) : rightRaw;

  let x1: number;
  let x2: number;
  let hookStart: number;
  let hookEnd: number;

  if (leftAxis === rightAxis) {
    if (face === "top") {
      const g = hoggingBarAtSupport(project, leftAxis, leftType, rightType);
      x1 = g.x1;
      x2 = g.x2;
      hookStart = g.hookStart;
      hookEnd = g.hookEnd;
    } else {
      const leftL = leftAxis > 0 ? project.spans[leftAxis - 1].L : 0;
      const rightL = leftAxis < project.spans.length ? project.spans[leftAxis].L : 0;
      const adj = leftL && rightL ? (leftL + rightL) / 3 : (leftL || rightL) / 3;
      const len = Math.max(roundTo(adj, 50), 800);
      const x = xs[leftAxis] ?? 0;
      if (leftAxis === 0) {
        x1 = beamEndCoverStartX(project);
        x2 = x + len;
      } else if (leftAxis === last) {
        x2 = beamEndCoverEndX(project);
        x1 = x - len;
      } else {
        x1 = x - len / 2;
        x2 = x + len / 2;
      }
      hookStart = hookLength(bar.dia, leftType);
      hookEnd = hookLength(bar.dia, rightType);
    }
  } else if (face === "top" && rightAxis === leftAxis + 1) {
    const leftAnchored = leftType === 2;
    const rightAnchored = rightType === 2;
    if (leftAnchored && rightType === 1 && !rightAnchored) {
      const g = hoggingBarAtSupport(project, leftAxis, leftType, 1);
      x1 = g.x1;
      x2 = g.x2;
      hookStart = g.hookStart;
      hookEnd = g.hookEnd;
    } else if (rightAnchored && leftType === 1 && !leftAnchored) {
      const g = hoggingBarAtSupport(project, rightAxis, 1, rightType);
      x1 = g.x1;
      x2 = g.x2;
      hookStart = g.hookStart;
      hookEnd = g.hookEnd;
    } else {
      const leftT = extraTermination(project, leftAxis, leftType, "left", bar.dia, face);
      const rightT = extraTermination(project, rightAxis, rightType, "right", bar.dia, face);
      x1 = leftT.x;
      x2 = rightT.x;
      hookStart = leftT.hook;
      hookEnd = rightT.hook;
    }
  } else {
    const leftT = extraTermination(project, leftAxis, leftType, "left", bar.dia, face);
    const rightT = extraTermination(project, rightAxis, rightType, "right", bar.dia, face);
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

  if (face === "top") {
    const first = supportFaces(project, 0);
    const lastF = supportFaces(project, last);
    const Hs = project.spans[0]?.H ?? 500;
    const He = project.spans[Math.max(0, last - 1)]?.H ?? Hs;
    if (leftAxis === 0 && x1 <= first.right + 0.5) {
      const start = hoggingEdgeStartX(project);
      const ext = hoggingExtraExtensionMm(clearSpanMm(project, 0));
      hookStart = hoggingEdgeHookMm(Hs);
      if (rightAxis === leftAxis) {
        x1 = start;
        x2 = start + ext;
      } else {
        x1 = start;
      }
    }
    if (rightAxis === last && x2 >= lastF.left - 0.5) {
      const end = hoggingEdgeEndX(project);
      const ext = hoggingExtraExtensionMm(clearSpanMm(project, Math.max(0, last - 1)));
      hookEnd = hoggingEdgeHookMm(He);
      if (rightAxis === leftAxis) {
        x2 = end;
        x1 = end - ext;
      } else {
        x2 = end;
      }
    }
  }

  const straight = x2 - x1;
  const cutLength = straight + hookStart + hookEnd;
  return { x1, x2, hookStart, hookEnd, straight, cutLength, startType, endType };
}

export function extraBarLength(
  project: BeamProject,
  bar: ExtraBar,
  face: "top" | "bottom",
): number {
  const rs = resolveExtraBars(project, [bar], face);
  return Math.round(rs.reduce((s, b) => s + b.cutLength, 0));
}

export function extraBarLengthHint(
  project: BeamProject,
  bar: ExtraBar,
  face: "top" | "bottom",
) {
  const rs = resolveExtraBars(project, [bar], face);
  if (rs.length === 0) return "L≈0";
  return `L≈${rs.map((b) => Math.round(b.cutLength)).join("+")}`;
}

export function resolveMainBars(
  project: BeamProject,
  bars: MainBar[],
  face: "top" | "bottom",
): ResolvedBar[] {
  const xs = axisPositions(project.spans);
  const H = typicalH(project.spans);
  const last = project.spans.length;
  return bars.map((b) => {
    let x1 = xs[Math.min(b.startAxis, xs.length - 1)] ?? 0;
    let x2 = xs[Math.min(b.endAxis, xs.length - 1)] ?? x1;
    const atStart = b.startAxis === 0;
    const atEnd = b.endAxis === last;
    const startType = atStart ? 3 : 0;
    const endType = atEnd ? 3 : 0;
    const hook = face === "top" ? hoggingEdgeHookMm(H) : Math.max(20 * b.dia, 400);
    const hookStart = startType ? hook : 0;
    const hookEnd = endType ? hook : 0;
    if (atStart) x1 = beamEndCoverStartX(project);
    if (atEnd) x2 = beamEndCoverEndX(project);
    const straight = Math.max(x2 - x1, 0);
    const cutLength = straight + hookStart + hookEnd;
    return {
      sourceId: b.id,
      face,
      kind: "main",
      layer: 1,
      dia: b.dia,
      qty: b.qty,
      x1,
      x2,
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
  return bars.flatMap((b) => {
    if (face === "top") {
      const last = project.spans.length;
      const s = Math.max(0, Math.min(b.startAxis, last));
      const e = Math.max(0, Math.min(b.endAxis, last));
      const leftAxis = Math.min(s, e);
      const rightAxis = Math.max(s, e);
      const leftType = normalizeEndType(s <= e ? b.startType : b.endType);
      const rightType = normalizeEndType(s <= e ? b.endType : b.startType);
      if (leftAxis !== rightAxis && leftType === 1 && rightType === 1) {
        const out: ResolvedBar[] = [];
        for (let axis = leftAxis; axis <= rightAxis; axis++) {
          const g = extraBarGeometry(
            project,
            { ...b, startAxis: axis, endAxis: axis, startType: 1, endType: 1 },
            "top",
          );
          out.push({
            sourceId: b.id,
            face,
            kind: "extra",
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
          });
        }
        return out;
      }
    }
    const g = extraBarGeometry(project, b, face);
    return [
      {
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
      },
    ];
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
