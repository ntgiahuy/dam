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
export type EndType = 0 | 1 | 2 | 3;

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

export interface MainBar {
  id: string;
  dia: number;
  qty: number;
  startAxis: number;
  endAxis: number;
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

export interface StirrupZone {
  count: number;
  spacing: number;
  length: number;
}

export interface SpanStirrups {
  dia: number;
  left: StirrupZone;
  mid: StirrupZone;
  right: StirrupZone;
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

export const DIAMETERS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
export const QTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
export const LAYER_OPTIONS = [1, 2, 3];
export const END_TYPE_OPTIONS = [
  { value: 0, label: "0 — Cắt tại tim trục" },
  { value: 1, label: "1 — Cắt thẳng (mép gối)" },
  { value: 2, label: "2 — Neo vào gối" },
  { value: 3, label: "3 — Móc 90°" },
];

export const SLAB_TYPES = [
  { value: 0, label: "0 — Chữ nhật" },
  { value: 1, label: "1 — Sàn hai bên" },
  { value: 2, label: "2 — Sàn trái" },
  { value: 3, label: "3 — Sàn phải" },
];
