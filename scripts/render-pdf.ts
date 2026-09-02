import { readFileSync, writeFileSync } from "node:fs";
import { generateBeamPdf } from "../lib/pdf/generate";
import { createSampleD1 } from "../lib/sample";
import { uid } from "../lib/utils";
import type { BeamProject } from "../lib/types";

function demoProject(): BeamProject {
  const p = createSampleD1();
  const last = p.spans.length;
  p.info.name = "D1";
  p.info.quantity = 1;
  p.mainTop = [{ id: uid("mt"), dia: 16, qty: 3, startAxis: 0, endAxis: last }];
  p.mainBottom = [{ id: uid("mb"), dia: 16, qty: 3, startAxis: 0, endAxis: last }];
  p.extraTop = p.supports.map((_, i) => ({
    id: uid("et"),
    layer: 1,
    dia: 18,
    qty: 2,
    startAxis: i,
    endAxis: i,
    startType: 1 as const,
    endType: 1 as const,
  }));
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
  p.stirrups = p.stirrups.map((s) => ({ ...s, dia: 8, a1: 150, a2: 200, layout: "1/4" as const }));
  p.supports = p.supports.map((s, i) => ({ ...s, axisName: String.fromCharCode(65 + i), B: 220, B1: 110 }));
  return p;
}

async function main() {
  const regular = readFileSync("public/fonts/BeVietnamPro-Regular.ttf");
  const bold = readFileSync("public/fonts/BeVietnamPro-Bold.ttf");
  const bytes = await generateBeamPdf(demoProject(), {
    regular: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength),
    bold: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength),
  });
  const out = process.argv[2] || "/tmp/out-shop.pdf";
  writeFileSync(out, bytes);
  console.log("wrote", out, bytes.byteLength);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
