import type { BeamProject } from "../types";
import { DxfDoc } from "./dxf";
import { buildShopCad } from "./generate";

const LAYER_COLOR: Record<string, number> = {
  "0": 7,
  SHOP: 7,
  AXIS: 8,
  DIM: 1,
  TEXT: 7,
  TITLE: 5,
  TABLE: 7,
};

function isRealDwg(bytes: Uint8Array) {
  let magic = "";
  for (let i = 0; i < Math.min(6, bytes.length); i++) magic += String.fromCharCode(bytes[i]);
  return magic.startsWith("AC10");
}

async function writeShopDwg(drawing: DxfDoc): Promise<Uint8Array> {
  const acad = await import("@node-projects/acad-ts");
  const {
    ACadVersion,
    Arc,
    CadDocument,
    Circle,
    Color,
    DwgWriter,
    Layer,
    Line,
    TextEntity,
    TextHorizontalAlignment,
    TextVerticalAlignmentType,
    UnitsType,
    XYZ,
  } = acad;

  const ents = drawing.toCadPrimitives();
  const doc = new CadDocument(ACadVersion.AC1027);
  if (!doc.header || !doc.layers || !doc.modelSpace) {
    throw new Error("Không khởi tạo được tài liệu DWG.");
  }
  doc.header.version = ACadVersion.AC1027;
  doc.header.insUnits = UnitsType.Millimeters;
  doc.header.codePage = "ANSI_1258";

  const layers = new Map<string, InstanceType<typeof Layer>>();
  const ensureLayer = (name: string) => {
    const key = name || "0";
    const existing = layers.get(key);
    if (existing) return existing;
    if (key === "0") {
      const zero = doc.layers!.tryGetValue("0") ?? new Layer("0");
      zero.color = new Color(LAYER_COLOR["0"]);
      layers.set("0", zero);
      return zero;
    }
    const layer = new Layer(key);
    layer.color = new Color(LAYER_COLOR[key] ?? 7);
    doc.layers!.add(layer);
    layers.set(key, layer);
    return layer;
  };
  for (const name of ["SHOP", "AXIS", "DIM", "TEXT", "TITLE", "TABLE"]) ensureLayer(name);

  const space = doc.modelSpace.entities;
  const add = (entity: InstanceType<typeof Line | typeof Circle | typeof Arc | typeof TextEntity>, layerName: string) => {
    entity.layer = ensureLayer(layerName);
    space.add(entity);
  };

  for (const e of ents.lines) {
    add(new Line(new XYZ(e.x1, e.y1, 0), new XYZ(e.x2, e.y2, 0)), e.layer);
  }
  for (const e of ents.circles) {
    add(new Circle(new XYZ(e.x, e.y, 0), e.r), e.layer);
  }
  for (const e of ents.arcs) {
    add(new Arc(new XYZ(e.x, e.y, 0), e.r, (e.start * Math.PI) / 180, (e.end * Math.PI) / 180), e.layer);
  }
  for (const e of ents.texts) {
    if (!e.text) continue;
    const text = new TextEntity(e.text);
    text.height = Math.max(e.h, 0.1);
    const pt = new XYZ(e.x, e.y, 0);
    text.insertPoint = pt;
    text.alignmentPoint = pt;
    text.horizontalAlignment =
      e.align === "center"
        ? TextHorizontalAlignment.Center
        : e.align === "right"
          ? TextHorizontalAlignment.Right
          : TextHorizontalAlignment.Left;
    text.verticalAlignment = TextVerticalAlignmentType.Baseline;
    add(text, e.layer);
  }

  const notes: string[] = [];
  const bytes = DwgWriter.writeToBuffer(doc, null, (_sender, ev) => {
    if (ev?.message) notes.push(ev.message);
  });
  if (!isRealDwg(bytes)) {
    throw new Error(notes[0] || "Bộ đệm xuất ra không phải DWG.");
  }
  return bytes;
}

export async function generateBeamDwg(project: BeamProject): Promise<Uint8Array> {
  return writeShopDwg(buildShopCad(project, "DWG"));
}
