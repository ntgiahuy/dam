import { MAX_SPAN_COUNT, type BeamProject, type ConnectionType, type Span, type SpanStirrups, type StirrupLayout, type Support } from "./types";
import { uid } from "./utils";

const DEFAULT_SUPPORT_TYPE: ConnectionType = "cot";
const DEFAULT_SUPPORT_B_MM = 300;
/** B/2 — gối cân giữa tim trục. */
const DEFAULT_SUPPORT_B1_MM = 100;
/** 0 = để trống trên form (chiều cao gối không bắt buộc). */
const DEFAULT_SUPPORT_H_MM = 0;

function span(partial: Partial<Span> & Pick<Span, "L">): Span {
  return {
    id: uid("span"),
    H: 500,
    B: DEFAULT_SUPPORT_B_MM,
    B1: DEFAULT_SUPPORT_B1_MM,
    dH: 0,
    slabType: 1,
    Hsl: 120,
    Hl: 0,
    Hsr: 120,
    Hr: 0,
    ...partial,
  };
}

/** Tên trục gối mặc định: 1, 2, 3… */
export function defaultSupportAxisName(index: number) {
  return String(index + 1);
}

function support(i: number, _n: number): Support {
  return {
    id: uid("sup"),
    type: DEFAULT_SUPPORT_TYPE,
    B: DEFAULT_SUPPORT_B_MM,
    B1: DEFAULT_SUPPORT_B1_MM,
    H: DEFAULT_SUPPORT_H_MM,
    axisName: defaultSupportAxisName(i),
  };
}

const DEFAULT_SPAN_COUNT = 1;
const DEFAULT_SPAN_L_MM = 6500;
const DEFAULT_BEAM_NAME = "1";
const DEFAULT_BEAM_QUANTITY = 1;

function defaultSpanGeometry() {
  const Ls = Array.from({ length: DEFAULT_SPAN_COUNT }, () => DEFAULT_SPAN_L_MM);
  return {
    spans: Ls.map((L) => span({ L })),
    supports: Array.from({ length: DEFAULT_SPAN_COUNT + 1 }, (_, i) => support(i, DEFAULT_SPAN_COUNT)),
    stirrups: Ls.map((L) => emptyStirrupsForLength(L)),
  };
}

function projectWithGeometry(quantity: number): BeamProject {
  const geo = defaultSpanGeometry();
  return {
    info: {
      name: DEFAULT_BEAM_NAME,
      quantity,
      elevation: 4200,
      axisName: "",
      cover: 25,
      concreteGrade: "B25",
      steelGrade: "CB400-V",
    },
    spans: geo.spans,
    supports: geo.supports,
    mainBottom: [],
    extraBottom: [],
    mainTop: [],
    extraTop: [],
    stirrups: geo.stirrups,
    secondary: [],
  };
}

export function createEmptyProject(): BeamProject {
  return projectWithGeometry(DEFAULT_BEAM_QUANTITY);
}

/** Hình học mẫu: 1 nhịp L=6500, tên dầm 1, SL=1. Danh sách thép để trống. */
export function createSampleD1(): BeamProject {
  return projectWithGeometry(DEFAULT_BEAM_QUANTITY);
}

export function defaultSpanStirrups(): SpanStirrups {
  return { dia: 8, layout: "1/4", a1: 100, a2: 200, kind: "don" };
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
  const extraNested = Boolean(r.extraNested) && !Boolean(r.extraDouble);
  const extraDouble = Boolean(r.extraDouble) && !extraNested;
  const antiBuckling = Boolean(r.antiBuckling);
  const extraC = Boolean(r.extraC) || antiBuckling;
  const extraCSpacing = Number(r.extraCSpacing) >= 50 ? Number(r.extraCSpacing) : 200;
  const extraCCx = r.extraCCx !== false;
  const extraCCy = r.extraCCy !== false;
  const extraNestedSpacing = Number(r.extraNestedSpacing) >= 50 ? Number(r.extraNestedSpacing) : 200;
  const extraDoubleSpacing = Number(r.extraDoubleSpacing) >= 50 ? Number(r.extraDoubleSpacing) : 200;
  const tieDiaFallback = [6, 8, 10, 12, 14].includes(Number(r.dia)) ? Number(r.dia) : fallback.dia;
  const extraCDia = [6, 8, 10, 12, 14].includes(Number(r.extraCDia))
    ? Number(r.extraCDia)
    : tieDiaFallback;
  const extraNestedDia = [6, 8, 10, 12, 14].includes(Number(r.extraNestedDia))
    ? Number(r.extraNestedDia)
    : tieDiaFallback;
  const extraDoubleDia = [6, 8, 10, 12, 14].includes(Number(r.extraDoubleDia))
    ? Number(r.extraDoubleDia)
    : tieDiaFallback;
  const extras = {
    extraC,
    extraCDia,
    extraCSpacing,
    extraCCx: extraCCx || extraCCy ? extraCCx : true,
    extraCCy: extraCCx || extraCCy ? extraCCy : true,
    extraNested,
    extraNestedDia,
    extraNestedSpacing,
    extraNestedCx: extraNested,
    extraNestedCy: false,
    extraDouble,
    extraDoubleDia,
    extraDoubleSpacing,
    antiBuckling,
    antiBucklingDia: [10, 12, 14, 16].includes(Number(r.antiBucklingDia))
      ? Number(r.antiBucklingDia)
      : 12,
    antiBucklingSegments: (() => {
      const n = Number(r.antiBucklingSegments);
      if (n === 2) return 2 as const;
      if (n === 3) return 3 as const;
      return 1 as const;
    })(),
  };
  if (typeof r.a1 === "number" || typeof r.a2 === "number") {
    return {
      dia: Number(r.dia) || fallback.dia,
      layout,
      a1: Number(r.a1) || fallback.a1,
      a2: Number(r.a2) || fallback.a2,
      kind,
      ...extras,
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
    ...extras,
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
