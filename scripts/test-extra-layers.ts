import {
  barClearGapMm,
  mainBarClearance,
  mainBarClearanceFor,
  mainLayerClearanceOk,
  MIN_MAIN_CLEAR_BOTTOM_MM,
  MIN_MAIN_CLEAR_TOP_MM,
} from "../lib/bar-clearance";
import {
  computeModel,
  extraBarXsInSection,
  extraLayerOffsetMm,
  extrasBetweenMains,
  extrasForSpanSection,
  mainsQtyForSpan,
  STOCK_BAR_MM,
} from "../lib/calc";
import {
  ANTI_BUCKLING_END_COVER_MM,
  ANTI_BUCKLING_LAP_MULTIPLE,
  antiBucklingResolvedBars,
  antiBucklingRunEnds,
  antiBucklingSchedule,
  doubleShortSideMm,
  doubleWrapCount,
  extraCDiaOf,
  extraCDirs,
  extraCSpacingOf,
  extraDoubleDiaOf,
  extraNestedDiaOf,
  extraNestedDirs,
  extraTieAllowC,
  extraTieAllowNested,
  extraTieFlagsForSpan,
  nestedHoopFromBarXs,
  nestedWrapRange,
  normalizeAntiBucklingRange,
  normalizeAntiBucklingSegments,
  normalizeExtraTieDia,
} from "../lib/extra-ties";
import { createEmptyProject, syncGeometry } from "../lib/sample";
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

const empty = syncGeometry(createEmptyProject(), 1);
assert(empty.info.elevation === 4.2, "cao độ dầm mặc định 4.2 m");
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
assert(!extraTieAllowNested(empty), "chưa có đủ thép chủ trên + dưới");
const with3 = {
  ...empty,
  mainTop: [{ id: "t3", qty: 3, dia: 18, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
  mainBottom: [{ id: "m", qty: 3, dia: 18, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
};
assert(!extraTieAllowNested(with3), "3 thanh chủ — chưa hiện lồng/kép");
const with4botOnly = {
  ...empty,
  mainBottom: [{ id: "m", qty: 4, dia: 18, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
};
assert(!extraTieAllowNested(with4botOnly), "chỉ lớp dưới 4 — cần lớp trên bằng lớp dưới");
const withUneven = {
  ...empty,
  mainTop: [{ id: "t", qty: 4, dia: 18, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
  mainBottom: [{ id: "m", qty: 2, dia: 18, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
};
assert(!extraTieAllowNested(withUneven), "trên 4 dưới 2 — không đai lồng/kép");
const with4 = {
  ...empty,
  mainTop: [{ id: "t", qty: 4, dia: 18, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
  mainBottom: [{ id: "m", qty: 4, dia: 18, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
};
assert(extraTieAllowNested(with4), "trên = dưới = 4 — hiện đai lồng/kép");

assert(MIN_MAIN_CLEAR_BOTTOM_MM === 25 && MIN_MAIN_CLEAR_TOP_MM === 50, "min clear 25/50");
assert(Math.abs(barClearGapMm(150, 4, 16) - 28.666) < 0.01, "4Ø16 trong 150: hở ~28.7");
assert(mainBarClearance(200, 25, 4, 16, "bottom").ok, "lớp dưới 4Ø16 B200 ≥ 25");
assert(!mainBarClearance(200, 25, 4, 16, "top").ok, "lớp trên 4Ø16 B200 < 50");
assert(mainBarClearance(200, 25, 3, 16, "top").ok, "lớp trên 3Ø16 B200 ≥ 50");
assert(!mainBarClearance(200, 25, 6, 16, "bottom").ok, "lớp dưới 6Ø16 B200 < 25");
assert(mainBarClearance(300, 25, 4, 16, "top").ok, "lớp trên 4Ø16 B300 ≥ 50");
const tightTop = {
  ...empty,
  spans: empty.spans.map((s) => ({ ...s, B: 200 })),
  mainTop: [{ id: "t16", qty: 4, dia: 16, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
  mainBottom: [{ id: "b16", qty: 4, dia: 16, startAxis: 0, endAxis: 1, autoCut: false, lapMultiple: 40 as const }],
};
assert(mainLayerClearanceOk(tightTop, "bottom"), "B200 4Ø16 dưới đạt");
assert(!mainLayerClearanceOk(tightTop, "top"), "B200 4Ø16 trên không đạt");
assert(!extraTieAllowNested(tightTop), "lồng/kép tắt khi lớp trên hẹp hơn 50 mm");
assert(!mainBarClearanceFor(tightTop, tightTop.mainTop[0], "top").ok, "clearanceFor top");
const wrap4 = nestedWrapRange(4);
assert(wrap4.start === 1 && wrap4.end === 2 && wrap4.wrap === 2, "lồng 4 thanh ôm 2 thanh giữa");
const hoop4 = nestedHoopFromBarXs([0, 50, 100, 150], 5);
assert(Math.abs(hoop4.x - 45) < 1e-6 && Math.abs(hoop4.width - 60) < 1e-6, "khung lồng ôm mép ngoài 2 thanh giữa");

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
assert(!kinds.includes("nested-cy"), "lồng không bố trí Cy");
assert(extraNestedDirs().cx && !extraNestedDirs().cy, "lồng chỉ Cx");
assert(extraTieFlagsForSpan(shop, 0).extraNestedCx, "flags lồng Cx");
assert(!extraTieFlagsForSpan(shop, 0).extraNestedCy, "flags không lồng Cy");
assert(kinds.includes("anti"), "schedule chống phình");
assert(model.schedule.some((r) => r.extraKind === "c-cx" && r.dia === 8), "C Ø8");
assert(model.schedule.some((r) => r.extraKind === "nested-cx" && r.dia === 10), "lồng Ø10");
assert(model.schedule.some((r) => r.extraKind === "anti" && r.dia === 12), "CP Ø12");
const cpBars = antiBucklingResolvedBars(shop);
const shopCp = antiBucklingRunEnds(shop, 0, shop.spans.length);
assert(ANTI_BUCKLING_END_COVER_MM === 50, "CP lùi 50 mm từ da");
assert(cpBars.length === shop.spans.length, "CP trên từng nhịp");
assert(
  cpBars.every((b) => b.qty === 2 && b.dia === 12 && b.cutLength === shopCp.lengthMm),
  "CP 2Ø12 gối 1 / hết dầm lùi 50 mm từ da",
);
assert(Math.round(cpBars[0].x1) === Math.round(shopCp.x1), "CP đầu gối 1 = da + 50");
assert(Math.round(cpBars[0].x2) === Math.round(shopCp.x2), "CP cuối dầm = da − 50");
const twoLen = createEmptyProject();
twoLen.spans = [
  { ...twoLen.spans[0], L: 4250 },
  { ...twoLen.spans[0], id: "span-b", L: 5000 },
];
twoLen.supports = [
  twoLen.supports[0],
  twoLen.supports[1],
  { ...twoLen.supports[1], id: "sup-c", axisName: "2" },
];
twoLen.stirrups = [
  { ...twoLen.stirrups[0], antiBuckling: true, antiBucklingDia: 12 },
  { ...twoLen.stirrups[0], antiBuckling: true, antiBucklingDia: 12 },
];
const twoModel = computeModel(twoLen);
const antis = twoModel.schedule.filter((r) => r.extraKind === "anti");
assert(antis.length === 2, "CP hai chiều dài nhịp");
assert(antis[0].markNum === antis[1].markNum, "cùng Ø cùng số hiệu gốc");
assert(antis[0].mark !== antis[1].mark && /[a-z]$/.test(antis[0].mark) && /[a-z]$/.test(antis[1].mark), "tách số hiệu a/b");
assert(new Set(antis.map((r) => r.barLength)).size === 2, "vẫn tách L trên thống kê");
assert(normalizeAntiBucklingSegments(2) === 2 && normalizeAntiBucklingSegments(9) === 1, "số đoạn 1/2/3");

const pack2 = {
  ...twoLen,
  stirrups: twoLen.stirrups.map((s) => ({ ...s, antiBuckling: true, antiBucklingSegments: 2 as const })),
};
const bars2 = antiBucklingResolvedBars(pack2);
const pack2Len = antiBucklingRunEnds(pack2, 0, 2).lengthMm;
assert(bars2.length === 1 && bars2[0].cutLength === pack2Len, "2 đoạn hết dầm: da gối 1 → da gối cuối, mỗi đầu 50 mm");
assert(pack2Len === 9350, "2 đoạn 4250+5000, B1=100: 9350");

const pack3 = createEmptyProject();
pack3.spans = [
  { ...pack3.spans[0], L: 4250 },
  { ...pack3.spans[0], id: "span-b", L: 4250 },
  { ...pack3.spans[0], id: "span-c", L: 5000 },
];
pack3.supports = [
  pack3.supports[0],
  pack3.supports[1],
  { ...pack3.supports[1], id: "sup-c", axisName: "2" },
  { ...pack3.supports[1], id: "sup-d", axisName: "3" },
];
pack3.stirrups = [
  { ...pack3.stirrups[0], antiBuckling: true, antiBucklingDia: 12, antiBucklingSegments: 3 },
  { ...pack3.stirrups[0], antiBuckling: false },
  { ...pack3.stirrups[0], antiBuckling: false },
];
const bars3 = antiBucklingResolvedBars(pack3);
const pack3Len = antiBucklingRunEnds(pack3, 0, 3).lengthMm;
const pack3Lap = ANTI_BUCKLING_LAP_MULTIPLE * 12;
assert(pack3Len === 13600, "3 đoạn 4250+4250+5000, B1=100: 13600");
assert(bars3.length === 2, "CP > 11,7 m tự cắt 2 đoạn");
assert(bars3[0].cutLength === STOCK_BAR_MM && bars3[0].spliceLapMm === pack3Lap, "cây đầu 11700, nối 30D");
assert(bars3[1].cutLength === pack3Len - (STOCK_BAR_MM - pack3Lap), "cây cuối = phần còn lại");
assert(extraTieFlagsForSpan(pack3, 2).antiBuckling, "nhịp trong khoảng 3 đoạn vẫn có CP");
const longCp = syncGeometry(createEmptyProject(), 1);
longCp.spans = [{ ...longCp.spans[0], L: 20000 }];
longCp.supports = [longCp.supports[0], { ...longCp.supports[1], id: "sup-end" }];
longCp.stirrups = [{ ...longCp.stirrups[0], antiBuckling: true, antiBucklingDia: 12 }];
const longBars = antiBucklingResolvedBars(longCp);
const longNeed = antiBucklingRunEnds(longCp, 0, 1).lengthMm;
assert(longNeed > STOCK_BAR_MM && longBars.length === 2, "dầm dài 20 m cắt 2 cây");
assert(longBars[0].cutLength === 11700 && longBars[1].cutLength === longNeed - (11700 - 360), "11700 + đoạn còn lại, nối 360");
assert(antiBucklingSchedule(longCp).every((s) => s.qtyEach === 2), "mỗi đoạn cắt vẫn 2Ø");
const longSched = computeModel(longCp).schedule.filter((r) => r.extraKind === "anti");
assert(longSched.length === 2, "thống kê tách 2 đoạn cắt");
assert(longSched[0].mark.endsWith("a") && longSched[1].mark.endsWith("b"), "số hiệu Xa / Xb");
assert(longSched[0].markNum === longSched[1].markNum, "Xa Xb cùng số gốc");
assert(longSched[0].barLength === 11700 && longSched[0].bars.length > 0, "hàng 11700 gắn thanh shop");
assert(longBars[0].spliceLapMm === 360, "shop nối 30D=360");

const oneCp = syncGeometry(createEmptyProject(), 1);
oneCp.stirrups[0] = { ...oneCp.stirrups[0], antiBuckling: true, antiBucklingDia: 12 };
const oneBar = antiBucklingResolvedBars(oneCp)[0];
assert(oneBar.x1 === -50 && oneBar.x2 === 6550 && oneBar.cutLength === 6600, "1 nhịp mặc định: da+50 → da−50");
const oneSched = computeModel(oneCp).schedule.filter((r) => r.extraKind === "anti");
assert(oneSched.length === 1 && oneSched[0].mark.endsWith("a") && oneSched[0].qtyEach === 2, "một kích thước → Xa, 2 cây");

const twin = syncGeometry(createEmptyProject(), 2);
twin.spans = twin.spans.map((s) => ({ ...s, L: 6500 }));
twin.stirrups = twin.stirrups.map((s) => ({
  ...s,
  antiBuckling: true,
  antiBucklingDia: 12,
  antiBucklingStartAxis: undefined,
  antiBucklingEndAxis: undefined,
  antiBucklingSegments: 1 as const,
}));
const twinBars = antiBucklingResolvedBars(twin);
const twinLens = twinBars.map((b) => Math.round(b.cutLength));
assert(twinLens.length === 2 && twinLens[0] === twinLens[1], "hai nhịp cùng L → cùng chiều dài CP");
const twinSched = computeModel(twin).schedule.filter((r) => r.extraKind === "anti");
assert(twinSched.length === 1 && twinSched[0].mark.endsWith("a"), "cùng kích thước → một số hiệu Xa");
assert(twinSched[0].qtyEach === 4, "2 cây × 2 đoạn cùng L = 4 trên hàng Xa");

const manyStock = syncGeometry(createEmptyProject(), 1);
manyStock.spans = [{ ...manyStock.spans[0], L: 35000 }];
manyStock.stirrups[0] = { ...manyStock.stirrups[0], antiBuckling: true, antiBucklingDia: 12 };
const manyBars = antiBucklingResolvedBars(manyStock);
const stockPieces = manyBars.filter((b) => Math.round(b.cutLength) === STOCK_BAR_MM);
assert(stockPieces.length >= 3, "dầm rất dài: ≥3 cây 11700");
const manySched = computeModel(manyStock).schedule.filter((r) => r.extraKind === "anti");
const xa11700 = manySched.filter((r) => r.barLength === STOCK_BAR_MM);
assert(xa11700.length === 1 && xa11700[0].mark.endsWith("a"), "mọi cây 11700 dùng chung Xa");
assert(xa11700[0].qtyEach === stockPieces.length * 2, "SL Xa = số đoạn 11700 × 2");
assert(manySched.filter((r) => r.barLength !== STOCK_BAR_MM).every((r) => r.mark.endsWith("b")), "đoạn còn lại khác L → Xb");

const midOnly = { ...pack3 };
midOnly.stirrups = pack3.stirrups.map((s, i) => ({
  ...s,
  antiBuckling: i === 1,
  antiBucklingSegments: 1 as const,
}));
const midBar = antiBucklingResolvedBars(midOnly)[0];
assert(midBar.x1 === 4250 && midBar.x2 === 8500 && midBar.cutLength === 4250, "nhịp giữa: tim → tim");

const ranged = { ...pack3 };
ranged.stirrups = pack3.stirrups.map((s, i) => ({
  ...s,
  antiBuckling: i === 0,
  antiBucklingStartAxis: 0,
  antiBucklingEndAxis: 2,
  antiBucklingSegments: 1 as const,
}));
const rangedBar = antiBucklingResolvedBars(ranged);
const rangedGeo = antiBucklingRunEnds(ranged, 0, 2);
assert(rangedBar.length >= 1 && rangedBar[0].x1 === rangedGeo.x1 && Math.round(rangedBar[rangedBar.length - 1].x2) === Math.round(rangedGeo.x2), "CP theo trục 1→3");
assert(normalizeAntiBucklingRange(ranged.stirrups[0], 0, 3).end === 2, "range 0→2");

const grow = syncGeometry(createEmptyProject(), 1);
grow.stirrups[0] = { ...grow.stirrups[0], antiBuckling: true, antiBucklingStartAxis: 0, antiBucklingEndAxis: 1 };
const grown = syncGeometry(grow, 5);
assert(grown.stirrups[0].antiBucklingEndAxis === 5, "đổi số nhịp: kết thúc CP theo trục cuối");
assert(normalizeAntiBucklingRange({ antiBucklingStartAxis: 0 }, 0, 5).end === 5, "thiếu end → trục cuối");

assert(doubleWrapCount(4) === 3, "kép ôm 2/3 của 4 thanh = 3");
assert(doubleWrapCount(6) === 4, "kép ôm 2/3 của 6 thanh = 4");
assert(doubleShortSideMm(150, 4, 18) === 106, "cạnh ngắn ôm ngoài 3Ø18 trên B0=150");
const kep = {
  ...with4,
  spans: with4.spans.map((s) => ({ ...s, B: 300 })),
  stirrups: with4.stirrups.map((s) => ({
    ...s,
    extraDouble: true,
    extraDoubleDia: 8,
    extraDoubleSpacing: 200,
  })),
};
const kepModel = computeModel(kep);
assert(!kepModel.schedule.some((r) => r.family === "D" && !r.extraKind), "kép bỏ đai đơn khỏi thống kê");
const kepRow = kepModel.schedule.find((r) => r.extraKind === "double");
assert(kepRow && kepRow.segs[0] === doubleShortSideMm(250, 4, 18), "kép cạnh ngắn ôm ngoài");
assert(kepRow && kepRow.qtyEach === kepModel.stirrups.replacedDoubleStations * 2, "kép 2 đai / vị trí");
assert(kepModel.stirrups.replacedDoubleStations > 0, "vị trí đai đơn chuyển sang kép");
assert(kepModel.stirrups.countEach === 0, "không thống kê đai đơn");

console.log("extra-layer tests ok");
