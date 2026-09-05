import {
  computeModel,
  extraBarXsInSection,
  extraLayerOffsetMm,
  extrasBetweenMains,
  extrasForSpanSection,
  mainsQtyForSpan,
} from "../lib/calc";
import {
  antiBucklingSchedule,
  extraCDiaOf,
  extraCDirs,
  extraCSpacingOf,
  extraDoubleDiaOf,
  extraNestedDiaOf,
  extraTieAllowC,
  extraTieAllowNested,
  normalizeExtraTieDia,
} from "../lib/extra-ties";
import { createEmptyProject } from "../lib/sample";
import type { ExtraBar } from "../lib/types";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function nearly(a: number[], b: number[], eps = 1e-6) {
  assert(a.length === b.length, `len ${a.length} != ${b.length}`);
  a.forEach((v, i) => assert(Math.abs(v - b[i]) < eps, `${v} != ${b[i]} at ${i}`));
}

assert(extraLayerOffsetMm(1) === 0, "L1 offset 0");
assert(extraLayerOffsetMm(2) === 25, "L2 offset 25");
assert(extraLayerOffsetMm(3) === 50, "L3 offset 50");

const mains2 = [0, 100];
nearly(extrasBetweenMains(mains2, 1), [50]);
nearly(extrasBetweenMains(mains2, 2), [100 / 3, 200 / 3]);

const mains3 = [0, 50, 100];
nearly(extrasBetweenMains(mains3, 2), [25, 75]);
nearly(extrasBetweenMains(mains3, 1), [25]);

const l1 = extraBarXsInSection(0, 100, 1, 1, mains2);
nearly(l1, [50]);
const l2 = extraBarXsInSection(0, 100, 2, 2, mains2);
nearly(l2, [0, 100]);

const bot: ExtraBar[] = [
  { id: "b", layer: 1, dia: 20, qty: 1, startAxis: 0, endAxis: 1, startType: 1, endType: 1 },
];
const top: ExtraBar[] = [
  { id: "t", layer: 2, dia: 20, qty: 2, startAxis: 1, endAxis: 1, startType: 1, endType: 1 },
];
assert(extrasForSpanSection(bot, 0, "bottom").map((b) => b.id).join() === "b", "bottom span 0");
assert(extrasForSpanSection(bot, 1, "bottom").length === 0, "bottom misses span 1");
assert(extrasForSpanSection(top, 0, "top").map((b) => b.id).join() === "t", "top at support 1 hits span 0");
assert(extrasForSpanSection(top, 1, "top").map((b) => b.id).join() === "t", "top at support 1 hits span 1");
assert(extrasForSpanSection(top, 2, "top").length === 0, "top misses span 2");
assert(mainsQtyForSpan([{ qty: 3, startAxis: 0, endAxis: 2 }], 1, "bottom") === 3, "mains qty");
assert(mainsQtyForSpan([{ qty: 3, startAxis: 0, endAxis: 1 }], 1, "bottom") === 0, "mains miss span 1");

const empty = createEmptyProject();
assert(!extraTieAllowC(empty, 0), "C off without odd mains or skin");
empty.stirrups[0] = { ...empty.stirrups[0], antiBuckling: true, extraC: true, antiBucklingDia: 12 };
assert(extraTieAllowC(empty, 0), "C allowed with chống phình");
const skin = antiBucklingSchedule(empty);
assert(skin.length === 1 && skin[0].qtyEach === 2 && skin[0].dia === 12, "2Ø12 chống phình");
assert(extraCSpacingOf(undefined) === 200, "C spacing default");
assert(extraCDirs({ extraCCx: false, extraCCy: false } as never).cx && extraCDirs({ extraCCx: false, extraCCy: false } as never).cy, "keep one dir");
assert(extraCDirs({ extraCCx: true, extraCCy: false } as never).cy === false, "Cy can be off");

assert(!extraTieAllowNested(empty), "lồng/kép ẩn khi chưa có thép chủ");
empty.spans[0] = { ...empty.spans[0], B: 400 };
assert(!extraTieAllowNested(empty), "B rộng không đủ — cần ≥ 4 thanh chủ");
const with3 = {
  ...empty,
  mainBottom: [{ id: "m", qty: 3, dia: 18, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
};
assert(!extraTieAllowNested(with3), "3 thanh chủ — chưa hiện lồng/kép");
const with4 = {
  ...empty,
  mainBottom: [{ id: "m", qty: 4, dia: 18, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
};
assert(extraTieAllowNested(with4), "4 thanh chủ — hiện đai lồng/kép");

assert(normalizeExtraTieDia(10) === 10, "Ø10 ok");
assert(normalizeExtraTieDia(16, 8) === 8, "Ø16 invalid → fallback");
assert(normalizeExtraTieDia(undefined, 12) === 12, "empty → fallback");
assert(extraCDiaOf({ dia: 8 } as never) === 8, "C dia inherits stirrup");
assert(extraCDiaOf({ dia: 8, extraCDia: 14 } as never) === 14, "C dia override");
assert(extraNestedDiaOf({ extraNestedDia: 10 } as never) === 10, "nested dia");
assert(extraDoubleDiaOf({ extraDoubleDia: 6 } as never) === 6, "double dia");

const shop = {
  ...with4,
  stirrups: with4.stirrups.map((s) => ({
    ...s,
    extraC: true,
    extraCCx: true,
    extraCCy: true,
    extraCDia: 8,
    extraCSpacing: 200,
    extraNested: true,
    extraNestedCx: true,
    extraNestedCy: true,
    extraNestedDia: 10,
    extraNestedSpacing: 200,
    antiBuckling: true,
    antiBucklingDia: 12,
  })),
};
const model = computeModel(shop);
const kinds = model.schedule.map((r) => r.extraKind).filter(Boolean);
assert(kinds.includes("c-cx"), "schedule C-Cx");
assert(kinds.includes("c-cy"), "schedule C-Cy");
assert(kinds.includes("nested-cx"), "schedule lồng Cx");
assert(kinds.includes("nested-cy"), "schedule lồng Cy");
assert(kinds.includes("anti"), "schedule chống phình");
assert(model.schedule.some((r) => r.extraKind === "c-cx" && r.dia === 8), "C Ø8");
assert(model.schedule.some((r) => r.extraKind === "nested-cx" && r.dia === 10), "lồng Ø10");
assert(model.schedule.some((r) => r.extraKind === "anti" && r.dia === 12), "CP Ø12");

console.log("extra-layer tests ok");
