/** Shop drawing primitives. 1 unit = 1 mm. DXF is AC1027 UTF-8; DWG shares the same entities. */

/** ACI colors that stay visible on a white paper background. */
export const CAD_LAYER_COLOR: Record<string, number> = {
  "0": 7,
  SHOP: 250,
  AXIS: 4,
  DIM: 1,
  TEXT: 250,
  TITLE: 5,
  TABLE: 250,
};

export type CadAlign = "left" | "center" | "right";

export type CadLine = { x1: number; y1: number; x2: number; y2: number; layer: string };
export type CadCircle = { x: number; y: number; r: number; layer: string };
export type CadText = { x: number; y: number; h: number; text: string; align: CadAlign; layer: string };
export type CadArc = { x: number; y: number; r: number; start: number; end: number; layer: string };

export type CadPrimitives = {
  lines: CadLine[];
  circles: CadCircle[];
  texts: CadText[];
  arcs: CadArc[];
};

type Align = CadAlign;
type LineEnt = CadLine;
type CircEnt = CadCircle;
type TextEnt = CadText & { bold?: boolean };
type ArcEnt = CadArc;

export class DxfDoc {
  private lines: LineEnt[] = [];
  private circles: CircEnt[] = [];
  private texts: TextEnt[] = [];
  private arcs: ArcEnt[] = [];
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  private touch(x: number, y: number) {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
  }

  line(x1: number, y1: number, x2: number, y2: number, layer = "SHOP") {
    this.lines.push({ x1, y1, x2, y2, layer });
    this.touch(x1, y1);
    this.touch(x2, y2);
  }

  circle(x: number, y: number, r: number, layer = "SHOP") {
    this.circles.push({ x, y, r, layer });
    this.touch(x - r, y - r);
    this.touch(x + r, y + r);
  }

  arc(x: number, y: number, r: number, startDeg: number, endDeg: number, layer = "SHOP") {
    this.arcs.push({ x, y, r, start: startDeg, end: endDeg, layer });
    this.touch(x - r, y - r);
    this.touch(x + r, y + r);
  }

  text(x: number, y: number, h: number, text: string, align: Align = "left", layer = "TEXT") {
    if (!text) return;
    this.texts.push({ x, y, h, text, align, layer });
    const w = text.length * h * 0.55;
    const x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    this.touch(x0, y);
    this.touch(x0 + w, y + h);
  }

  rect(x: number, y: number, w: number, h: number, layer = "SHOP") {
    this.line(x, y, x + w, y, layer);
    this.line(x + w, y, x + w, y + h, layer);
    this.line(x + w, y + h, x, y + h, layer);
    this.line(x, y + h, x, y, layer);
  }

  dashV(x: number, y1: number, y2: number, on = 3.2, off = 2.4, layer = "AXIS") {
    const top = Math.min(y1, y2);
    const bot = Math.max(y1, y2);
    for (let y = top; y < bot; y += on + off) {
      this.line(x, y, x, Math.min(y + on, bot), layer);
    }
  }

  boundsFrom(ents: CadPrimitives) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const touch = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };
    for (const e of ents.lines) {
      touch(e.x1, e.y1);
      touch(e.x2, e.y2);
    }
    for (const e of ents.circles) {
      touch(e.x - e.r, e.y - e.r);
      touch(e.x + e.r, e.y + e.r);
    }
    for (const e of ents.arcs) {
      touch(e.x - e.r, e.y - e.r);
      touch(e.x + e.r, e.y + e.r);
    }
    for (const e of ents.texts) {
      const w = e.text.length * e.h * 0.55;
      const x0 = e.align === "center" ? e.x - w / 2 : e.align === "right" ? e.x - w : e.x;
      touch(x0, e.y);
      touch(x0 + w, e.y + e.h);
    }
    if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const pad = 20;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }

  /** Flip Y-down drawing coords to CAD Y-up. */
  toCadPrimitives(): CadPrimitives {
    const pad = 20;
    const y0 = Number.isFinite(this.maxY) ? this.maxY + pad : 0;
    const flip = (y: number) => y0 - y;
    return {
      lines: this.lines.map((e) => ({ ...e, y1: flip(e.y1), y2: flip(e.y2) })),
      circles: this.circles.map((e) => ({ ...e, y: flip(e.y) })),
      texts: this.texts.map((e) => ({ x: e.x, y: flip(e.y), h: e.h, text: e.text.replace(/\n/g, " "), align: e.align, layer: e.layer })),
      arcs: this.arcs.map((e) => ({ ...e, y: flip(e.y) })),
    };
  }

  toString(): string {
    const ents = this.toCadPrimitives();
    const box = this.boundsFrom(ents);
    const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
    const p = (...rows: (string | number)[]) => rows.join("\n");
    const layers = ["0", "SHOP", "AXIS", "DIM", "TEXT", "TITLE", "TABLE"];
    const chunks: string[] = [
      p(
        0,
        "SECTION",
        2,
        "HEADER",
        9,
        "$ACADVER",
        1,
        "AC1027",
        9,
        "$DWGCODEPAGE",
        3,
        "ANSI_1258",
        9,
        "$INSUNITS",
        70,
        4,
        9,
        "$MEASUREMENT",
        70,
        1,
        9,
        "$TILEMODE",
        70,
        1,
        9,
        "$EXTMIN",
        10,
        f(box.minX),
        20,
        f(box.minY),
        30,
        0,
        9,
        "$EXTMAX",
        10,
        f(box.maxX),
        20,
        f(box.maxY),
        30,
        0,
        9,
        "$LIMMIN",
        10,
        f(box.minX),
        20,
        f(box.minY),
        9,
        "$LIMMAX",
        10,
        f(box.maxX),
        20,
        f(box.maxY),
        9,
        "$HANDSEED",
        5,
        "FFFF",
        0,
        "ENDSEC",
      ),
      p(0, "SECTION", 2, "TABLES"),
      p(0, "TABLE", 2, "VPORT", 5, "8", 100, "AcDbSymbolTable", 70, 1),
      p(
        0,
        "VPORT",
        5,
        "31",
        100,
        "AcDbSymbolTableRecord",
        100,
        "AcDbViewportTableRecord",
        2,
        "*Active",
        70,
        0,
        10,
        0,
        20,
        0,
        11,
        1,
        21,
        1,
        12,
        f((box.minX + box.maxX) / 2),
        22,
        f((box.minY + box.maxY) / 2),
        40,
        f(Math.max(box.maxY - box.minY, 1)),
        41,
        1.5,
        42,
        50,
        43,
        0,
        44,
        0,
        50,
        0,
        51,
        0,
        71,
        0,
        72,
        100,
        73,
        1,
        74,
        3,
        75,
        0,
        76,
        0,
        77,
        0,
        78,
        0,
      ),
      p(0, "ENDTAB"),
      p(0, "TABLE", 2, "LTYPE", 5, "1", 100, "AcDbSymbolTable", 70, 1, 0, "LTYPE", 5, "2", 100, "AcDbSymbolTableRecord", 100, "AcDbLinetypeTableRecord", 2, "CONTINUOUS", 70, 0, 3, "Solid", 72, 65, 73, 0, 40, 0, 0, "ENDTAB"),
      p(0, "TABLE", 2, "LAYER", 5, "3", 100, "AcDbSymbolTable", 70, layers.length),
    ];
    layers.forEach((name, i) => {
      chunks.push(
        p(0, "LAYER", 5, (16 + i).toString(16).toUpperCase(), 100, "AcDbSymbolTableRecord", 100, "AcDbLayerTableRecord", 2, name, 70, 0, 62, CAD_LAYER_COLOR[name] ?? 250, 6, "CONTINUOUS"),
      );
    });
    chunks.push(p(0, "ENDTAB"));
    chunks.push(
      p(
        0,
        "TABLE",
        2,
        "STYLE",
        5,
        "4",
        100,
        "AcDbSymbolTable",
        70,
        1,
        0,
        "STYLE",
        5,
        "5",
        100,
        "AcDbSymbolTableRecord",
        100,
        "AcDbTextStyleTableRecord",
        2,
        "STANDARD",
        70,
        0,
        40,
        0,
        41,
        1,
        50,
        0,
        71,
        0,
        42,
        2.5,
        3,
        "txt",
        4,
        "",
        0,
        "ENDTAB",
      ),
    );
    chunks.push(
      p(
        0,
        "TABLE",
        2,
        "BLOCK_RECORD",
        5,
        "6",
        100,
        "AcDbSymbolTable",
        70,
        2,
        0,
        "BLOCK_RECORD",
        5,
        "1F",
        100,
        "AcDbSymbolTableRecord",
        100,
        "AcDbBlockTableRecord",
        2,
        "*MODEL_SPACE",
        0,
        "BLOCK_RECORD",
        5,
        "1B",
        100,
        "AcDbSymbolTableRecord",
        100,
        "AcDbBlockTableRecord",
        2,
        "*PAPER_SPACE",
        0,
        "ENDTAB",
      ),
    );
    chunks.push(p(0, "ENDSEC"));
    chunks.push(p(0, "SECTION", 2, "BLOCKS"));
    chunks.push(
      p(0, "BLOCK", 5, "20", 100, "AcDbEntity", 8, "0", 100, "AcDbBlockBegin", 2, "*MODEL_SPACE", 70, 0, 10, 0, 20, 0, 30, 0, 3, "*MODEL_SPACE", 1, "", 0, "ENDBLK", 5, "21", 100, "AcDbEntity", 8, "0", 100, "AcDbBlockEnd"),
    );
    chunks.push(
      p(0, "BLOCK", 5, "22", 100, "AcDbEntity", 8, "0", 100, "AcDbBlockBegin", 2, "*PAPER_SPACE", 70, 0, 10, 0, 20, 0, 30, 0, 3, "*PAPER_SPACE", 1, "", 0, "ENDBLK", 5, "23", 100, "AcDbEntity", 8, "0", 100, "AcDbBlockEnd"),
    );
    chunks.push(p(0, "ENDSEC"));
    chunks.push(p(0, "SECTION", 2, "ENTITIES"));
    let handle = 64;
    const nextH = () => {
      handle += 1;
      return handle.toString(16).toUpperCase();
    };
    for (const e of ents.lines) {
      chunks.push(
        p(0, "LINE", 5, nextH(), 330, "1F", 100, "AcDbEntity", 8, e.layer, 62, CAD_LAYER_COLOR[e.layer] ?? 250, 100, "AcDbLine", 10, f(e.x1), 20, f(e.y1), 30, 0, 11, f(e.x2), 21, f(e.y2), 31, 0),
      );
    }
    for (const e of ents.circles) {
      chunks.push(p(0, "CIRCLE", 5, nextH(), 330, "1F", 100, "AcDbEntity", 8, e.layer, 62, CAD_LAYER_COLOR[e.layer] ?? 250, 100, "AcDbCircle", 10, f(e.x), 20, f(e.y), 30, 0, 40, f(e.r)));
    }
    for (const e of ents.arcs) {
      chunks.push(
        p(0, "ARC", 5, nextH(), 330, "1F", 100, "AcDbEntity", 8, e.layer, 62, CAD_LAYER_COLOR[e.layer] ?? 250, 100, "AcDbArc", 10, f(e.x), 20, f(e.y), 30, 0, 40, f(e.r), 50, f(e.start), 51, f(e.end)),
      );
    }
    for (const e of ents.texts) {
      const ha = e.align === "center" ? 1 : e.align === "right" ? 2 : 0;
      chunks.push(
        p(
          0,
          "TEXT",
          5,
          nextH(),
          330,
          "1F",
          100,
          "AcDbEntity",
          8,
          e.layer,
          62,
          CAD_LAYER_COLOR[e.layer] ?? 250,
          100,
          "AcDbText",
          10,
          f(e.x),
          20,
          f(e.y),
          30,
          0,
          40,
          f(e.h),
          1,
          e.text,
          50,
          0,
          7,
          "STANDARD",
          72,
          ha,
          11,
          f(e.x),
          21,
          f(e.y),
          31,
          0,
          100,
          "AcDbText",
          73,
          0,
        ),
      );
    }
    chunks.push(p(0, "ENDSEC"));
    chunks.push(p(0, "SECTION", 2, "OBJECTS", 0, "DICTIONARY", 5, "C", 100, "AcDbDictionary", 281, 1, 3, "ACAD_GROUP", 350, "D", 0, "DICTIONARY", 5, "D", 100, "AcDbDictionary", 281, 1, 0, "ENDSEC"));
    chunks.push(p(0, "EOF"));
    return chunks.join("\n") + "\n";
  }
}

async function saveCadFile(data: BlobPart, filename: string) {
  const file = new File([data], filename, { type: "application/octet-stream" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function" && typeof nav.canShare === "function") {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export async function downloadTextFile(text: string, filename: string) {
  await saveCadFile(text, filename);
}

export async function downloadBinaryFile(data: Uint8Array, filename: string) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  await saveCadFile(copy, filename);
}
