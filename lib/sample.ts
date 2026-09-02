import { MAX_SPAN_COUNT, type BeamProject, type Span, type SpanStirrups, type StirrupLayout, type Support } from "./types";
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

export function defaultSpanStirrups(): SpanStirrups {
  return { dia: 6, layout: "1/4", a1: 150, a2: 200, kind: "don" };
}

/** @deprecated dùng defaultSpanStirrups — giữ tên cũ cho chỗ gọi theo L. */
export function emptyStirrupsForLength(_L?: number): SpanStirrups {
  return defaultSpanStirrups();
}

export function defaultStirrupsForLength(_L?: number): SpanStirrups {
  return defaultSpanStirrups();
}

export function normalizeSpanStirrups(raw: unknown): SpanStirrups {
  const r = raw as Record<string, unknown> | null;
  const fallback = defaultSpanStirrups();
  if (!r || typeof r !== "object") return fallback;
  const layout: StirrupLayout = r.layout === "dieu" ? "dieu" : "1/4";
  const kind = r.kind === "kep" ? "kep" : "don";
  if (typeof r.a1 === "number" || typeof r.a2 === "number") {
    return {
      dia: Number(r.dia) || fallback.dia,
      layout,
      a1: Number(r.a1) || fallback.a1,
      a2: Number(r.a2) || fallback.a2,
      kind,
    };
  }
  const left = r.left as { spacing?: number } | undefined;
  const mid = r.mid as { spacing?: number } | undefined;
  return {
    dia: Number(r.dia) || fallback.dia,
    layout,
    a1: Number(left?.spacing) || fallback.a1,
    a2: Number(mid?.spacing) || fallback.a2,
    kind,
  };
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
    return project.stirrups[i]
      ? normalizeSpanStirrups(project.stirrups[i])
      : defaultSpanStirrups();
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
