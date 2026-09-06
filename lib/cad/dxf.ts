/** Shop drawing primitives. 1 unit = 1 mm. DXF is AC1027 UTF-8; DWG shares the same entities. */

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
    const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
    const p = (...rows: (string | number)[]) => rows.join("\n");
    const chunks: string[] = [
      p(0, "SECTION", 2, "HEADER", 9, "$ACADVER", 1, "AC1027", 9, "$INSUNITS", 70, 4, 9, "$HANDSEED", 5, "FFFF", 0, "ENDSEC"),
      p(0, "SECTION", 2, "TABLES"),
      p(0, "TABLE", 2, "LTYPE", 5, "1", 100, "AcDbSymbolTable", 70, 1, 0, "LTYPE", 5, "2", 100, "AcDbSymbolTableRecord", 100, "AcDbLinetypeTableRecord", 2, "CONTINUOUS", 70, 0, 3, "Solid", 72, 65, 73, 0, 40, 0, 0, "ENDTAB"),
      p(0, "TABLE", 2, "LAYER", 5, "3", 100, "AcDbSymbolTable", 70, 6),
    ];
    const layers = ["0", "SHOP", "AXIS", "DIM", "TEXT", "TITLE", "TABLE"];
    layers.forEach((name, i) => {
      chunks.push(
        p(0, "LAYER", 5, (16 + i).toString(16).toUpperCase(), 100, "AcDbSymbolTableRecord", 100, "AcDbLayerTableRecord", 2, name, 70, 0, 62, name === "AXIS" ? 8 : name === "DIM" ? 1 : name === "TITLE" ? 5 : 7, 6, "CONTINUOUS"),
      );
    });
    chunks.push(p(0, "ENDTAB", 0, "ENDSEC"));
    chunks.push(p(0, "SECTION", 2, "ENTITIES"));
    let handle = 64;
    const nextH = () => {
      handle += 1;
      return handle.toString(16).toUpperCase();
    };
    for (const e of ents.lines) {
      chunks.push(
        p(0, "LINE", 5, nextH(), 100, "AcDbEntity", 8, e.layer, 100, "AcDbLine", 10, f(e.x1), 20, f(e.y1), 30, 0, 11, f(e.x2), 21, f(e.y2), 31, 0),
      );
    }
    for (const e of ents.circles) {
      chunks.push(p(0, "CIRCLE", 5, nextH(), 100, "AcDbEntity", 8, e.layer, 100, "AcDbCircle", 10, f(e.x), 20, f(e.y), 30, 0, 40, f(e.r)));
    }
    for (const e of ents.arcs) {
      chunks.push(
        p(0, "ARC", 5, nextH(), 100, "AcDbEntity", 8, e.layer, 100, "AcDbArc", 10, f(e.x), 20, f(e.y), 30, 0, 40, f(e.r), 50, f(e.start), 51, f(e.end)),
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
          100,
          "AcDbEntity",
          8,
          e.layer,
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
          72,
          ha,
          11,
          f(e.x),
          21,
          f(e.y),
          31,
          0,
        ),
      );
    }
    chunks.push(p(0, "ENDSEC", 0, "EOF"));
    return chunks.join("\n") + "\n";
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadTextFile(text: string, filename: string, mime = "application/dxf") {
  triggerDownload(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export function downloadBinaryFile(data: Uint8Array, filename: string, mime: string) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  triggerDownload(new Blob([copy], { type: mime }), filename);
}
