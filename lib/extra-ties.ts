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

export type ExtraTieKind = "c" | "nested" | "double";

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

export function extraTieAllowC(project: BeamProject): boolean {
  return hasOddMainLayer(project);
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

function countMainStations(project: BeamProject) {
  return project.spans.reduce((n, span, i) => {
    if (!spanHas(project, i, "extraDouble")) return n;
    const raw = project.stirrups[i] ?? project.stirrups[0];
    const a1 = raw?.a1 ?? 150;
    const a2 = raw?.a2 ?? 200;
    if (raw?.layout === "dieu") return n + zoneCount(span.L, a1);
    const side = Math.round(span.L / 4);
    const mid = Math.max(span.L - 2 * side, 0);
    return n + zoneCount(side, a1) + zoneCount(mid, a2) + zoneCount(side, a1);
  }, 0);
}

export function extraTieStatus(project: BeamProject) {
  const allowC = extraTieAllowC(project);
  const allowInner = extraTieAllowNested(project);
  const flags = flagsOf(project.stirrups[0] ?? project.stirrups[project.spans.length ? 0 : 0]);
  const bars = barsAcrossLayer(project);
  return {
    allowC,
    allowInner,
    bars,
    flags,
    cHint: allowC
      ? "Móc thép giữa lớp có số thanh lẻ (shop thép cột)."
      : "Cần một lớp thép chủ số thanh lẻ để bố trí đai C.",
    innerHint: allowInner
      ? bars >= 4
        ? "≥ 4 thanh trên một lớp — đủ đai lồng / đai kép (shop thép cột)."
        : `B ≥ ${WIDE_BEAM_MM} mm — dầm rộng, được đai lồng / đai kép cấu tạo.`
      : "Cần ≥ 4 thanh trên một lớp (shop thép cột) hoặc B ≥ 350 mm.",
  };
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
  const doubleW = wrapWidthMm(innerB, bars, dia, wrapDouble(bars));

  const items: ExtraTieResolved[] = [
    {
      key: "c",
      label: "Đai C (móc thép giữa)",
      allowed: allowC,
      enabled: used.extraC && allowC,
      disableHint: extraTieStatus(project).cHint,
      spacing: EXTRA_TIE_SPACING_MM,
      widthMm: 0,
      heightMm: innerH,
      lengthMm: extraCLengthMm(innerH),
      copies: 1,
      countEach: 0,
      segs: [EXTRA_TIE_HOOK_MM, innerH, EXTRA_TIE_HOOK_MM],
      shape: "u-bottom",
    },
    {
      key: "nested",
      label: "Đai lồng phương B",
      allowed: allowInner && !doubleOn,
      enabled: nestedOn && allowInner,
      disableHint: extraTieStatus(project).innerHint,
      blockedHint: doubleOn ? "Đã chọn đai kép — không dùng đai lồng." : undefined,
      spacing: EXTRA_TIE_SPACING_MM,
      widthMm: nestedW,
      heightMm: innerH,
      lengthMm: extraClosedLengthMm(nestedW, innerH),
      copies: 1,
      countEach: 0,
      segs: [nestedW, innerH, EXTRA_TIE_HOOK_MM],
      shape: "stirrup",
    },
    {
      key: "double",
      label: "Đai kép phương B",
      allowed: allowInner && !nestedOn,
      enabled: doubleOn && allowInner,
      disableHint: extraTieStatus(project).innerHint,
      blockedHint: nestedOn ? "Đã chọn đai lồng — không dùng đai kép." : undefined,
      spacing: EXTRA_TIE_SPACING_MM,
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
    const flagKey =
      item.key === "c" ? "extraC" : item.key === "nested" ? "extraNested" : "extraDouble";
    const stations =
      item.key === "double"
        ? countMainStations(project)
        : countAlongSpans(project, item.spacing, flagKey);
    return { ...item, countEach: stations * item.copies };
  });
}

export function extraTiesHint(project: BeamProject): string {
  const rows = resolveExtraTies(project).filter((r) => r.enabled && r.countEach > 0);
  if (!rows.length) return "";
  return rows
    .map((r) => `${r.label}: ${r.countEach}Ø${project.stirrups[0]?.dia ?? 6} L=${r.lengthMm} a${r.spacing}`)
    .join(" · ");
}
