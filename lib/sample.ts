import type { BeamProject, Span, SpanStirrups, Support } from "./types";
import { uid } from "./utils";

function span(partial: Partial<Span> & Pick<Span, "L">): Span {
  return {
    id: uid("span"),
    H: 500,
    B: 200,
    B1: 100,
    dH: 0,
    slabType: 3,
    Hsl: 0,
    Hl: 0,
    Hsr: 120,
    Hr: 0,
    ...partial,
  };
}

function support(i: number, n: number): Support {
  const end = i === 0 || i === n;
  return {
    id: uid("sup"),
    type: "cot",
    B: 200,
    B1: end ? 0 : 0,
    H: 0,
    axisName: String(i),
  };
}

function stirrup(L: number, left: number, mid: number, right: number, cL: number, cM: number, cR: number): SpanStirrups {
  return {
    dia: 6,
    left: { count: cL, spacing: 150, length: left },
    mid: { count: cM, spacing: 200, length: mid },
    right: { count: cR, spacing: 150, length: right },
  };
}

export function createEmptyProject(): BeamProject {
  const spans = [span({ L: 4000 })];
  return {
    info: {
      name: "D1",
      quantity: 1,
      elevation: 0,
      axisName: "",
      cover: 25,
    },
    spans,
    supports: [support(0, 1), support(1, 1)],
    mainBottom: [{ id: uid("mb"), dia: 18, qty: 2, startAxis: 0, endAxis: 1 }],
    extraBottom: [],
    mainTop: [{ id: uid("mt"), dia: 18, qty: 2, startAxis: 0, endAxis: 1 }],
    extraTop: [],
    stirrups: [stirrup(4000, 1400, 1200, 1400, 8, 6, 8)],
    secondary: [],
  };
}

/** Sample matching the provided shop-drawing PDF (dầm D1, 5 nhịp). */
export function createSampleD1(): BeamProject {
  const Ls = [4250, 4250, 5000, 4250, 4250];
  const spans = Ls.map((L) => span({ L }));
  const supports = Array.from({ length: 6 }, (_, i) => support(i, 5));

  return {
    info: {
      name: "D1",
      quantity: 2,
      elevation: 0,
      axisName: "",
      cover: 25,
    },
    spans,
    supports,
    mainBottom: [{ id: uid("mb"), dia: 18, qty: 3, startAxis: 0, endAxis: 5 }],
    extraBottom: [
      { id: uid("eb"), layer: 2, dia: 20, qty: 2, startAxis: 0, endAxis: 1, startType: 0, endType: 0, lengthOverride: 2950 },
      { id: uid("eb"), layer: 2, dia: 20, qty: 2, startAxis: 1, endAxis: 2, startType: 0, endType: 0, lengthOverride: 3050 },
      { id: uid("eb"), layer: 2, dia: 20, qty: 2, startAxis: 2, endAxis: 3, startType: 0, endType: 0, lengthOverride: 3600 },
      { id: uid("eb"), layer: 2, dia: 20, qty: 2, startAxis: 3, endAxis: 4, startType: 0, endType: 0, lengthOverride: 3050 },
      { id: uid("eb"), layer: 2, dia: 20, qty: 2, startAxis: 4, endAxis: 5, startType: 0, endType: 0, lengthOverride: 2950 },
    ],
    mainTop: [{ id: uid("mt"), dia: 18, qty: 3, startAxis: 0, endAxis: 5 }],
    extraTop: [
      { id: uid("et"), layer: 2, dia: 20, qty: 2, startAxis: 0, endAxis: 0, startType: 1, endType: 0, lengthOverride: 1450 },
      { id: uid("et"), layer: 2, dia: 20, qty: 2, startAxis: 1, endAxis: 1, startType: 0, endType: 0, lengthOverride: 2850 },
      { id: uid("et"), layer: 2, dia: 20, qty: 2, startAxis: 2, endAxis: 2, startType: 0, endType: 0, lengthOverride: 3150 },
      { id: uid("et"), layer: 2, dia: 20, qty: 2, startAxis: 3, endAxis: 3, startType: 0, endType: 0, lengthOverride: 3150 },
      { id: uid("et"), layer: 2, dia: 20, qty: 2, startAxis: 4, endAxis: 4, startType: 0, endType: 0, lengthOverride: 2850 },
      { id: uid("et"), layer: 2, dia: 20, qty: 2, startAxis: 5, endAxis: 5, startType: 0, endType: 1, lengthOverride: 1450 },
    ],
    stirrups: [
      stirrup(4250, 1500, 1350, 1400, 7, 9, 7),
      stirrup(4250, 1450, 1350, 1450, 8, 8, 8),
      stirrup(5000, 1700, 1600, 1700, 9, 10, 9),
      stirrup(4250, 1450, 1350, 1450, 8, 8, 8),
      stirrup(4250, 1400, 1350, 1500, 7, 9, 7),
    ],
    secondary: [
      {
        id: uid("sec"),
        kind: "dam-phu",
        position: 1200,
        Cx: 200,
        Dx: 100,
        H: 400,
        shear: true,
        shearKind: "dai",
        stirrupsEachSide: 5,
      },
    ],
  };
}

export function defaultStirrupsForLength(L: number): SpanStirrups {
  const side = Math.max(round50(L * 0.34), 800);
  let mid = L - 2 * side;
  let left = side;
  let right = side;
  if (mid < 600) {
    mid = Math.max(round50(L * 0.3), 400);
    left = Math.floor((L - mid) / 2 / 50) * 50;
    right = L - left - mid;
  }
  const cL = Math.max(4, Math.round(left / 150) - 3);
  const cM = Math.max(4, Math.round(mid / 200) - 2);
  const cR = Math.max(4, Math.round(right / 150) - 3);
  return {
    dia: 6,
    left: { count: cL, spacing: 150, length: left },
    mid: { count: cM, spacing: 200, length: mid },
    right: { count: cR, spacing: 150, length: right },
  };
}

function round50(n: number) {
  return Math.round(n / 50) * 50;
}

export function syncGeometry(project: BeamProject, spanCount: number): BeamProject {
  const count = Math.max(1, Math.min(12, spanCount));
  const template = project.spans[0] ?? span({ L: 4000 });
  const spans: Span[] = Array.from({ length: count }, (_, i) => {
    const existing = project.spans[i];
    return existing
      ? { ...existing }
      : {
          ...template,
          id: uid("span"),
        };
  });
  const supports: Support[] = Array.from({ length: count + 1 }, (_, i) => {
    const existing = project.supports[i];
    return existing ? { ...existing } : support(i, count);
  });
  const stirrups: SpanStirrups[] = Array.from({ length: count }, (_, i) => {
    return project.stirrups[i] ?? defaultStirrupsForLength(spans[i].L);
  });
  const last = count;
  const clampBar = <T extends { startAxis: number; endAxis: number }>(b: T): T => ({
    ...b,
    startAxis: Math.min(b.startAxis, last),
    endAxis: Math.min(Math.max(b.endAxis, b.startAxis), last),
  });
  return {
    ...project,
    spans,
    supports,
    stirrups,
    mainBottom: project.mainBottom.map(clampBar),
    extraBottom: project.extraBottom.map(clampBar),
    mainTop: project.mainTop.map(clampBar),
    extraTop: project.extraTop.map(clampBar),
  };
}
