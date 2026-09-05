import type { BarShape } from "./calc";
import type { BeamProject, SpanStirrups } from "./types";

function typicalH(spans: { H: number }[]) {
  return spans[0]?.H ?? 500;
}

function typicalB(spans: { B: number }[]) {
  return spans[0]?.B ?? 200;
}

/** Móc hai đầu đai — cùng shop thép cột (+100 mm). */
export const EXTRA_TIE_HOOK_MM = 50;
/** Khoảng đai bổ sung mặc định (shop thép cột). */
export const EXTRA_TIE_SPACING_MM = 200;
/** Dầm rộng: đai lồng/kép cấu tạo khi B ≥ 350 (GiaHuy). */
export const WIDE_BEAM_MM = 350;

export type ExtraTieKind = "c" | "c-cx" | "c-cy" | "nested" | "nested-cx" | "nested-cy" | "double";

export function extraCSpacingOf(raw?: SpanStirrups) {
  const n = Number(raw?.extraCSpacing);
  return n >= 50 ? n : EXTRA_TIE_SPACING_MM;
}

/** Mặc định cả hai phương; không cho tắt hết. */
export function extraCDirs(raw?: SpanStirrups) {
  const cx = raw?.extraCCx !== false;
  const cy = raw?.extraCCy !== false;
  if (!cx && !cy) return { cx: true, cy: true };
  return { cx, cy };
}

export function extraNestedSpacingOf(raw?: SpanStirrups) {
  const n = Number(raw?.extraNestedSpacing);
  return n >= 50 ? n : EXTRA_TIE_SPACING_MM;
}

export function extraNestedDirs(raw?: SpanStirrups) {
  const cx = raw?.extraNestedCx !== false;
  const cy = raw?.extraNestedCy !== false;
  if (!cx && !cy) return { cx: true, cy: true };
  return { cx, cy };
}

export function extraDoubleSpacingOf(raw?: SpanStirrups) {
  const n = Number(raw?.extraDoubleSpacing);
  return n >= 50 ? n : EXTRA_TIE_SPACING_MM;
}

export interface ExtraTieResolved {
  key: ExtraTieKind;
  label: string;
  allowed: boolean;
  enabled: boolean;
  disableHint: string;
  blockedHint?: string;
  spacing: number;
  widthMm: number;
  heightMm: number;
  lengthMm: number;
  copies: number;
  countEach: number;
  segs: number[];
  shape: BarShape;
}

export function barsAcrossLayer(project: BeamProject): number {
  const layers = [...project.mainBottom, ...project.mainTop];
  if (!layers.length) return 0;
  return Math.max(...layers.map((b) => b.qty), 0);
}

export function hasOddMainLayer(project: BeamProject): boolean {
  return [...project.mainBottom, ...project.mainTop].some((b) => b.qty % 2 === 1);
}

export const ANTI_BUCKLING_DIAS = [10, 12, 14, 16] as const;
export const ANTI_BUCKLING_QTY = 2;

export function normalizeAntiBucklingDia(dia?: number) {
  const n = Math.round(Number(dia) || 0);
  return (ANTI_BUCKLING_DIAS as readonly number[]).includes(n) ? n : 12;
}

export function spanHasAntiBuckling(project: BeamProject, index: number) {
  return Boolean(project.stirrups[index]?.antiBuckling);
}

export function extraTieAllowC(project: BeamProject, spanIndex?: number): boolean {
  if (hasOddMainLayer(project)) return true;
  if (spanIndex != null) return spanHasAntiBuckling(project, spanIndex);
  return project.stirrups.some((s) => s.antiBuckling);
}

export function extraTieAllowNested(project: BeamProject): boolean {
  return barsAcrossLayer(project) >= 4 || typicalB(project.spans) >= WIDE_BEAM_MM;
}

function wrapNested(bars: number) {
  return Math.max(2, Math.ceil(bars / 3));
}

function wrapDouble(bars: number) {
  return Math.min(bars, Math.max(2, Math.ceil((2 * bars) / 3)));
}

function barGapMm(innerB: number, bars: number, dia: number) {
  if (bars <= 1) return 0;
  return (innerB - dia) / (bars - 1);
}

function wrapWidthMm(innerB: number, bars: number, dia: number, wrap: number) {
  if (wrap <= 1) return Math.max(40, Math.round(dia));
  const gap = barGapMm(innerB, bars, dia);
  return Math.max(40, Math.round((wrap - 1) * gap + dia));
}

/** Đai C: chiều dài = nhịp móc + 100 (shop cột `gt`). */
export function extraCLengthMm(spanMm: number) {
  return Math.max(spanMm, 0) + 2 * EXTRA_TIE_HOOK_MM;
}

/** Đai kín: 2·(b+h) + 100 (shop cột `vt`). */
export function extraClosedLengthMm(widthMm: number, heightMm: number) {
  return 2 * (Math.max(widthMm, 40) + Math.max(heightMm, 40)) + 2 * EXTRA_TIE_HOOK_MM;
}

function typicalMainDia(project: BeamProject) {
  const first = project.mainBottom[0] ?? project.mainTop[0];
  return first?.dia ?? 18;
}

function flagsOf(raw: SpanStirrups | undefined) {
  const extraNested = Boolean(raw?.extraNested) && !Boolean(raw?.extraDouble);
  const extraDouble = Boolean(raw?.extraDouble) && !extraNested;
  return {
    extraC: Boolean(raw?.extraC),
    extraNested,
    extraDouble,
  };
}

function zoneCount(length: number, spacing: number) {
  if (!(length > 0) || !(spacing > 0)) return 0;
  return Math.max(1, Math.round(length / spacing));
}

function spanHas(
  project: BeamProject,
  index: number,
  key: "extraC" | "extraNested" | "extraDouble",
) {
  const raw = project.stirrups[index] ?? project.stirrups[0];
  if (key === "extraC") return Boolean(raw?.extraC);
  if (key === "extraNested") return Boolean(raw?.extraNested) && !Boolean(raw?.extraDouble);
  return Boolean(raw?.extraDouble) && !Boolean(raw?.extraNested);
}

function countAlongSpans(
  project: BeamProject,
  spacing: number,
  key: "extraC" | "extraNested" | "extraDouble",
) {
  return project.spans.reduce((n, span, i) => {
    if (!spanHas(project, i, key)) return n;
    return n + zoneCount(span.L, spacing);
  }, 0);
}

function countCAlongSpans(project: BeamProject, axis: "cx" | "cy") {
  return project.spans.reduce((n, span, i) => {
    if (!spanHas(project, i, "extraC")) return n;
    const raw = project.stirrups[i] ?? project.stirrups[0];
    const dirs = extraCDirs(raw);
    if (axis === "cx" && !dirs.cx) return n;
    if (axis === "cy" && !dirs.cy) return n;
    return n + zoneCount(span.L, extraCSpacingOf(raw));
  }, 0);
}

function countNestedAlongSpans(project: BeamProject, axis: "cx" | "cy") {
  return project.spans.reduce((n, span, i) => {
    if (!spanHas(project, i, "extraNested")) return n;
    const raw = project.stirrups[i] ?? project.stirrups[0];
    const dirs = extraNestedDirs(raw);
    if (axis === "cx" && !dirs.cx) return n;
    if (axis === "cy" && !dirs.cy) return n;
    return n + zoneCount(span.L, extraNestedSpacingOf(raw));
  }, 0);
}

function countDoubleAlongSpans(project: BeamProject) {
  return project.spans.reduce((n, span, i) => {
    if (!spanHas(project, i, "extraDouble")) return n;
    return n + zoneCount(span.L, extraDoubleSpacingOf(project.stirrups[i]));
  }, 0);
}

export function extraTieStatus(project: BeamProject, spanIndex = 0) {
  const anti = spanHasAntiBuckling(project, spanIndex);
  const allowC = extraTieAllowC(project, spanIndex);
  const allowInner = extraTieAllowNested(project);
  const flags = flagsOf(project.stirrups[spanIndex] ?? project.stirrups[0]);
  const bars = barsAcrossLayer(project);
  return {
    allowC,
    allowInner,
    bars,
    flags,
    antiBuckling: anti,
    cHint: anti
      ? "Đai C: Cx ngang móc chống phình; Cy đứng móc thép giữa. Khoảng cách mặc định 200 mm."
      : allowC
        ? "Móc thép giữa lớp có số thanh lẻ (shop thép cột)."
        : "Cần lớp chủ số thanh lẻ, hoặc tick Thép chống phình Ø.",
    innerHint: allowInner
      ? bars >= 4
        ? "≥ 4 thanh trên một lớp — đủ đai lồng / đai kép (shop thép cột)."
        : `B ≥ ${WIDE_BEAM_MM} mm — dầm rộng, được đai lồng / đai kép cấu tạo.`
      : "Cần ≥ 4 thanh trên một lớp (shop thép cột) hoặc B ≥ 350 mm.",
  };
}

/** Thống kê thép chống phình: 2 cây / nhịp bật, L = chiều dài nhịp. */
export function antiBucklingSchedule(project: BeamProject) {
  const groups = new Map<string, { dia: number; lengthMm: number; qtyEach: number }>();
  project.spans.forEach((span, i) => {
    if (!spanHasAntiBuckling(project, i)) return;
    const dia = normalizeAntiBucklingDia(project.stirrups[i]?.antiBucklingDia);
    const lengthMm = Math.max(0, Math.round(span.L));
    const key = `${dia}|${lengthMm}`;
    const cur = groups.get(key) ?? { dia, lengthMm, qtyEach: 0 };
    cur.qtyEach += ANTI_BUCKLING_QTY;
    groups.set(key, cur);
  });
  return [...groups.values()];
}

export function resolveExtraTies(project: BeamProject): ExtraTieResolved[] {
  const cover = project.info.cover || 25;
  const B = typicalB(project.spans);
  const H = typicalH(project.spans);
  const innerB = Math.max(B - 2 * cover, 40);
  const innerH = Math.max(H - 2 * cover, 40);
  const bars = Math.max(barsAcrossLayer(project), 2);
  const dia = typicalMainDia(project);
  const flags = flagsOf(
    project.stirrups[0] ?? project.stirrups[project.stirrups.length - 1],
  );
  // Per-span flags: if any span enables, use that span's flags (apply-all copies them)
  const used = project.stirrups.reduce(
    (acc, s) => ({
      extraC: acc.extraC || Boolean(s.extraC),
      extraNested: acc.extraNested || Boolean(s.extraNested),
      extraDouble: acc.extraDouble || Boolean(s.extraDouble),
    }),
    flags,
  );
  const nestedOn = used.extraNested && !used.extraDouble;
  const doubleOn = used.extraDouble && !nestedOn;
  const allowC = extraTieAllowC(project);
  const allowInner = extraTieAllowNested(project);

  const nestedW = wrapWidthMm(innerB, bars, dia, wrapNested(bars));
  const nestedH = wrapWidthMm(innerH, bars, dia, wrapNested(bars));
  const doubleW = wrapWidthMm(innerB, bars, dia, wrapDouble(bars));
  const dirs = extraCDirs(project.stirrups.find((s) => s.extraC) ?? project.stirrups[0]);
  const nestedDirs = extraNestedDirs(project.stirrups.find((s) => s.extraNested) ?? project.stirrups[0]);
  const cOn = used.extraC && allowC;
  const typicalCSpacing = extraCSpacingOf(project.stirrups.find((s) => s.extraC) ?? project.stirrups[0]);
  const typicalNestedSpacing = extraNestedSpacingOf(
    project.stirrups.find((s) => s.extraNested) ?? project.stirrups[0],
  );
  const typicalDoubleSpacing = extraDoubleSpacingOf(
    project.stirrups.find((s) => s.extraDouble) ?? project.stirrups[0],
  );

  const items: ExtraTieResolved[] = [
    {
      key: "c-cx",
      label: "Đai C phương Cx",
      allowed: allowC,
      enabled: cOn && dirs.cx,
      disableHint: extraTieStatus(project).cHint,
      spacing: typicalCSpacing,
      widthMm: innerB,
      heightMm: 0,
      lengthMm: extraCLengthMm(innerB),
      copies: 1,
      countEach: 0,
      segs: [EXTRA_TIE_HOOK_MM, innerB, EXTRA_TIE_HOOK_MM],
      shape: "u-bottom",
    },
    {
      key: "c-cy",
      label: "Đai C phương Cy",
      allowed: allowC,
      enabled: cOn && dirs.cy,
      disableHint: extraTieStatus(project).cHint,
      spacing: typicalCSpacing,
      widthMm: 0,
      heightMm: innerH,
      lengthMm: extraCLengthMm(innerH),
      copies: 1,
      countEach: 0,
      segs: [EXTRA_TIE_HOOK_MM, innerH, EXTRA_TIE_HOOK_MM],
      shape: "u-bottom",
    },
    {
      key: "nested-cx",
      label: "Đai lồng phương Cx",
      allowed: allowInner && !doubleOn,
      enabled: nestedOn && allowInner && nestedDirs.cx,
      disableHint: extraTieStatus(project).innerHint,
      blockedHint: doubleOn ? "Đã chọn đai kép — không dùng đai lồng." : undefined,
      spacing: typicalNestedSpacing,
      widthMm: nestedW,
      heightMm: innerH,
      lengthMm: extraClosedLengthMm(nestedW, innerH),
      copies: 1,
      countEach: 0,
      segs: [nestedW, innerH, EXTRA_TIE_HOOK_MM],
      shape: "stirrup",
    },
    {
      key: "nested-cy",
      label: "Đai lồng phương Cy",
      allowed: allowInner && !doubleOn,
      enabled: nestedOn && allowInner && nestedDirs.cy,
      disableHint: extraTieStatus(project).innerHint,
      blockedHint: doubleOn ? "Đã chọn đai kép — không dùng đai lồng." : undefined,
      spacing: typicalNestedSpacing,
      widthMm: innerB,
      heightMm: nestedH,
      lengthMm: extraClosedLengthMm(innerB, nestedH),
      copies: 1,
      countEach: 0,
      segs: [innerB, nestedH, EXTRA_TIE_HOOK_MM],
      shape: "stirrup",
    },
    {
      key: "double",
      label: "Đai kép phương B",
      allowed: allowInner && !nestedOn,
      enabled: doubleOn && allowInner,
      disableHint: extraTieStatus(project).innerHint,
      blockedHint: nestedOn ? "Đã chọn đai lồng — không dùng đai kép." : undefined,
      spacing: typicalDoubleSpacing,
      widthMm: doubleW,
      heightMm: innerH,
      lengthMm: extraClosedLengthMm(doubleW, innerH),
      copies: 2,
      countEach: 0,
      segs: [doubleW, innerH, EXTRA_TIE_HOOK_MM],
      shape: "stirrup",
    },
  ];

  return items.map((item) => {
    if (!item.enabled) return item;
    const stations =
      item.key === "double"
        ? countDoubleAlongSpans(project)
        : item.key === "c-cx"
          ? countCAlongSpans(project, "cx")
          : item.key === "c-cy"
            ? countCAlongSpans(project, "cy")
            : item.key === "nested-cx"
              ? countNestedAlongSpans(project, "cx")
              : item.key === "nested-cy"
                ? countNestedAlongSpans(project, "cy")
                : countAlongSpans(project, item.spacing, "extraDouble");
    return { ...item, countEach: stations * item.copies };
  });
}

export function extraTiesHint(project: BeamProject): string {
  const rows = resolveExtraTies(project).filter((r) => r.enabled && r.countEach > 0);
  const ties = rows
    .map((r) => `${r.label}: ${r.countEach}Ø${project.stirrups[0]?.dia ?? 6} L=${r.lengthMm} a${r.spacing}`)
    .join(" · ");
  const skin = antiBucklingSchedule(project)
    .map((r) => `Thép chống phình Ø: ${r.qtyEach}Ø${r.dia} L=${r.lengthMm} (giữa H, đai C ngang)`)
    .join(" · ");
  return [ties, skin].filter(Boolean).join(" · ");
}
