import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { BeamProject } from "../types";
import {
  barFamilyOf,
  barNotation,
  computeModel,
  extraBarXsInSection,
  extraLayerOffsetMm,
  stirrupZonesForSpan,
  supportFaces,
  supportGeometry,
  type ComputedModel,
  type ResolvedBar,
  type ScheduleRow,
} from "../calc";
import {
  antiBucklingResolvedBars,
  doubleHoopOffsetsMm,
  extraTieElevationNote,
  extraTieFlagsForSpan,
} from "../extra-ties";

const PAGE_W = 1684;
const PAGE_H = 1191;
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const STOCK_M = 11.7;
/** Visual scale for cross-sections (readable on A2; title still TL 1/25). */
const SECTION_SCALE = 0.24;

type Ctx = {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  project: BeamProject;
  model: ComputedModel;
  originX: number;
  scale: number;
};

function ty(yTop: number) {
  return PAGE_H - yTop;
}

function xAt(ctx: Ctx, mm: number) {
  return ctx.originX + mm * ctx.scale;
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w = 0.7) {
  ctx.page.drawLine({
    start: { x: x1, y: ty(y1) },
    end: { x: x2, y: ty(y2) },
    thickness: w,
    color: BLACK,
  });
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, t = 0.8) {
  ctx.page.drawRectangle({
    x,
    y: ty(y + h),
    width: w,
    height: h,
    borderColor: BLACK,
    borderWidth: t,
  });
}

function textSimple(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  size = 8,
  bold = false,
  align: "left" | "center" | "right" = "left",
) {
  const font = bold ? ctx.fontBold : ctx.font;
  const width = font.widthOfTextAtSize(str, size);
  let tx = x;
  if (align === "center") tx = x - width / 2;
  if (align === "right") tx = x - width;
  ctx.page.drawText(str, {
    x: tx,
    y: ty(y) - size * 0.78,
    size,
    font,
    color: BLACK,
  });
  return width;
}

const CAP_RATIO = 0.72;

function textCentered(
  ctx: Ctx,
  str: string,
  cx: number,
  cy: number,
  size: number,
  bold = false,
) {
  const font = bold ? ctx.fontBold : ctx.font;
  const width = font.widthOfTextAtSize(str, size);
  ctx.page.drawText(str, {
    x: cx - width / 2,
    y: ty(cy) - size * (CAP_RATIO / 2),
    size,
    font,
    color: BLACK,
  });
}

function textVertical(ctx: Ctx, str: string, cx: number, yMid: number, size = 11, bold = true) {
  const font = bold ? ctx.fontBold : ctx.font;
  const tw = font.widthOfTextAtSize(str, size);
  ctx.page.drawText(str, {
    x: cx + size * 0.28,
    y: ty(yMid) - tw / 2,
    size,
    font,
    color: BLACK,
    rotate: degrees(90),
  });
}

function circle(ctx: Ctx, cx: number, cy: number, r: number, fill = false) {
  ctx.page.drawEllipse({
    x: cx,
    y: ty(cy),
    xScale: r,
    yScale: r,
    borderColor: BLACK,
    borderWidth: fill ? 0 : 0.6,
    color: fill ? BLACK : undefined,
    rotate: degrees(0),
  });
}

function bubble(ctx: Ctx, cx: number, cy: number, r = 8) {
  ctx.page.drawEllipse({
    x: cx,
    y: ty(cy),
    xScale: r,
    yScale: r,
    color: WHITE,
    borderColor: BLACK,
    borderWidth: 0.75,
    rotate: degrees(0),
  });
}

function markCircle(ctx: Ctx, cx: number, cy: number, mark: string, r = 7) {
  const rr = Math.max(r, mark.length > 2 ? 8 : 6.4);
  bubble(ctx, cx, cy, rr);
  const size = Math.min(mark.length > 2 ? rr * 0.78 : rr * 0.95, 8.2);
  textCentered(ctx, mark, cx, cy, size);
}

function clampMark(n: number, lo: number, hi: number) {
  if (hi < lo) return (lo + hi) / 2;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Đặt số hiệu giữa thanh, rồi đẩy tách nếu hai vòng tròn chồng nhau.
 * Giữ mỗi số hiệu nằm trong đoạn [x1, x2] của đúng thanh đó.
 */
function placeBarMarks(
  bars: { x1: number; x2: number }[],
  radius: number,
  gap = 4,
): number[] {
  const minGap = radius * 2 + gap;
  const items = bars.map((b, i) => {
    const a = Math.min(b.x1, b.x2);
    const c = Math.max(b.x1, b.x2);
    const lo = a + radius + 1;
    const hi = c - radius - 1;
    const mid = (a + c) / 2;
    return { i, lo, hi, x: clampMark(mid, lo, hi) };
  });
  items.sort((a, b) => a.x - b.x || a.i - b.i);
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const cur = items[i];
      if (cur.x - prev.x + 1e-6 >= minGap) continue;
      const need = prev.x + minGap;
      const pushed = Math.min(cur.hi, need);
      cur.x = pushed;
      if (cur.x + 1e-6 < need) {
        prev.x = clampMark(cur.x - minGap, prev.lo, prev.hi);
        cur.x = clampMark(prev.x + minGap, cur.lo, cur.hi);
      }
    }
  }
  const out = new Array<number>(bars.length);
  for (const it of items) out[it.i] = it.x;
  return out;
}

function textAboveLine(
  ctx: Ctx,
  str: string,
  x: number,
  lineY: number,
  size: number,
  align: "left" | "center" | "right" = "center",
  bold = false,
  gap = 3.4,
) {
  const font = bold ? ctx.fontBold : ctx.font;
  const width = font.widthOfTextAtSize(str, size);
  let tx = x;
  if (align === "center") tx = x - width / 2;
  if (align === "right") tx = x - width;
  // Baseline sits above the stroke so digits rest on top of the bar / dim line.
  const lift = Math.max(gap, size * 0.42);
  ctx.page.drawText(str, {
    x: tx,
    y: ty(lineY) + lift,
    size,
    font,
    color: BLACK,
  });
  return width;
}

function dimH(ctx: Ctx, x1: number, x2: number, y: number, label: string, size = 6.5, avoidX?: number) {
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  if (b - a < 2) return;
  const mid = (a + b) / 2;
  const labelW = ctx.font.widthOfTextAtSize(label, size) + 5;
  let labelX = mid;
  if (avoidX != null && Math.abs(mid - avoidX) < labelW / 2 + 14) {
    const left = a + (b - a) * 0.3;
    const right = a + (b - a) * 0.7;
    labelX = Math.abs(left - avoidX) >= Math.abs(right - avoidX) ? left : right;
  }
  line(ctx, a, y - 2.4, a, y + 2.4, 0.35);
  line(ctx, b, y - 2.4, b, y + 2.4, 0.35);
  line(ctx, a, y - 2.2, a + 3.2, y + 2.2, 0.3);
  line(ctx, b, y - 2.2, b - 3.2, y + 2.2, 0.3);
  if (b - a > labelW + 12) {
    line(ctx, a, y, labelX - labelW / 2, y, 0.35);
    line(ctx, labelX + labelW / 2, y, b, y, 0.35);
  } else {
    line(ctx, a, y, b, y, 0.35);
  }
  if (b - a > 14 || label.length < 5) {
    textAboveLine(ctx, label, labelX, y, size, "center", false, 3.8);
  }
}

function dimV(
  ctx: Ctx,
  x: number,
  y1: number,
  y2: number,
  label: string,
  size = 6.5,
  labelSide: "left" | "right" = "right",
) {
  const a = Math.min(y1, y2);
  const b = Math.max(y1, y2);
  if (b - a < 2) return;
  const mid = (a + b) / 2;
  const font = ctx.font;
  const tw = font.widthOfTextAtSize(label, size);
  const gap = size * 0.62;
  line(ctx, x - 2.4, a, x + 2.4, a, 0.35);
  line(ctx, x - 2.4, b, x + 2.4, b, 0.35);
  if (b - a > gap * 2 + 6) {
    line(ctx, x, a, x, mid - gap, 0.35);
    line(ctx, x, mid + gap, x, b, 0.35);
  } else {
    line(ctx, x, a, x, b, 0.35);
  }
  const tx = labelSide === "left" ? x - 3.6 - tw : x + 3.6;
  ctx.page.drawRectangle({
    x: tx - 1.1,
    y: ty(mid + size * 0.42),
    width: tw + 2.2,
    height: size * 0.92,
    color: WHITE,
  });
  textSimple(ctx, label, tx, mid - size * 0.18, size);
}

function dashV(ctx: Ctx, x: number, y1: number, y2: number, on = 3.2, off = 2.4, w = 0.32) {
  const top = Math.min(y1, y2);
  const bot = Math.max(y1, y2);
  for (let y = top; y < bot; y += on + off) {
    line(ctx, x, y, x, Math.min(y + on, bot), w);
  }
}

function hatch(ctx: Ctx, x: number, y: number, w: number, h: number, step = 3.6) {
  const x2 = x + w;
  const y2 = y + h;
  for (let d = -h; d <= w; d += step) {
    let xA = x + d;
    let yA = y;
    let xB = x + d + h;
    let yB = y + h;
    if (xA < x) {
      const t = (x - xA) / (xB - xA || 1);
      xA = x;
      yA = yA + t * (yB - yA);
    }
    if (xB > x2) {
      const t = (x2 - xA) / (xB - xA || 1);
      xB = x2;
      yB = yA + t * (yB - yA);
    }
    if (yA < y) {
      const t = (y - yA) / (yB - yA || 1);
      yA = y;
      xA = xA + t * (xB - xA);
    }
    if (yB > y2) {
      const t = (y2 - yA) / (yB - yA || 1);
      yB = y2;
      xB = xA + t * (xB - xA);
    }
    if (xB - xA > 0.4 && yB - yA > 0.4) line(ctx, xA, yA, xB, yB, 0.22);
  }
}

function drawHookedBar(
  ctx: Ctx,
  x1: number,
  x2: number,
  y: number,
  hookStart: number,
  hookEnd: number,
  dir: 1 | -1,
  thick = 1.05,
) {
  line(ctx, x1, y, x2, y, thick);
  const hs = Math.max(hookStart * ctx.scale * 0.28, hookStart > 0 ? 9 : 0);
  const he = Math.max(hookEnd * ctx.scale * 0.28, hookEnd > 0 ? 9 : 0);
  if (hookStart > 0) line(ctx, x1, y, x1, y + dir * hs, thick);
  if (hookEnd > 0) line(ctx, x2, y, x2, y + dir * he, thick);
}

function covers(bar: ResolvedBar, x: number, pad = 30) {
  return bar.x1 - pad <= x && bar.x2 + pad >= x;
}

function markForBar(schedule: ScheduleRow[], bar: ResolvedBar) {
  if (bar.sourceId.startsWith("anti-")) {
    return schedule.find(
      (r) =>
        r.extraKind === "anti" &&
        r.dia === bar.dia &&
        Math.round(r.barLength) === Math.round(bar.cutLength),
    );
  }
  const piece = bar.pieceIndex ?? 0;
  const exact = schedule.find(
    (r) =>
      r.family !== "D" &&
      r.bars.some(
        (b) =>
          b.sourceId === bar.sourceId &&
          (b.pieceIndex ?? 0) === piece &&
          Math.abs(b.x1 - bar.x1) < 2 &&
          Math.abs(b.x2 - bar.x2) < 2,
      ),
  );
  if (exact) return exact;
  return schedule.find((r) => {
    if (r.family === "D") return false;
    const head = r.bars[0];
    if (!head) return false;
    return (
      head.kind === bar.kind &&
      head.face === bar.face &&
      head.dia === bar.dia &&
      Math.round(head.cutLength / 10) === Math.round(bar.cutLength / 10) &&
      r.bars.some((b) => Math.abs(b.x1 - bar.x1) < 80)
    );
  });
}

function splitQty(qty: number, face: "top" | "bottom") {
  const n = Math.max(1, qty);
  if (n <= 2) return [n];
  if (face === "top") return [2, n - 2];
  return [n - 2, 2];
}

function shopFamilyTag(bar: ResolvedBar, row?: ScheduleRow) {
  if (bar.sourceId.startsWith("anti-") || row?.extraKind === "anti") return "CP";
  return row?.family ?? barFamilyOf(bar);
}

function shopSpec(qty: number, bar: ResolvedBar, family: string) {
  return `${qty}Ø${bar.dia} L=${Math.round(bar.cutLength)}-${family}`;
}

function drawShopSpec(
  ctx: Ctx,
  x1: number,
  x2: number,
  y: number,
  mark: string,
  spec: string,
  markX?: number,
  nextMarkX?: number,
) {
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  const spanPt = b - a;
  const size = spanPt < 90 ? 6 : 7.5;
  const r = Math.max(mark.length > 2 ? 7.2 : 6.4, spanPt < 86 ? 5.8 : 6.6);
  const cx = markX ?? (a + b) / 2;
  markCircle(ctx, cx, y, mark, r);
  if (!spec) return;
  const font = ctx.font;
  const sw = font.widthOfTextAtSize(spec, size);
  const rightLimit = nextMarkX != null ? nextMarkX - r - 5 : b + 80;
  const leftLimit = a - 8;
  const specRight = cx + r + 5;
  if (specRight + sw <= rightLimit) {
    textAboveLine(ctx, spec, specRight, y, size, "left", false, 3.4);
    return;
  }
  const specLeft = cx - r - 5;
  if (specLeft - sw >= leftLimit) {
    textAboveLine(ctx, spec, specLeft, y, size, "right", false, 3.4);
    return;
  }
}

function groupMainShopSources(bars: ResolvedBar[]) {
  const map = new Map<string, ResolvedBar[]>();
  for (const b of bars) {
    const arr = map.get(b.sourceId) ?? [];
    arr.push(b);
    map.set(b.sourceId, arr);
  }
  return [...map.values()].map((g) => g.sort((a, b) => a.x1 - b.x1));
}

function mainShopBlockH(bars: ResolvedBar[]) {
  let h = 0;
  for (const group of groupMainShopSources(bars)) {
    if (group.length <= 1) {
      h += splitQty(group[0]?.qty || 1, group[0]?.face ?? "bottom").length * MAIN_SHOP_H;
    } else {
      h += SPLICE_BLOCK_H;
    }
  }
  return h;
}

function drawMainShopPiece(
  ctx: Ctx,
  bar: ResolvedBar,
  qty: number,
  y: number,
  hookDir: 1 | -1,
  dimSide: 1 | -1,
) {
  const row = markForBar(ctx.model.schedule, bar);
  const family = row?.family ?? barFamilyOf(bar);
  const mark = row?.mark ?? "1a";
  const x1 = xAt(ctx, bar.x1);
  const x2 = xAt(ctx, bar.x2);
  drawHookedBar(ctx, x1, x2, y, bar.hookStart, bar.hookEnd, hookDir, 1.05);
  const hs = Math.max(bar.hookStart * ctx.scale * 0.24, bar.hookStart > 0 ? 7 : 0);
  const he = Math.max(bar.hookEnd * ctx.scale * 0.24, bar.hookEnd > 0 ? 7 : 0);
  if (bar.hookStart > 0) dimV(ctx, x1 - 10, y, y + hookDir * hs, String(Math.round(bar.hookStart)), 5.6);
  if (bar.hookEnd > 0) dimV(ctx, x2 + 7, y, y + hookDir * he, String(Math.round(bar.hookEnd)), 5.6);
  const markX = placeBarMarks([{ x1, x2 }], 6.2)[0] ?? (x1 + x2) / 2;
  if (bar.straight > 80) {
    dimH(ctx, x1, x2, y + dimSide * 10, String(Math.round(bar.cutLength)), 6, markX);
  }
  if (bar.spliceLapMm && bar.spliceLapMm > 0) {
    const lapX1 = xAt(ctx, bar.x2 - bar.spliceLapMm);
    dimH(ctx, lapX1, x2, y - dimSide * 9, String(Math.round(bar.spliceLapMm)), 5.8);
  }
  drawShopSpec(ctx, x1, x2, y, mark, shopSpec(qty, bar, family), markX);
}

function drawMainShopRows(ctx: Ctx, bars: ResolvedBar[], y: number, hookDir: 1 | -1) {
  let yy = y;
  for (const group of groupMainShopSources(bars)) {
    if (group.length <= 1) {
      const bar = group[0];
      if (!bar) continue;
      const dimSide = (hookDir === 1 ? -1 : 1) as 1 | -1;
      for (const q of splitQty(bar.qty || 1, bar.face)) {
        drawMainShopPiece(ctx, bar, q, yy + 10, hookDir, dimSide);
        yy += MAIN_SHOP_H;
      }
      continue;
    }
    const y0 = yy + SPLICE_PAD;
    for (let i = 0; i < group.length; i++) {
      const lower = i % 2 === 1;
      const yBar = y0 + (lower ? SPLICE_LANE : 0);
      const dimSide = (lower ? 1 : -1) as 1 | -1;
      drawMainShopPiece(ctx, group[i], group[i].qty || 1, yBar, hookDir, dimSide);
    }
    yy += SPLICE_BLOCK_H;
  }
  return yy;
}

function extraLayers(bars: ResolvedBar[]) {
  const map = new Map<number, ResolvedBar[]>();
  for (const b of bars) {
    const k = Math.max(1, b.layer || 1);
    const arr = map.get(k) ?? [];
    arr.push(b);
    map.set(k, arr);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function drawSupportGuides(ctx: Ctx, y0: number, y1: number) {
  const h = y1 - y0;
  if (h < 4) return;
  ctx.project.supports.forEach((_, i) => {
    const f = supportFaces(ctx.project, i);
    const left = xAt(ctx, f.left);
    const right = xAt(ctx, f.right);
    const ax = xAt(ctx, f.axis);
    const w = Math.max(right - left, 2);
    hatch(ctx, left, y0, w, h, 3.5);
    rect(ctx, left, y0, w, h, 0.4);
    dashV(ctx, ax, y0, y1, 3.1, 2.3, 0.26);
  });
}

function drawExtraShopRow(ctx: Ctx, bars: ResolvedBar[], schedule: ScheduleRow[], y: number, dir: 1 | -1) {
  const pageBars = bars.map((b) => ({ x1: xAt(ctx, b.x1), x2: xAt(ctx, b.x2) }));
  const markXs = placeBarMarks(pageBars, 6.6);
  bars.forEach((b, i) => {
    const x1 = pageBars[i].x1;
    const x2 = pageBars[i].x2;
    const row = markForBar(schedule, b);
    const family = shopFamilyTag(b, row);
    const mark = row?.mark ?? "";
    const markX = markXs[i] ?? (x1 + x2) / 2;
    drawHookedBar(ctx, x1, x2, y, b.hookStart, b.hookEnd, dir, 1.05);
    dimH(ctx, x1, x2, y + (dir === 1 ? 11 : -11), String(Math.round(b.straight)), 5.8, markX);
    const hs = Math.max(b.hookStart * ctx.scale * 0.28, b.hookStart > 0 ? 8 : 0);
    const he = Math.max(b.hookEnd * ctx.scale * 0.28, b.hookEnd > 0 ? 8 : 0);
    if (b.hookStart > 0) dimV(ctx, x1 - 10, y, y + dir * hs, String(Math.round(b.hookStart)), 6);
    if (b.hookEnd > 0) dimV(ctx, x2 + 7, y, y + dir * he, String(Math.round(b.hookEnd)), 6);
    const nextMark = markXs[i + 1];
    drawShopSpec(ctx, x1, x2, y, mark, shopSpec(b.qty, b, family), markX, nextMark);
  });
}

const MAIN_SHOP_H = 24;
const EXTRA_SHOP_H = 26;
const MOMENT_GAP = 8;
const EXTRA_BAND_PAD = 24;
const SPLICE_LANE = 16;
const SPLICE_PAD = 11;
const SPLICE_BLOCK_H = SPLICE_PAD + SPLICE_LANE + SPLICE_PAD;

function drawExplodedShops(ctx: Ctx, yStart: number) {
  const { model } = ctx;
  const mt = model.mainTop;
  const mb = model.mainBottom;
  const topLayers = extraLayers(model.extraTop);
  const botLayers = extraLayers(model.extraBottom);
  const antiBars = antiBucklingResolvedBars(ctx.project);
  const hasAnti = antiBars.length > 0;
  const hasExtras = topLayers.length > 0 || botLayers.length > 0;
  const hasMidBand = hasExtras || hasAnti;
  const padTop = mt.length && hasMidBand ? EXTRA_BAND_PAD : 0;
  const padBot = mb.length && hasMidBand ? EXTRA_BAND_PAD : 0;
  const gapAroundCp = hasAnti ? 6 : 0;
  const gapMoments = !hasAnti && topLayers.length && botLayers.length ? MOMENT_GAP : 0;
  const total =
    mainShopBlockH(mt) +
    padTop +
    topLayers.length * EXTRA_SHOP_H +
    (hasAnti && topLayers.length ? gapAroundCp : 0) +
    (hasAnti ? EXTRA_SHOP_H : 0) +
    (hasAnti && botLayers.length ? gapAroundCp : 0) +
    gapMoments +
    botLayers.length * EXTRA_SHOP_H +
    padBot +
    mainShopBlockH(mb);
  drawSupportGuides(ctx, yStart - 4, yStart + Math.max(total, 10) + 4);

  let y = yStart;
  if (mt.length) y = drawMainShopRows(ctx, mt, y, 1);

  let bandOpen = false;
  const openBand = () => {
    if (bandOpen) return;
    y += padTop || (mt.length || topLayers.length ? 2 : 0);
    bandOpen = true;
  };

  if (topLayers.length) {
    openBand();
    for (const [, bars] of topLayers) {
      textSimple(ctx, "M-", 108, y + 1, 7, true, "right");
      drawExtraShopRow(ctx, bars, model.schedule, y, 1);
      y += EXTRA_SHOP_H;
    }
  }

  if (hasAnti) {
    openBand();
    if (topLayers.length) y += gapAroundCp;
    textSimple(ctx, "CP", 108, y + 1, 7, true, "right");
    drawExtraShopRow(ctx, antiBars, model.schedule, y, -1);
    y += EXTRA_SHOP_H;
  }

  if (botLayers.length) {
    openBand();
    if (hasAnti) y += gapAroundCp;
    else if (topLayers.length) y += gapMoments;
    for (const [, bars] of botLayers) {
      textSimple(ctx, "M+", 108, y + 1, 7, true, "right");
      drawExtraShopRow(ctx, bars, model.schedule, y, -1);
      y += EXTRA_SHOP_H;
    }
  }

  if (mb.length) {
    if (bandOpen) y += padBot;
    y = drawMainShopRows(ctx, mb, y, -1);
  }
  return y + 2;
}

type CutLoc = {
  n: number;
  x: number;
  kind: "support" | "span";
  extraTop: ResolvedBar[];
  extraBot: ResolvedBar[];
  spacing: number;
  antiBuckling: boolean;
  extraCCx: boolean;
  extraCCy: boolean;
  extraNestedCx: boolean;
  extraNestedCy: boolean;
  extraDouble: boolean;
};

function buildCuts(ctx: Ctx): CutLoc[] {
  const { project, model } = ctx;
  const raw: Omit<CutLoc, "n">[] = [];
  project.supports.forEach((_, i) => {
    const f = supportFaces(project, i);
    const spanI = i === 0 ? 0 : Math.min(i, project.spans.length) - (i === project.spans.length ? 1 : 0);
    const si = Math.max(0, Math.min(spanI, project.spans.length - 1));
    const zones = stirrupZonesForSpan(project, si, model.extraTop);
    const flags = extraTieFlagsForSpan(project, si);
    raw.push({
      x: f.axis,
      kind: "support",
      extraTop: model.extraTop.filter((b) => covers(b, f.axis, 80)),
      extraBot: model.extraBottom.filter((b) => covers(b, f.axis, 40)),
      spacing: zones.left.spacing || project.stirrups[spanI]?.a1 || 150,
      antiBuckling: flags.antiBuckling,
      extraCCx: flags.extraCCx,
      extraCCy: flags.extraCCy,
      extraNestedCx: flags.extraNestedCx,
      extraNestedCy: flags.extraNestedCy,
      extraDouble: flags.extraDouble,
    });
  });
  project.spans.forEach((_, i) => {
    const left = supportFaces(project, i).right;
    const right = supportFaces(project, i + 1).left;
    const x = (left + right) / 2;
    const zones = stirrupZonesForSpan(project, i, model.extraTop);
    const flags = extraTieFlagsForSpan(project, i);
    raw.push({
      x,
      kind: "span",
      extraTop: model.extraTop.filter((b) => covers(b, x, 40)),
      extraBot: model.extraBottom.filter((b) => covers(b, x, 80)),
      spacing: zones.mid.spacing,
      antiBuckling: flags.antiBuckling,
      extraCCx: flags.extraCCx,
      extraCCy: flags.extraCCy,
      extraNestedCx: flags.extraNestedCx,
      extraNestedCy: flags.extraNestedCy,
      extraDouble: flags.extraDouble,
    });
  });
  raw.sort((a, b) => a.x - b.x);
  const keyOf = (c: Omit<CutLoc, "n">) => {
    const et = c.extraTop
      .map((b) => markForBar(model.schedule, b)?.mark ?? `${b.dia}-${Math.round(b.cutLength)}`)
      .sort()
      .join(",");
    const eb = c.extraBot
      .map((b) => markForBar(model.schedule, b)?.mark ?? `${b.dia}-${Math.round(b.cutLength)}`)
      .sort()
      .join(",");
    return `${c.kind}|${et}|${eb}|${c.spacing}|${c.antiBuckling ? "cp" : ""}|${c.extraCCx ? "cx" : ""}|${c.extraCCy ? "cy" : ""}|${c.extraNestedCx ? "nx" : ""}|${c.extraNestedCy ? "ny" : ""}|${c.extraDouble ? "db" : ""}`;
  };
  const ids = new Map<string, number>();
  let next = 1;
  return raw.map((c) => {
    const k = keyOf(c);
    let n = ids.get(k);
    if (!n) {
      n = next++;
      ids.set(k, n);
    }
    return { ...c, n };
  });
}

function uniqueHoggingRanges(project: BeamProject, bars: ResolvedBar[]) {
  const sorted = [...bars].sort((a, b) => a.x1 - b.x1 || a.x2 - b.x2);
  const out: { x1: number; x2: number; axis: number }[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x1 - b.x1) < 40 && Math.abs(last.x2 - b.x2) < 40) continue;
    if (b.x2 - b.x1 < 40) continue;
    let axis = (b.x1 + b.x2) / 2;
    let best = Infinity;
    for (let i = 0; i < project.supports.length; i++) {
      const ax = supportFaces(project, i).axis;
      if (ax < b.x1 - 8 || ax > b.x2 + 8) continue;
      const d = Math.abs(ax - (b.x1 + b.x2) / 2);
      if (d < best) {
        best = d;
        axis = ax;
      }
    }
    out.push({ x1: b.x1, x2: b.x2, axis });
  }
  return out;
}

function dimHWithA1Below(ctx: Ctx, x1: number, x2: number, y: number, dimLabel: string, a1: string) {
  dimH(ctx, x1, x2, y, dimLabel, 6.2);
  if (!a1) return;
  const mid = (Math.min(x1, x2) + Math.max(x1, x2)) / 2;
  textSimple(ctx, a1, mid, y + 8.5, 5.8, false, "center");
}

function a2LabelForRange(ctx: Ctx, x1: number, x2: number) {
  const { project, model } = ctx;
  const texts: string[] = [];
  project.spans.forEach((sp, i) => {
    const zones = stirrupZonesForSpan(project, i, model.extraTop);
    const x0 = model.xs[i];
    const mid1 = x0 + zones.left.length;
    const mid2 = mid1 + zones.mid.length;
    if (zones.mid.count > 0 && mid2 > x1 && mid1 < x2) {
      texts.push(`${zones.mid.count}Ø${zones.dia}a${zones.mid.spacing}`);
    }
  });
  return texts[0] ?? "";
}

function a1LabelForRange(ctx: Ctx, x1: number, x2: number) {
  const { project, model } = ctx;
  const items: { count: number; dia: number; spacing: number }[] = [];
  project.spans.forEach((sp, i) => {
    const zones = stirrupZonesForSpan(project, i, model.extraTop);
    const x0 = model.xs[i];
    const left1 = x0;
    const left2 = x0 + zones.left.length;
    const right1 = x0 + zones.left.length + zones.mid.length;
    const right2 = x0 + sp.L;
    if (zones.left.count > 0 && left2 > x1 && left1 < x2) {
      items.push({ count: zones.left.count, dia: zones.dia, spacing: zones.left.spacing });
    }
    if (zones.right.count > 0 && right2 > x1 && right1 < x2) {
      items.push({ count: zones.right.count, dia: zones.dia, spacing: zones.right.spacing });
    }
  });
  if (!items.length) return "";
  const dia = items[0].dia;
  const spacing = items[0].spacing;
  const counts = new Set(items.map((it) => it.count));
  if (counts.size === 1) return `${items[0].count}Ø${dia}a${spacing}`;
  return `Ø${dia}a${spacing}`;
}

function drawCutMark(ctx: Ctx, x: number, y0: number, y1: number, n: number) {
  line(ctx, x, y0, x, y1, 0.4);
  const s = 3.8;
  const tip = s * 1.35;
  line(ctx, x - s, y0, x + s, y0, 0.45);
  line(ctx, x - s, y0, x, y0 + tip, 0.45);
  line(ctx, x + s, y0, x, y0 + tip, 0.45);
  textSimple(ctx, String(n), x, y0 - 10, 7, true, "center");
  line(ctx, x - s, y1, x + s, y1, 0.45);
  line(ctx, x - s, y1, x, y1 - tip, 0.45);
  line(ctx, x + s, y1, x, y1 - tip, 0.45);
  textSimple(ctx, String(n), x, y1 + 3.4, 7, true, "center");
}

function drawElevation(ctx: Ctx, yTop: number, beamH: number, cuts: CutLoc[]) {
  const { project, model } = ctx;
  const y0 = yTop;
  const y1 = yTop + beamH;
  const first = supportFaces(project, 0);
  const lastF = supportFaces(project, project.spans.length);
  const xStart = xAt(ctx, first.left);
  const xEnd = xAt(ctx, lastF.right);

  line(ctx, xStart, y0, xEnd, y0, 1.15);
  line(ctx, xStart, y1, xEnd, y1, 1.15);
  line(ctx, xStart, y0, xStart, y1, 1.05);
  line(ctx, xEnd, y0, xEnd, y1, 1.05);

  const colH = 18;
  project.supports.forEach((sup, i) => {
    const f = supportFaces(project, i);
    const left = xAt(ctx, f.left);
    const right = xAt(ctx, f.right);
    const ax = xAt(ctx, f.axis);
    const { width } = supportGeometry(sup.B, sup.B1);
    void width;
    hatch(ctx, left, y0 - colH, Math.max(right - left, 2), colH, 3.2);
    hatch(ctx, left, y1, Math.max(right - left, 2), colH, 3.2);
    rect(ctx, left, y0 - colH, Math.max(right - left, 2), colH, 0.7);
    rect(ctx, left, y1, Math.max(right - left, 2), colH, 0.7);
    dashV(ctx, ax, y0 - 52, y1 + 54, 3.1, 2.3, 0.28);
    bubble(ctx, ax, y1 + 66, 8.5);
    textCentered(ctx, sup.axisName || String(i), ax, y1 + 66, 8, true);
  });

  const dimY = y0 - 32;
  const hogging = uniqueHoggingRanges(project, model.extraTop);
  if (hogging.length) {
    let cursor = first.left;
    for (const r of hogging) {
      if (r.x1 - cursor > 80) {
        dimHWithA1Below(
          ctx,
          xAt(ctx, cursor),
          xAt(ctx, r.x1),
          dimY,
          String(Math.round(r.x1 - cursor)),
          a2LabelForRange(ctx, cursor, r.x1),
        );
      }
      if (r.axis - r.x1 > 8) {
        dimHWithA1Below(
          ctx,
          xAt(ctx, r.x1),
          xAt(ctx, r.axis),
          dimY,
          String(Math.round(r.axis - r.x1)),
          a1LabelForRange(ctx, r.x1, r.axis),
        );
      }
      if (r.x2 - r.axis > 8) {
        dimHWithA1Below(
          ctx,
          xAt(ctx, r.axis),
          xAt(ctx, r.x2),
          dimY,
          String(Math.round(r.x2 - r.axis)),
          a1LabelForRange(ctx, r.axis, r.x2),
        );
      }
      cursor = r.x2;
    }
    if (lastF.right - cursor > 80) {
      dimHWithA1Below(
        ctx,
        xAt(ctx, cursor),
        xAt(ctx, lastF.right),
        dimY,
        String(Math.round(lastF.right - cursor)),
        a2LabelForRange(ctx, cursor, lastF.right),
      );
    }
  } else {
    const segs: { a: number; b: number }[] = [];
    if (Math.abs(first.axis - first.left) > 8) segs.push({ a: first.left, b: first.axis });
    project.spans.forEach((_, i) => {
      const zones = stirrupZonesForSpan(project, i, model.extraTop);
      const L = project.spans[i].L;
      const parts = [zones.left.length, zones.mid.length, zones.right.length];
      const sumZ = parts.reduce((s, v) => s + v, 0) || 1;
      let c = model.xs[i];
      for (const p of parts) {
        const len = (p / sumZ) * L;
        if (len > 8) segs.push({ a: c, b: c + len });
        c += len;
      }
    });
    if (Math.abs(lastF.right - lastF.axis) > 8) segs.push({ a: lastF.axis, b: lastF.right });
    for (const s of segs) {
      if (s.b - s.a < 8) continue;
      dimH(ctx, xAt(ctx, s.a), xAt(ctx, s.b), dimY, String(Math.round(s.b - s.a)), 6);
    }
  }

  project.spans.forEach((sp, i) => {
    const a = xAt(ctx, model.xs[i]);
    const b = xAt(ctx, model.xs[i + 1]);
    dimH(ctx, a, b, y1 + 48, String(sp.L), 7.5);
    const extraNote = extraTieElevationNote(project, i);
    if (extraNote) {
      textSimple(ctx, extraNote, (a + b) / 2, y0 - 48, 5.6, false, "center");
    }
  });

  const beamHmm = Math.max(model.H, 1);
  const mmToPt = beamH / beamHmm;
  const coverPt = Math.max(5.5, (project.info.cover || 25) * mmToPt);
  const topY = y0 + coverPt;
  const botY = y1 - coverPt;

  for (const b of model.mainTop) {
    drawHookedBar(ctx, xAt(ctx, b.x1), xAt(ctx, b.x2), topY, b.hookStart, b.hookEnd, 1, 0.85);
  }
  for (const b of model.mainBottom) {
    drawHookedBar(ctx, xAt(ctx, b.x1), xAt(ctx, b.x2), botY, b.hookStart, b.hookEnd, -1, 0.85);
  }
  for (const b of model.extraTop) {
    drawHookedBar(
      ctx,
      xAt(ctx, b.x1),
      xAt(ctx, b.x2),
      topY + extraLayerOffsetMm(b.layer) * mmToPt,
      b.hookStart,
      b.hookEnd,
      1,
      0.9,
    );
  }
  for (const b of model.extraBottom) {
    drawHookedBar(
      ctx,
      xAt(ctx, b.x1),
      xAt(ctx, b.x2),
      botY - extraLayerOffsetMm(b.layer) * mmToPt,
      b.hookStart,
      b.hookEnd,
      -1,
      0.9,
    );
  }

  const antiBars = antiBucklingResolvedBars(project);
  const midY = (topY + botY) / 2;
  for (const b of antiBars) {
    drawHookedBar(ctx, xAt(ctx, b.x1), xAt(ctx, b.x2), midY - 0.7, 0, 0, -1, 0.85);
    drawHookedBar(ctx, xAt(ctx, b.x1), xAt(ctx, b.x2), midY + 0.7, 0, 0, -1, 0.85);
  }

  for (const t of model.stirrups.ticks) {
    const x = xAt(ctx, t.x);
    line(ctx, x, y0 + 2.5, x, y1 - 2.5, t.dense ? 0.5 : 0.32);
  }

  const stMark =
    model.schedule.find((r) => r.family === "D" && !r.extraKind)?.mark ??
    model.schedule.find((r) => r.extraKind === "double")?.mark ??
    "9";
  if (!hogging.length) {
    for (const lb of model.stirrups.labels) {
      const x = xAt(ctx, lb.x);
      markCircle(ctx, x - 28, y0 - 12, stMark, 5.8);
      textSimple(ctx, lb.text.replace(/^\d+/, (m) => m), x - 21, y0 - 9.5, 6.2);
    }
  }

  const drawMarksOnPlane = (
    items: { bar: ResolvedBar; y: number; fullMark: boolean }[],
  ) => {
    const groups = new Map<number, typeof items>();
    for (const it of items) {
      const key = Math.round(it.y * 4) / 4;
      const arr = groups.get(key) ?? [];
      arr.push(it);
      groups.set(key, arr);
    }
    const placed = new Map<ResolvedBar, number>();
    for (const [, list] of groups) {
      const pageBars = list.map(({ bar }) => ({ x1: xAt(ctx, bar.x1), x2: xAt(ctx, bar.x2) }));
      const xs = placeBarMarks(pageBars, 5.8);
      list.forEach((it, i) => {
        const row = markForBar(model.schedule, it.bar);
        if (!row) return;
        const mx = xs[i] ?? (pageBars[i].x1 + pageBars[i].x2) / 2;
        placed.set(it.bar, mx);
        markCircle(ctx, mx, it.y, it.fullMark ? row.mark : String(row.markNum), 5.6);
        const note = barNotation(it.bar.qty, it.bar.dia);
        const nw = ctx.font.widthOfTextAtSize(note, 6.2);
        const next = xs[i + 1] ?? Number.POSITIVE_INFINITY;
        if (mx + 8 + nw < next - 8) {
          textAboveLine(ctx, note, mx + 8, it.y, 6.2, "left", false, 3.0);
        }
      });
    }
    return placed;
  };

  const extraMarks = drawMarksOnPlane([
    ...model.extraTop.map((bar) => ({
      bar,
      y: topY + extraLayerOffsetMm(bar.layer) * mmToPt,
      fullMark: false,
    })),
    ...model.extraBottom.map((bar) => ({
      bar,
      y: botY - extraLayerOffsetMm(bar.layer) * mmToPt,
      fullMark: false,
    })),
    ...antiBars.map((bar) => ({
      bar,
      y: midY,
      fullMark: true,
    })),
  ]);
  void extraMarks;

  const steelMarkX = xStart - 36;
  const steelSpecX = xStart - 28;
  const drawElevFamilyMarks = (bars: ResolvedBar[], y: number) => {
    const families: { num: number; qty: number; dia: number }[] = [];
    const seen = new Set<number>();
    for (const b of bars) {
      const row = markForBar(model.schedule, b);
      if (!row || seen.has(row.markNum)) continue;
      seen.add(row.markNum);
      families.push({ num: row.markNum, qty: b.qty, dia: b.dia });
    }
    families.forEach((f, i) => {
      const yy = y + (i - (families.length - 1) / 2) * 13;
      markCircle(ctx, steelMarkX, yy, String(f.num), 5.8);
      textAboveLine(ctx, barNotation(f.qty, f.dia), steelSpecX, yy, 6.5, "left", false, 3.2);
    });
  };
  drawElevFamilyMarks(model.mainTop, topY);
  drawElevFamilyMarks(model.mainBottom, botY);
  if (antiBars.length) drawElevFamilyMarks(antiBars, midY);

  const elev = ctx.project.info.elevation;
  const elevStr = elev === 0 ? "±0.000" : elev > 0 ? `+${elev.toFixed(3)}` : elev.toFixed(3);
  const dimX = xStart - 58;
  dimV(ctx, dimX, y0, y1, String(model.H), 7, "left");
  const elevW = ctx.font.widthOfTextAtSize(elevStr, 7);
  const elevX = dimX - 26 - elevW;
  const elevTextY = y0 - 12;
  textSimple(ctx, elevStr, elevX, elevTextY, 7);
  line(ctx, elevX, elevTextY + 7.4, elevX + elevW, elevTextY + 7.4, 0.85);
  line(ctx, elevX - 2, y0, dimX - 8, y0, 0.8);

  for (const c of cuts) {
    drawCutMark(ctx, xAt(ctx, c.x), y0 - 50, y1 + 8, c.n);
  }

  const extraBotY = y1 + 32;
  if (model.extraBottom.length) {
    let cursor = first.left;
    const pts = [...model.extraBottom].sort((a, b) => a.x1 - b.x1);
    for (const b of pts) {
      if (b.x1 - cursor > 20) dimH(ctx, xAt(ctx, cursor), xAt(ctx, b.x1), extraBotY, String(Math.round(b.x1 - cursor)), 6);
      dimH(ctx, xAt(ctx, b.x1), xAt(ctx, b.x2), extraBotY, String(Math.round(b.straight)), 6.2);
      cursor = b.x2;
    }
    if (lastF.right - cursor > 20) {
      dimH(ctx, xAt(ctx, cursor), xAt(ctx, lastF.right), extraBotY, String(Math.round(lastF.right - cursor)), 6);
    }
  }

  return y1 + 90;
}

function placeDots(ctx: Ctx, xs: number[], y: number, r: number) {
  for (const x of xs) circle(ctx, x, y, r, true);
}

function barXs(left: number, right: number, n: number) {
  const count = Math.max(1, n);
  if (count === 1) return [(left + right) / 2];
  return Array.from({ length: count }, (_, i) => left + ((right - left) * i) / (count - 1));
}

function extraLayerXs(left: number, right: number, qty: number, layer: number, mainXs: number[]) {
  return extraBarXsInSection(left, right, qty, layer, mainXs);
}

/** Circular arc in page-top coordinates (0° = +x, 90° = +y / down). */
function arcDeg(ctx: Ctx, cx: number, cy: number, r: number, startDeg: number, endDeg: number, t: number) {
  const steps = 14;
  const s = (startDeg * Math.PI) / 180;
  const e = (endDeg * Math.PI) / 180;
  let px = cx + r * Math.cos(s);
  let py = cy + r * Math.sin(s);
  for (let i = 1; i <= steps; i++) {
    const a = s + ((e - s) * i) / steps;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    line(ctx, px, py, x, y, t);
    px = x;
    py = y;
  }
}

function drawStirrupFrame(ctx: Ctx, x: number, y: number, w: number, h: number, t = 0.7) {
  const r = Math.min(7.4, w * 0.22, h * 0.18);
  const hook = Math.min(6.8, w * 0.26, h * 0.12);
  const L = x;
  const R = x + w;
  const T = y;
  const B = y + h;
  line(ctx, L + r, T, R - r, T, t);
  line(ctx, L, T + r, L, B - r, t);
  line(ctx, L + r, B, R - r, B, t);
  line(ctx, R, T + r, R, B - r, t);
  arcDeg(ctx, L + r, T + r, r, 180, 270, t);
  arcDeg(ctx, L + r, B - r, r, 90, 180, t);
  arcDeg(ctx, R - r, B - r, r, 0, 90, t);
  arcDeg(ctx, R - r, T + r, r, 270, 296, t);
  const a1 = (296 * Math.PI) / 180;
  const x1 = R - r + r * Math.cos(a1);
  const y1 = T + r + r * Math.sin(a1);
  line(ctx, x1, y1, x1 - hook * 0.78, y1 + hook * 0.78, t);
  arcDeg(ctx, R - r, T + r, r, 0, -26, t);
  const a2 = (-26 * Math.PI) / 180;
  const x2 = R - r + r * Math.cos(a2);
  const y2 = T + r + r * Math.sin(a2);
  line(ctx, x2, y2, x2 - hook * 0.78, y2 + hook * 0.78, t);
}

function drawLayerCallout(
  ctx: Ctx,
  bubbleX: number,
  y: number,
  mark: string,
  text: string,
  tickX: number,
  side: "left" | "right",
) {
  const size = 6.6;
  const stroke = 0.65;
  markCircle(ctx, bubbleX, y, mark, 6.4);
  if (side === "left") {
    line(ctx, bubbleX + 6.4, y, tickX, y, stroke);
    textAboveLine(ctx, text, bubbleX + 9, y, size, "left", false, 3.2);
  } else {
    line(ctx, tickX, y, bubbleX - 6.4, y, stroke);
    textAboveLine(ctx, text, bubbleX - 9, y, size, "right", false, 3.2);
  }
}

function drawCrossSection(
  ctx: Ctx,
  ox: number,
  oy: number,
  cut: CutLoc,
  title: string,
) {
  const { model, project } = ctx;
  const W = Math.max(model.B * SECTION_SCALE, 28);
  const H = Math.max(model.H * SECTION_SCALE, 48);
  const cx = ox + 70;
  const boxY = oy + 10;
  const cover = project.info.cover || 25;
  const inset = Math.max(4, cover * SECTION_SCALE);
  const barR = 2.35;
  const innerL = cx + inset + barR + 0.6;
  const innerR = cx + W - inset - barR - 0.6;

  rect(ctx, cx, boxY, W, H, 1.15);
  const sx = cx + inset;
  const sy = boxY + inset;
  const sw = Math.max(W - inset * 2, 6);
  const sh = Math.max(H - inset * 2, 6);
  if (!cut.extraDouble) {
    drawStirrupFrame(ctx, sx, sy, sw, sh);
  }
  if (cut.extraNestedCx && !cut.extraDouble) {
    drawStirrupFrame(ctx, sx + sw * 0.28, sy + 1.2, sw * 0.44, sh - 2.4, 0.55);
  }
  if (cut.extraNestedCy && !cut.extraDouble) {
    drawStirrupFrame(ctx, sx + 1.2, sy + sh * 0.28, sw - 2.4, sh * 0.44, 0.55);
  }
  if (cut.extraDouble) {
    const bars = Math.max(model.mainTop[0]?.qty || 0, model.mainBottom[0]?.qty || 0, 2);
    const mainDia = model.mainTop[0]?.dia ?? model.mainBottom[0]?.dia ?? 18;
    const innerBmm = Math.max(model.B - 2 * (project.info.cover || 25), 40);
    const hoops = doubleHoopOffsetsMm(innerBmm, bars, mainDia);
    const scaleX = sw / innerBmm;
    drawStirrupFrame(ctx, sx + hoops.leftX * scaleX, sy, hoops.widthMm * scaleX, sh, 0.7);
    drawStirrupFrame(ctx, sx + hoops.rightX * scaleX, sy, hoops.widthMm * scaleX, sh, 0.7);
  }
  dashV(ctx, cx + W / 2, boxY - 3, boxY + H + 8, 2.6, 1.9, 0.28);

  const topN = Math.min(Math.max(model.mainTop[0]?.qty || 0, 0), 6);
  const botN = Math.min(Math.max(model.mainBottom[0]?.qty || 0, 0), 6);
  const topY = boxY + inset + barR + 0.8;
  const botY = boxY + H - inset - barR - 0.8;
  const topXs = topN ? barXs(innerL, innerR, topN) : [];
  const botXs = botN ? barXs(innerL, innerR, botN) : [];
  if (topN) placeDots(ctx, topXs, topY, barR);
  if (botN) placeDots(ctx, botXs, botY, barR);
  {
    const midY = (topY + botY) / 2;
    const midX = (innerL + innerR) / 2;
    const hook = 5.2;
    if (cut.extraCCy) {
      line(ctx, midX + hook, topY, midX, topY, 0.7);
      line(ctx, midX, topY, midX, botY, 0.7);
      line(ctx, midX, botY, midX + hook, botY, 0.7);
    }
    if (cut.extraCCx) {
      line(ctx, innerL, midY - hook, innerL, midY, 0.7);
      line(ctx, innerL, midY, innerR, midY, 0.7);
      line(ctx, innerR, midY, innerR, midY - hook, 0.7);
    }
    if (cut.antiBuckling) placeDots(ctx, [innerL, innerR], midY, barR);
  }

  const extraTop = cut.kind === "support" ? cut.extraTop : cut.extraTop.filter((b) => covers(b, cut.x, 20));
  const extraBot = cut.kind === "span" ? cut.extraBot : cut.extraBot.filter((b) => covers(b, cut.x, 20));

  const extraY = (fromTop: boolean, layer: number) => {
    const gap = extraLayerOffsetMm(layer) * SECTION_SCALE;
    return fromTop ? topY + gap : botY - gap;
  };

  const extrasByLayer = (bars: ResolvedBar[]) => {
    const map = new Map<number, ResolvedBar>();
    for (const b of bars) {
      if (!map.has(b.layer)) map.set(b.layer, b);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  };

  const drawnTopExtras: { y: number; bar: ResolvedBar; xs: number[] }[] = [];
  const drawnBotExtras: { y: number; bar: ResolvedBar; xs: number[] }[] = [];
  for (const [layer, b] of extrasByLayer(extraTop)) {
    const y = extraY(true, layer);
    const xs = extraLayerXs(innerL, innerR, b.qty, layer, topXs);
    placeDots(ctx, xs, y, barR);
    if (xs.length > 1) line(ctx, xs[0] + barR + 0.6, y, xs[xs.length - 1] - barR - 0.6, y, 0.35);
    drawnTopExtras.push({ y, bar: b, xs });
  }
  for (const [layer, b] of extrasByLayer(extraBot)) {
    const y = extraY(false, layer);
    const xs = extraLayerXs(innerL, innerR, b.qty, layer, botXs);
    placeDots(ctx, xs, y, barR);
    if (xs.length > 1) line(ctx, xs[0] + barR + 0.6, y, xs[xs.length - 1] - barR - 0.6, y, 0.35);
    drawnBotExtras.push({ y, bar: b, xs });
  }

  dimH(ctx, cx, cx + W / 2, boxY + H + 12, String(model.B1 || Math.round(model.B / 2)), 5.8);
  dimH(ctx, cx + W / 2, cx + W, boxY + H + 12, String(model.B - (model.B1 || Math.round(model.B / 2))), 5.8);
  dimH(ctx, cx, cx + W, boxY + H + 24, String(model.B), 6.4);

  const mt = model.schedule.find((r) => r.family === "T1");
  const mb = model.schedule.find((r) => r.family === "B1");
  const st = model.schedule.find((r) => r.family === "D" && !r.extraKind);
  const extraRow = (kind: NonNullable<ScheduleRow["extraKind"]>) =>
    model.schedule.find((r) => r.extraKind === kind);
  const leftX = ox + 10;
  const dimX = cx - 16;
  const stirrupY = boxY + H / 3;
  const antiY = boxY + H / 2;
  const midX = (innerL + innerR) / 2;
  dimV(ctx, dimX, boxY, boxY + H, String(model.H), 6.2, "left");
  if (mt && model.mainTop[0] && topN) {
    drawLayerCallout(
      ctx,
      leftX,
      topY,
      String(mt.markNum),
      barNotation(model.mainTop[0].qty, model.mainTop[0].dia),
      topXs[0],
      "left",
    );
  }
  if (st && !cut.extraDouble) {
    drawLayerCallout(ctx, leftX, stirrupY, st.mark, `Ø${model.stirrups.dia} a${cut.spacing}`, cx + inset, "left");
  }
  if (cut.extraDouble) {
    const dbl = extraRow("double");
    if (dbl) {
      drawLayerCallout(
        ctx,
        leftX,
        stirrupY,
        dbl.mark,
        `2Ø${dbl.dia} a${dbl.spacing ?? cut.spacing}`,
        cx + inset,
        "left",
      );
    }
  }
  if (cut.antiBuckling) {
    const anti = extraRow("anti");
    if (anti) {
      drawLayerCallout(ctx, leftX, antiY, anti.mark, `2Ø${anti.dia}`, innerL, "left");
    }
  }
  if (mb && model.mainBottom[0] && botN) {
    drawLayerCallout(
      ctx,
      leftX,
      botY,
      String(mb.markNum),
      barNotation(model.mainBottom[0].qty, model.mainBottom[0].dia),
      botXs[0],
      "left",
    );
  }

  const rightX = cx + W + 40;
  const occupiedRight = [...drawnTopExtras.map((e) => e.y), ...drawnBotExtras.map((e) => e.y)];
  const minRightGap = 16;
  const pickRightY = (preferred: number) => {
    let y = preferred;
    const lo = topY + 2;
    const hi = botY - 2;
    for (let step = 0; step < 12; step++) {
      if (occupiedRight.every((other) => Math.abs(y - other) >= minRightGap)) break;
      y += minRightGap;
    }
    y = Math.max(lo, Math.min(hi, y));
    occupiedRight.push(y);
    return y;
  };
  const drawRightTieCallout = (
    kind: NonNullable<ScheduleRow["extraKind"]>,
    preferredY: number,
    tickX: number,
  ) => {
    const row = extraRow(kind);
    if (!row) return;
    const spec = `Ø${row.dia} a${row.spacing ?? cut.spacing}`;
    drawLayerCallout(ctx, rightX, pickRightY(preferredY), String(row.markNum), spec, tickX, "right");
  };

  for (const e of drawnTopExtras) {
    const row = markForBar(model.schedule, e.bar);
    if (!row) continue;
    const touch = e.xs[e.xs.length - 1] ?? innerR;
    drawLayerCallout(ctx, rightX, e.y, String(row.markNum), barNotation(e.bar.qty, e.bar.dia), touch, "right");
  }
  // Đai C / lồng: cùng cột phải với số 4 — số hiệu, đường dẫn, Ø, khoảng cách.
  const belowTopExtra = drawnTopExtras.length
    ? Math.max(...drawnTopExtras.map((e) => e.y)) + minRightGap
    : topY + (antiY - topY) * 0.45;
  if (cut.extraCCx) drawRightTieCallout("c-cx", belowTopExtra, innerR);
  if (cut.extraCCy) drawRightTieCallout("c-cy", belowTopExtra, midX);
  if (cut.extraNestedCx && !cut.extraDouble) {
    drawRightTieCallout("nested-cx", topY + (botY - topY) * 0.22, midX);
  }
  if (cut.extraNestedCy && !cut.extraDouble) {
    drawRightTieCallout("nested-cy", antiY, innerL);
  }
  for (const e of drawnBotExtras) {
    const row = markForBar(model.schedule, e.bar);
    if (!row) continue;
    const touch = e.xs[e.xs.length - 1] ?? innerR;
    drawLayerCallout(ctx, rightX, e.y, String(row.markNum), barNotation(e.bar.qty, e.bar.dia), touch, "right");
  }

  const titleY = boxY + H + 32;
  const titleSize = 10;
  textSimple(ctx, title, cx + W / 2, titleY, titleSize, true, "center");
  const titleW = ctx.fontBold.widthOfTextAtSize(title, titleSize);
  const underlineY = titleY + titleSize * 0.92;
  line(ctx, cx + W / 2 - titleW / 2 - 1, underlineY, cx + W / 2 + titleW / 2 + 1, underlineY, 0.9);
  textSimple(ctx, "TL: 1/25", cx + W / 2, underlineY + 4, 7, false, "center");
}

function drawStirrupDetail(ctx: Ctx, ox: number, oy: number, row: ScheduleRow | undefined) {
  if (!row) return;
  const { model } = ctx;
  const s = 0.22;
  const w = Math.max((row.segs[0] || model.stirrups.innerB) * s, 22);
  const h = Math.max((row.segs[1] || model.stirrups.innerH) * s, 36);
  const x = ox + 24;
  const y = oy + 8;
  if (row.shape === "stirrup") {
    drawStirrupFrame(ctx, x, y, w, h, 0.9);
    textSimple(
      ctx,
      String(Math.round(row.segs[0] ?? model.stirrups.innerB)),
      x + w / 2,
      y + 9,
      6.4,
      false,
      "center",
    );
    dimV(ctx, x + w + 10, y, y + h, String(Math.round(row.segs[1] ?? model.stirrups.innerH)), 6.2);
    dimV(ctx, x - 14, y, y + 10, String(Math.round(row.segs[2] ?? model.stirrups.hook)), 5.8);
  } else if (row.shape === "u-bottom") {
    const len = Math.max(w, 28);
    const hook = 8;
    line(ctx, x, y + 4, x, y + hook + 4, 0.85);
    line(ctx, x, y + hook + 4, x + len, y + hook + 4, 0.85);
    line(ctx, x + len, y + hook + 4, x + len, y + 4, 0.85);
    dimH(ctx, x, x + len, y + hook + 16, String(Math.round(row.segs[1] ?? 0)), 6);
  } else {
    line(ctx, x, y + 18, x + 40, y + 18, 0.85);
    textAboveLine(ctx, String(Math.round(row.barLength)), x + 20, y + 18, 6, "center", false, 2.8);
  }
  const spec = `${row.qtyEach}Ø${row.dia} L=${row.barLength}`;
  markCircle(ctx, x + w / 2 - 36, y + h + 28, row.mark, 6.5);
  textSimple(ctx, spec, x + w / 2 - 28, y + h + 31, 7);
  if (row.label) textSimple(ctx, row.label, x + w / 2 - 28, y + h + 40, 5.6);
}

function drawShape(ctx: Ctx, row: ScheduleRow, x: number, y: number, w: number, h: number) {
  const cy = y + h / 2 + 1;
  if (row.shape === "stirrup") {
    const bw = Math.min(40, w * 0.28);
    const bh = Math.min(h - 8, 22);
    const sx = x + w / 2 - bw / 2;
    const sy = cy - bh / 2;
    drawStirrupFrame(ctx, sx, sy, bw, bh, 0.65);
    textSimple(ctx, String(Math.round(row.segs[0] ?? 0)), sx + bw / 2, sy + 6.2, 5.6, false, "center");
    textSimple(ctx, String(Math.round(row.segs[1] ?? 0)), sx + bw + 3, cy + 2, 5.6);
    textSimple(ctx, String(Math.round(row.segs[2] ?? 0)), sx - 12, sy + 2, 5.6);
    return;
  }
  const x1 = x + 10;
  const x2 = x + w - 12;
  const hook = Math.min(11, h * 0.38);
  line(ctx, x1, cy, x2, cy, 0.85);
  const down = row.shape === "u-top" || row.family === "T1" || row.family === "T2";
  const dir = down ? 1 : -1;
  if (row.shape === "u-top" || row.shape === "u-bottom") {
    line(ctx, x1, cy, x1, cy + dir * hook, 0.85);
    line(ctx, x2, cy, x2, cy + dir * hook, 0.85);
    textSimple(ctx, String(Math.round(row.segs[0] ?? 0)), x1 - 1, cy + (dir > 0 ? hook + 7 : 8), 5.5, false, "center");
    textAboveLine(ctx, String(Math.round(row.segs[1] ?? 0)), (x1 + x2) / 2, cy, 6, "center", false, 2.8);
    textSimple(ctx, String(Math.round(row.segs[2] ?? 0)), x2 + 1, cy + (dir > 0 ? hook + 7 : 8), 5.5, false, "center");
  } else if (row.shape === "l-left") {
    line(ctx, x1, cy, x1, cy + dir * hook, 0.85);
    textSimple(ctx, String(Math.round(row.segs[0] ?? 0)), x1 - 1, cy + (dir > 0 ? hook + 7 : 8), 5.5, false, "center");
    textAboveLine(ctx, String(Math.round(row.segs[1] ?? 0)), (x1 + x2) / 2, cy, 6, "center", false, 2.8);
  } else if (row.shape === "l-right") {
    line(ctx, x2, cy, x2, cy + dir * hook, 0.85);
    textAboveLine(ctx, String(Math.round(row.segs[0] ?? 0)), (x1 + x2) / 2, cy, 6, "center", false, 2.8);
    textSimple(ctx, String(Math.round(row.segs[1] ?? 0)), x2 + 1, cy + (dir > 0 ? hook + 7 : 8), 5.5, false, "center");
  } else {
    textAboveLine(ctx, String(Math.round(row.segs[0] ?? 0)), (x1 + x2) / 2, cy, 6, "center", false, 2.8);
  }
}

function fmtNum(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "0";
  const t = n.toFixed(digits);
  return t.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function drawScheduleTable(ctx: Ctx, x: number, y: number) {
  const { project, model } = ctx;
  const rows = model.schedule;
  const cols = [
    { w: 36 },
    { w: 32 },
    { w: 168 },
    { w: 28 },
    { w: 52 },
    { w: 28 },
    { w: 32 },
    { w: 36 },
    { w: 48 },
    { w: 50 },
  ];
  const w = cols.reduce((s, c) => s + c.w, 0);
  const headerH = 52;
  const avail = Math.max(PAGE_H - y - 36, 120);
  const rowH = Math.min(29, Math.max(16, (avail - headerH - 8) / Math.max(rows.length, 1)));
  const h = headerH + rows.length * rowH;
  textSimple(ctx, "BẢNG THỐNG KÊ CỐT THÉP", x + w / 2, y + 2, 10.5, true, "center");
  const schedTitleW = ctx.fontBold.widthOfTextAtSize("BẢNG THỐNG KÊ CỐT THÉP", 10.5);
  line(ctx, x + w / 2 - schedTitleW / 2, y + 10.5 * 0.95, x + w / 2 + schedTitleW / 2, y + 10.5 * 0.95, 0.7);
  const ty0 = y + 20;
  rect(ctx, x, ty0, w, h, 0.9);
  const colX: number[] = [];
  let cx = x;
  for (const c of cols) {
    colX.push(cx);
    cx += c.w;
  }
  const mid = (i: number) => colX[i] + cols[i].w / 2;
  for (let i = 1; i < cols.length; i++) line(ctx, colX[i], ty0, colX[i], ty0 + h, 0.4);
  line(ctx, x, ty0 + headerH, x + w, ty0 + headerH, 0.7);
  line(ctx, colX[5], ty0 + 18, colX[8], ty0 + 18, 0.4);
  line(ctx, colX[6], ty0 + 34, colX[8], ty0 + 34, 0.35);

  textSimple(ctx, "TÊN", mid(0), ty0 + 16, 6.2, false, "center");
  textSimple(ctx, "CẤU KIỆN", mid(0), ty0 + 28, 6.2, false, "center");
  textSimple(ctx, "SỐ", mid(1), ty0 + 16, 6.2, false, "center");
  textSimple(ctx, "HIỆU", mid(1), ty0 + 28, 6.2, false, "center");
  textSimple(ctx, "HÌNH DẠNG &", mid(2), ty0 + 14, 6.4, false, "center");
  textSimple(ctx, "KÍCH THƯỚC (mm)", mid(2), ty0 + 28, 6.4, false, "center");
  textSimple(ctx, "Ø", mid(3), ty0 + 16, 7, false, "center");
  textSimple(ctx, "(mm)", mid(3), ty0 + 30, 5.8, false, "center");
  textSimple(ctx, "CHIỀU DÀI", mid(4), ty0 + 12, 6, false, "center");
  textSimple(ctx, "1 THANH", mid(4), ty0 + 24, 6, false, "center");
  textSimple(ctx, "(mm)", mid(4), ty0 + 38, 5.8, false, "center");
  textSimple(ctx, "SỐ THANH", (mid(5) + mid(7)) / 2, ty0 + 8, 6.2, false, "center");
  textSimple(ctx, "C.KIỆN", mid(5), ty0 + 42, 5.6, false, "center");
  textSimple(ctx, "MỘT CK", mid(6), ty0 + 42, 5.6, false, "center");
  textSimple(ctx, "TOÀN BỘ", mid(7), ty0 + 42, 5.6, false, "center");
  textSimple(ctx, "TỔNG", mid(8), ty0 + 12, 6, false, "center");
  textSimple(ctx, "CHIỀU DÀI", mid(8), ty0 + 24, 6, false, "center");
  textSimple(ctx, "(m)", mid(8), ty0 + 38, 5.8, false, "center");
  textSimple(ctx, "TỔNG", mid(9), ty0 + 12, 6, false, "center");
  textSimple(ctx, "TRỌNG LƯỢNG", mid(9), ty0 + 24, 6, false, "center");
  textSimple(ctx, "(kg)", mid(9), ty0 + 38, 5.8, false, "center");

  rows.forEach((row, i) => {
    const ry = ty0 + headerH + i * rowH;
    line(ctx, colX[1], ry + rowH, x + w, ry + rowH, 0.3);
    textSimple(ctx, row.mark, mid(1), ry + rowH / 2 + 3, 7.5, false, "center");
    drawShape(ctx, row, colX[2], ry, cols[2].w, rowH);
    textSimple(ctx, String(row.dia), mid(3), ry + rowH / 2 + 3, 7.5, false, "center");
    textSimple(ctx, String(row.barLength), mid(4), ry + rowH / 2 + 3, 7.5, false, "center");
    textSimple(ctx, String(row.qtyMembers), mid(5), ry + rowH / 2 + 3, 7.5, false, "center");
    textSimple(ctx, String(row.qtyEach), mid(6), ry + rowH / 2 + 3, 7.5, false, "center");
    textSimple(ctx, String(row.qtyTotal), mid(7), ry + rowH / 2 + 3, 7.5, false, "center");
    textSimple(ctx, fmtNum(row.totalM), mid(8), ry + rowH / 2 + 3, 7.2, false, "center");
    textSimple(ctx, fmtNum(row.weight), mid(9), ry + rowH / 2 + 3, 7.2, false, "center");
  });

  textVertical(ctx, project.info.name || "DẦM", mid(0), ty0 + headerH + (rows.length * rowH) / 2, 10, true);
  return { w, h: h + 18 };
}

function drawSummaryTable(ctx: Ctx, x: number, y: number) {
  const { model } = ctx;
  const dias = model.byDia;
  const colW = 78;
  const labW = 138;
  const w = labW + Math.max(dias.length, 1) * colW;
  const rowH = 24;
  const nRows = 4;
  const gridH = nRows * rowH;
  const titleSize = 10.5;
  textSimple(ctx, "TỔNG HỢP CỐT THÉP", x + w / 2, y + 2, titleSize, true, "center");
  const titleW = ctx.fontBold.widthOfTextAtSize("TỔNG HỢP CỐT THÉP", titleSize);
  line(ctx, x + w / 2 - titleW / 2, y + titleSize * 0.95, x + w / 2 + titleW / 2, y + titleSize * 0.95, 0.7);
  const ty0 = y + 20;
  rect(ctx, x, ty0, w, gridH, 0.9);
  line(ctx, x + labW, ty0, x + labW, ty0 + gridH, 0.5);
  for (let i = 1; i < Math.max(dias.length, 1); i++) {
    line(ctx, x + labW + i * colW, ty0, x + labW + i * colW, ty0 + gridH, 0.45);
  }
  const labels = ["ĐƯỜNG KÍNH (mm):", "CHIỀU DÀI (m):", "TRỌNG LƯỢNG (kg):", "SỐ THANH 11.7m:"];
  const textTop = (row: number, size = 7.5) => ty0 + row * rowH + (rowH - size * 0.78) / 2;
  labels.forEach((lb, i) => {
    if (i > 0) line(ctx, x, ty0 + i * rowH, x + w, ty0 + i * rowH, 0.4);
    textSimple(ctx, lb, x + 8, textTop(i, 7), 7);
  });
  line(ctx, x, ty0 + gridH, x + w, ty0 + gridH, 0.95);
  dias.forEach((d, i) => {
    const cx = x + labW + i * colW + colW / 2;
    textSimple(ctx, `Ø${d.dia}`, cx, textTop(0, 8), 8, true, "center");
    textSimple(ctx, fmtNum(d.lengthM), cx, textTop(1), 7.5, false, "center");
    textSimple(ctx, fmtNum(d.weight), cx, textTop(2), 7.5, false, "center");
    const stock = d.dia <= 10 ? "—" : String(Math.ceil(d.lengthM / STOCK_M));
    textSimple(ctx, stock, cx, textTop(3), 7.5, false, "center");
  });
  if (dias.length === 0) {
    textSimple(ctx, "—", x + labW + colW / 2, textTop(0, 8), 8, false, "center");
  }
  const g1 = dias.filter((d) => d.dia <= 10).reduce((s, d) => s + d.weight, 0);
  const g2 = dias.filter((d) => d.dia > 10 && d.dia <= 18).reduce((s, d) => s + d.weight, 0);
  const g3 = dias.filter((d) => d.dia > 18).reduce((s, d) => s + d.weight, 0);
  const fy = ty0 + gridH + 12;
  textSimple(ctx, `NHÓM Ø<=10 (kg):    ${fmtNum(g1)}`, x + 8, fy, 7.5);
  textSimple(ctx, `NHÓM 10<Ø<=18 (kg):    ${fmtNum(g2)}`, x + 8, fy + 16, 7.5);
  if (g3 > 0) textSimple(ctx, `NHÓM Ø>18 (kg):    ${fmtNum(g3)}`, x + 8, fy + 32, 7.5);
}

export async function generateBeamPdf(
  project: BeamProject,
  fonts: { regular: ArrayBuffer; bold: ArrayBuffer },
): Promise<Uint8Array> {
  const model = computeModel(project);
  const pdf = await PDFDocument.create();
  const kit = (fontkit as { default?: unknown }).default ?? fontkit;
  pdf.registerFontkit(kit as never);
  const font = await pdf.embedFont(fonts.regular, { subset: true });
  const fontBold = await pdf.embedFont(fonts.bold, { subset: true });
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  const first = supportFaces(project, 0);
  const lastF = supportFaces(project, project.spans.length);
  const xMin = first.left;
  const xMax = Math.max(lastF.right, xMin + 1);
  const originLeft = 150;
  const originRight = 48;
  const usable = PAGE_W - originLeft - originRight;
  const scale = usable / (xMax - xMin);
  const originX = originLeft - xMin * scale;

  const ctx: Ctx = { page, font, fontBold, project, model, originX, scale };
  const cuts = buildCuts(ctx);

  ctx.page.drawRectangle({
    x: 16,
    y: 16,
    width: PAGE_W - 32,
    height: PAGE_H - 32,
    borderColor: BLACK,
    borderWidth: 1.05,
  });

  const elevTop = 82;
  const beamH = 52;
  let y = drawElevation(ctx, elevTop, beamH, cuts);

  const title = `${project.info.name} (SL=${project.info.quantity}; L=${Math.round(model.total)})`;
  textSimple(ctx, title, PAGE_W / 2, y + 2, 13, true, "center");
  textSimple(ctx, "TL: 1/50", PAGE_W / 2, y + 18, 9, false, "center");
  y += 38;
  y = drawExplodedShops(ctx, y);

  const uniqueCuts: CutLoc[] = [];
  const seen = new Set<number>();
  for (const c of cuts) {
    if (seen.has(c.n)) continue;
    seen.add(c.n);
    uniqueCuts.push(c);
  }
  uniqueCuts.sort((a, b) => a.n - b.n);

  const stirrupRow =
    model.schedule.find((r) => r.family === "D" && !r.extraKind) ??
    model.schedule.find((r) => r.extraKind === "double");
  const sectTop = y + 8;
  const n = Math.max(uniqueCuts.length, 1);
  const boxW = Math.max(model.B * SECTION_SCALE, 28);
  const boxH = Math.max(model.H * SECTION_SCALE, 48);
  const cellW = 70 + boxW + 78;
  const stirrupW = stirrupRow ? 140 : 16;
  const avail = PAGE_W - 36 - stirrupW;
  const pitch = Math.min(cellW + 8, avail / n);
  uniqueCuts.forEach((c, i) => {
    drawCrossSection(ctx, 18 + i * pitch, sectTop, c, `${c.n}-${c.n}`);
  });
  if (stirrupRow) {
    drawStirrupDetail(ctx, 18 + n * pitch, sectTop + 12, stirrupRow);
  }
  const tableY = Math.min(sectTop + boxH + 56, PAGE_H - 220);
  const table = drawScheduleTable(ctx, 36, tableY);
  drawSummaryTable(ctx, 36 + table.w + 28, tableY);

  return pdf.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
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
