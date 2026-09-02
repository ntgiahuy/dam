import { roundTo } from "./utils";

/** TCVN 5574:2018 Table 7 — Rbt, MPa (bê tông nặng, TGTH thứ nhất). */
export const CONCRETE_GRADES = ["B20", "B25", "B30", "B35", "B40"] as const;
export type ConcreteGrade = (typeof CONCRETE_GRADES)[number];

const RBT: Record<ConcreteGrade, number> = {
  B20: 0.9,
  B25: 1.05,
  B30: 1.15,
  B35: 1.3,
  B40: 1.4,
};

/** TCVN 5574:2018 Table 13 — Rs, MPa (thép có gân). */
export const STEEL_GRADES = ["CB300-V", "CB400-V", "CB500-V"] as const;
export type SteelGrade = (typeof STEEL_GRADES)[number];

const RS: Record<SteelGrade, number> = {
  "CB300-V": 260,
  "CB400-V": 350,
  "CB500-V": 435,
};

export function concreteRbt(grade?: string) {
  return RBT[(grade as ConcreteGrade) || "B25"] ?? RBT.B25;
}

export function steelRs(grade?: string) {
  return RS[(grade as SteelGrade) || "CB400-V"] ?? RS["CB400-V"];
}

/**
 * Chiều dài neo cơ sở l0,an — TCVN 5574:2018 (255)–(256).
 * Thép cán nóng có gân: η1 = 2,5; η2 = 1,0 khi ds ≤ 32 mm.
 */
export function basicAnchorageMm(dia: number, concreteGrade?: string, steelGrade?: string) {
  const ds = Math.max(dia || 1, 1);
  const eta1 = 2.5;
  const eta2 = ds <= 32 ? 1 : 0.9;
  const Rbond = eta1 * eta2 * concreteRbt(concreteGrade);
  return (steelRs(steelGrade) * ds) / (4 * Rbond);
}

/**
 * Chiều dài neo tính toán lan — TCVN 5574:2018 (257) và 10.3.5.5.
 * α = 1,0 neo thẳng chịu kéo; uốn đầu thép có gân được giảm không quá 30%.
 * lan ≥ max(15 ds, 200 mm, 0,3 l0).
 */
export function designAnchorageMm(
  dia: number,
  opts: { hooked?: boolean; concreteGrade?: string; steelGrade?: string } = {},
) {
  const ds = Math.max(dia || 1, 1);
  const l0 = basicAnchorageMm(ds, opts.concreteGrade, opts.steelGrade);
  const alpha = opts.hooked ? 0.7 : 1;
  const lan = alpha * l0;
  const minLan = Math.max(15 * ds, 200, 0.3 * l0);
  return roundTo(Math.max(lan, minLan), 10);
}

/** Đường kính gối uốn tối thiểu — TCVN 5574:2018 10.3.7 (thép có gân). */
export function bendPinDiameterMm(dia: number) {
  const ds = Math.max(dia || 1, 1);
  return ds < 20 ? 5 * ds : 8 * ds;
}

/**
 * Đoạn thẳng sau uốn móc 90° (chữ L).
 * 10.3.7 quy định gối uốn; đuôi móc lấy 12 ds (thực hành shop VN), tối thiểu 150 mm.
 */
export function hook90ExtensionMm(dia: number) {
  const ds = Math.max(dia || 1, 1);
  return roundTo(Math.max(12 * ds, 150), 10);
}

/** 10.3.5.7 — đoạn kéo vào gối tự do ngoài cùng, tối thiểu 5 ds. */
export function freeSupportEmbedMm(dia: number) {
  return 5 * Math.max(dia || 1, 1);
}

export function describeSaggingExtraBottom(l0?: number, h0?: number, dia?: number) {
  const formula = "M+ giữa nhịp, lớp dưới · l₀/2 + 2·max(h₀, 15d, l₀/16)";
  if (!(l0 && l0 > 0) || !(h0 && h0 > 0) || !(dia && dia > 0)) return formula;
  const ds = Math.max(dia, 1);
  const a = Math.max(h0, 15 * ds, l0 / 16);
  const raw = l0 / 2 + 2 * a;
  const shop = Math.min(roundTo(raw + 100, 50), l0);
  const inset = Math.max((l0 - shop) / 2, 0);
  return `${formula} = ${Math.round(raw)} → ${shop} mm (dư 50 mỗi đầu, tròn 50) · cách mép gối ${Math.round(inset)} mm`;
}

export function describeHoggingExtraTop(l0?: number) {
  const formula = "M- tại gối, lớp trên · l₀/4 (làm tròn 50 mm)";
  const edge = " · gối biên: đoạn thẳng = l₀/4 từ móc, không cộng bề rộng cột; móc 2/3H";
  if (!(l0 && l0 > 0)) return formula + edge;
  const raw = l0 / 4;
  const ext = roundTo(raw, 50);
  return `${formula} = ${Math.round(raw)} → ${ext} mm (làm tròn 50) · gối biên: đoạn thẳng = l₀/4 từ móc, không cộng bề rộng cột`;
}

export function describeEndType(
  type: number,
  dia: number,
  concreteGrade?: string,
  steelGrade?: string,
  spanL?: number,
  face?: "top" | "bottom",
  l0?: number,
  h0?: number,
) {
  const ds = Math.max(dia || 1, 1);
  if (type === 1) {
    if (face === "bottom") return describeSaggingExtraBottom(l0, h0, ds);
    return describeHoggingExtraTop(l0);
  }
  if (type === 2) {
    if (face === "top") return "Cắt thẳng M- tại gối, tới tim cột (gối biên tự bẻ móc 2/3H ±50 mm; móc tại tim nếu đã ≥ 50 mm lớp bảo vệ)";
    return "Cắt thẳng tại mép trong gối";
  }
  if (type === 3) return "Cắt thẳng tại tim cột";
  const hook = hook90ExtensionMm(ds);
  const pin = bendPinDiameterMm(ds);
  return `Móc 90° đuôi ${hook} mm (12d) · gối uốn ${pin} mm · TCVN 5574:2018 10.3.7`;
}
