import { MAX_SPAN_COUNT, type BeamProject, type Span, type SpanStirrups, type Support } from "./types";
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

function support(i: number, _n: number): Support {
  return {
    id: uid("sup"),
    type: "cot",
    B: 200,
    B1: 100,
    H: 0,
    axisName: String(i),
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
      concreteGrade: "B25",
      steelGrade: "CB400-V",
    },
    spans,
    supports: [support(0, 1), support(1, 1)],
    mainBottom: [],
    extraBottom: [],
    mainTop: [],
    extraTop: [],
    stirrups: [emptyStirrupsForLength(4000)],
    secondary: [],
  };
}

/** Hình học mẫu dầm D1 (5 nhịp). Danh sách thép để trống — người dùng tự thêm. */
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
      concreteGrade: "B25",
      steelGrade: "CB400-V",
    },
    spans,
    supports,
    mainBottom: [],
    extraBottom: [],
    mainTop: [],
    extraTop: [],
    stirrups: Ls.map((L) => emptyStirrupsForLength(L)),
    secondary: [],
  };
}

function round50(n: number) {
  return Math.round(n / 50) * 50;
}

function zoneLengths(L: number) {
  const side = Math.max(round50(L * 0.34), 800);
  let mid = L - 2 * side;
  let left = side;
  let right = side;
  if (mid < 600) {
    mid = Math.max(round50(L * 0.3), 400);
    left = Math.floor((L - mid) / 2 / 50) * 50;
    right = L - left - mid;
  }
  return { left, mid, right };
}

/** Vùng đai theo chiều dài nhịp, số lượng = 0 — người dùng tự nhập. */
export function emptyStirrupsForLength(L: number): SpanStirrups {
  const { left, mid, right } = zoneLengths(L);
  return {
    dia: 6,
    left: { count: 0, spacing: 150, length: left },
    mid: { count: 0, spacing: 200, length: mid },
    right: { count: 0, spacing: 150, length: right },
  };
}

export function defaultStirrupsForLength(L: number): SpanStirrups {
  return emptyStirrupsForLength(L);
}

export function syncGeometry(project: BeamProject, spanCount: number): BeamProject {
  const count = Math.max(1, Math.min(MAX_SPAN_COUNT, spanCount));
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
