export type ConnectionType =
  | "cot"
  | "vach"
  | "vach-2"
  | "dam-do"
  | "console-do-dam"
  | "console-tu-do"
  | "cot-mai";

export const CONNECTION_TYPES: { value: ConnectionType; label: string }[] = [
  { value: "cot", label: "Cột" },
  { value: "vach", label: "Vách" },
  { value: "vach-2", label: "Vách loại 2" },
  { value: "dam-do", label: "Dầm đỡ" },
  { value: "console-do-dam", label: "Console đỡ dầm" },
  { value: "console-tu-do", label: "Console tự do" },
  { value: "cot-mai", label: "Cột tầng mái" },
];
export type SecondaryKind = "dam-phu" | "tru";
export type ShearKind = "dai" | "treo";
export type EndType = 1 | 2 | 3 | 4;

export interface Span {
  id: string;
  L: number;
  H: number;
  B: number;
  B1: number;
  dH: number;
  slabType: number;
  Hsl: number;
  Hl: number;
  Hsr: number;
  Hr: number;
}

export interface Support {
  id: string;
  type: ConnectionType;
  B: number;
  B1: number;
  H: number;
  axisName: string;
}

export const LAP_MULTIPLES = [30, 35, 40] as const;
export type LapMultiple = (typeof LAP_MULTIPLES)[number];

export interface MainBar {
  id: string;
  dia: number;
  qty: number;
  startAxis: number;
  endAxis: number;
  /** Chỉ thép chủ lớp dưới: móc đứng cả hai đầu thanh. Mặc định không móc. */
  hooksBothEnds?: boolean;
  /** Chiều cao móc (mm), dùng khi `hooksBothEnds`. */
  hookHeightMm?: number;
  /** Cắt/ghép khi dài hơn 11,7 m (mặc định bật). Lớp dưới nối trong l₀/4 gối; lớp trên nối ngoài l₀/4. */
  autoCut?: boolean;
  /** Bội số D cho mỗi đầu nối (30D / 35D / 40D). */
  lapMultiple?: LapMultiple;
}

export interface ExtraBar {
  id: string;
  layer: number;
  dia: number;
  qty: number;
  startAxis: number;
  endAxis: number;
  startType: EndType;
  endType: EndType;
  lengthOverride?: number;
}

export type StirrupLayout = "1/4" | "dieu";
export type StirrupKind = "don" | "kep";

export const STIRRUP_LAYOUTS: { value: StirrupLayout; label: string }[] = [
  { value: "1/4", label: "1/4" },
  { value: "dieu", label: "Đai điều" },
];

export const STIRRUP_KINDS: { value: StirrupKind; label: string }[] = [
  { value: "don", label: "Đai Đơn" },
  { value: "kep", label: "Đai Kép" },
];

export interface StirrupZone {
  count: number;
  spacing: number;
  length: number;
}

/** Thông số đai do người dùng nhập — chiều dài vùng gối tự lấy theo thép tăng cường / nhịp. */
export interface SpanStirrups {
  dia: number;
  layout: StirrupLayout;
  a1: number;
  a2: number;
  kind: StirrupKind;
  /** Đai C — móc thép giữa khi số thanh một lớp lẻ (shop thép cột). */
  extraC?: boolean;
  /** Đai lồng — đai cấu tạo trong, không dùng cùng đai kép. */
  extraNested?: boolean;
  /** Đai kép bổ sung — cùng khoảng đai chính; không dùng cùng đai lồng. */
  extraDouble?: boolean;
}

export interface SecondaryMember {
  id: string;
  kind: SecondaryKind;
  position: number;
  Cx: number;
  Dx: number;
  H: number;
  shear: boolean;
  shearKind: ShearKind;
  stirrupsEachSide: number;
}

export interface BeamInfo {
  name: string;
  quantity: number;
  elevation: number;
  axisName: string;
  cover: number;
  /** TCVN 5574:2018 cấp bê tông, mặc định B25. */
  concreteGrade?: string;
  /** TCVN 5574:2018 loại thép, mặc định CB400-V. */
  steelGrade?: string;
}

export interface BeamProject {
  info: BeamInfo;
  spans: Span[];
  supports: Support[];
  mainBottom: MainBar[];
  extraBottom: ExtraBar[];
  mainTop: MainBar[];
  extraTop: ExtraBar[];
  stirrups: SpanStirrups[];
  secondary: SecondaryMember[];
}

export type TabId =
  | "spans"
  | "slab"
  | "supports"
  | "mainBottom"
  | "extraBottom"
  | "mainTop"
  | "extraTop"
  | "stirrups"
  | "secondary"
  | "info";

export const TABS: { id: TabId; label: string }[] = [
  { id: "spans", label: "Số liệu nhịp dầm" },
  { id: "slab", label: "Sàn" },
  { id: "supports", label: "Gối đỡ" },
  { id: "mainBottom", label: "Thép chủ lớp dưới" },
  { id: "extraBottom", label: "Thép bổ sung lớp dưới" },
  { id: "mainTop", label: "Thép chủ lớp trên" },
  { id: "extraTop", label: "Thép bổ sung lớp trên" },
  { id: "stirrups", label: "Thép đai" },
  { id: "secondary", label: "Dầm phụ hoặc trụ trên dầm" },
  { id: "info", label: "Thông tin dầm" },
];

export const MAX_SPAN_COUNT = 20;
export const DIAMETERS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
export const QTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
export const LAYER_OPTIONS = [1, 2, 3];
export const LAYER_LABELS = [
  { value: 1, label: "1 — Giữa 2 thép chủ" },
  { value: 2, label: "2 — Cách lớp chủ 25mm" },
  { value: 3, label: "3 — Cách lớp 2 thêm 25mm" },
];
export const END_TYPE_OPTIONS = [
  { value: 1, label: "1 — Cắt thẳng M+ giữa nhịp" },
  { value: 2, label: "2 — Cắt thẳng mép gối" },
  { value: 3, label: "3 — Cắt thẳng tim cột" },
  { value: 4, label: "4 — Móc 90°" },
];

export const EXTRA_BOTTOM_END_TYPE_OPTIONS = END_TYPE_OPTIONS;

export const EXTRA_TOP_END_TYPE_OPTIONS = [
  { value: 1, label: "1 — Cắt thẳng M- tại gối, l₀/4" },
  { value: 2, label: "2 — Cắt thẳng M- tại gối, tới tim cột" },
];

export function extraEndTypeOptions(face: "top" | "bottom") {
  return face === "bottom" ? EXTRA_BOTTOM_END_TYPE_OPTIONS : EXTRA_TOP_END_TYPE_OPTIONS;
}

export const SLAB_TYPES = [
  { value: 0, label: "0 — Chữ nhật" },
  { value: 1, label: "1 — Sàn hai bên" },
  { value: 2, label: "2 — Sàn trái" },
  { value: 3, label: "3 — Sàn phải" },
];
