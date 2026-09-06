import { writeFileSync } from "node:fs";
import { generateBeamDwg } from "../lib/cad/dwg";
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

async function main() {
  const dxf = generateBeamDxf(p);
  if (!dxf.includes("0\nSECTION")) throw new Error("missing SECTION");
  if (!dxf.includes("0\nLINE")) throw new Error("missing LINE");
  if (!dxf.includes("0\nTEXT")) throw new Error("missing TEXT");
  if (!dxf.includes("BẢNG THỐNG KÊ CỐT THÉP")) throw new Error("missing schedule title");
  if (!dxf.includes("1-1")) throw new Error("missing section 1-1");
  if (!dxf.includes("0\nEOF")) throw new Error("missing EOF");
  writeFileSync("/tmp/shop-d1.dxf", dxf);

  const dwg = await generateBeamDwg(p);
  const magic = Buffer.from(dwg.subarray(0, 6)).toString();
  if (!magic.startsWith("AC10")) throw new Error(`not a DWG: ${magic}`);
  if (dwg.length < 2000) throw new Error("DWG too small");
  writeFileSync("/tmp/shop-d1.dwg", dwg);
  const { DwgReader } = await import("@node-projects/acad-ts");
  const copy = new ArrayBuffer(dwg.byteLength);
  new Uint8Array(copy).set(dwg);
  const read = DwgReader.readFromStream(copy);
  let n = 0;
  for (const _ of read.modelSpace?.entities ?? []) n += 1;
  if (n < 50) throw new Error(`DWG lost entities: ${n}`);
  const title = [...(read.modelSpace?.entities ?? [])].some(
    (e) => "value" in e && String((e as { value?: string }).value || "").includes("BẢNG THỐNG KÊ"),
  );
  if (!title) throw new Error("DWG missing Vietnamese schedule title");
  console.log("cad tests ok", dxf.length, "dxf bytes,", dwg.length, "dwg bytes,", n, "entities");
}

void main();
