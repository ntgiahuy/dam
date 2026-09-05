import { writeFileSync } from "node:fs";
import { generateBeamDxf } from "../lib/cad/generate";
import { createSampleD1 } from "../lib/sample";
import { uid } from "../lib/utils";

const p = createSampleD1();
p.mainTop = [{ id: uid("mt"), dia: 16, qty: 4, startAxis: 0, endAxis: p.spans.length }];
p.mainBottom = [{ id: uid("mb"), dia: 16, qty: 4, startAxis: 0, endAxis: p.spans.length }];
p.extraBottom = p.spans.map((_, i) => ({
  id: uid("eb"),
  layer: 1,
  dia: 18,
  qty: 2,
  startAxis: i,
  endAxis: i + 1,
  startType: 1 as const,
  endType: 1 as const,
}));

const dxf = generateBeamDxf(p);
if (!dxf.includes("0\nSECTION")) throw new Error("missing SECTION");
if (!dxf.includes("0\nLINE")) throw new Error("missing LINE");
if (!dxf.includes("0\nTEXT")) throw new Error("missing TEXT");
if (!dxf.includes("BẢNG THỐNG KÊ CỐT THÉP")) throw new Error("missing schedule title");
if (!dxf.includes("1-1")) throw new Error("missing section 1-1");
if (!dxf.includes("0\nEOF")) throw new Error("missing EOF");
writeFileSync("/tmp/shop-d1.dxf", dxf);
console.log("cad tests ok", dxf.length, "bytes");
