import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { BeamProject } from "../types";
import {
  barFamilyOf,
  barNotation,
  computeModel,
  extraLayerOffsetMm,
  stirrupZonesForSpan,
  supportFaces,
  supportGeometry,
  type ComputedModel,
  type ResolvedBar,
  type ScheduleRow,
} from "../calc";

const PAGE_W = 1684;
const PAGE_H = 1191;
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const STOCK_M = 11.7;
const SECTION_SCALE = (72 / 25.4) / 25;

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
  ctx.page.drawCircle({
    x: cx,
    y: ty(cy),
    size: r,
    borderColor: BLACK,
    borderWidth: fill ? 0 : 0.6,
    color: fill ? BLACK : undefined,
  });
}

function bubble(ctx: Ctx, cx: number, cy: number, r = 8) {
  ctx.page.drawCircle({
    x: cx,
    y: ty(cy),
    size: r,
    color: WHITE,
    borderColor: BLACK,
    borderWidth: 0.7,
  });
}

function markCircle(ctx: Ctx, cx: number, cy: number, mark: string, r = 7) {
  bubble(ctx, cx, cy, r);
  textSimple(ctx, mark, cx, cy + 2.5, mark.length > 2 ? 5.5 : 7.5, false, "center");
}

function dimH(ctx: Ctx, x1: number, x2: number, y: number, label: string, size = 6.5) {
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  if (b - a < 2) return;
  line(ctx, a, y, b, y, 0.35);
  line(ctx, a, y - 2.4, a, y + 2.4, 0.35);
  line(ctx, b, y - 2.4, b, y + 2.4, 0.35);
  line(ctx, a, y - 2.2, a + 3.2, y + 2.2, 0.3);
  line(ctx, b, y - 2.2, b - 3.2, y + 2.2, 0.3);
  if (b - a > 14 || label.length < 5) {
    textSimple(ctx, label, (a + b) / 2, y - 1.5, size, false, "center");
  }
}

function dimV(ctx: Ctx, x: number, y1: number, y2: number, label: string, size = 6.5) {
  const a = Math.min(y1, y2);
  const b = Math.max(y1, y2);
  if (b - a < 2) return;
  line(ctx, x, a, x, b, 0.35);
  line(ctx, x - 2.4, a, x + 2.4, a, 0.35);
  line(ctx, x - 2.4, b, x + 2.4, b, 0.35);
  textSimple(ctx, label, x + 4, (a + b) / 2 + 2.5, size);
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
  return schedule.find((r) => {
    if (r.family === "D") return false;
    if (
      r.bars.some(
        (b) =>
          b.sourceId === bar.sourceId &&
          Math.abs(b.x1 - bar.x1) < 2 &&
          Math.abs(b.x2 - bar.x2) < 2,
      )
    ) {
      return true;
    }
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
  dir: 1 | -1,
) {
  const mid = (x1 + x2) / 2;
  const spanPt = Math.abs(x2 - x1);
  const size = spanPt < 90 ? 6 : 7.5;
  const font = ctx.font;
  const sw = font.widthOfTextAtSize(spec, size);
  if (spanPt < 86) {
    markCircle(ctx, mid, y + (dir > 0 ? 12 : -10), mark, 5.8);
    textSimple(ctx, spec, mid, y + (dir > 0 ? -10 : 14), size, false, "center");
    return;
  }
  const off = dir > 0 ? -11 : 14;
  markCircle(ctx, mid - sw / 2 - 11, y + off, mark, 6.8);
  textSimple(ctx, spec, mid - sw / 2, y + off + 2.4, size);
}

function drawMainShopRows(ctx: Ctx, bar: ResolvedBar, row: ScheduleRow | undefined, y: number, dir: 1 | -1) {
  const family = row?.family ?? barFamilyOf(bar);
  const mark = row?.mark ?? "1a";
  const parts = splitQty(bar.qty || 1, bar.face);
  let yy = y;
  for (const q of parts) {
    const x1 = xAt(ctx, bar.x1);
    const x2 = xAt(ctx, bar.x2);
    drawHookedBar(ctx, x1, x2, yy, bar.hookStart, bar.hookEnd, dir, 1.15);
    const hs = Math.max(bar.hookStart * ctx.scale * 0.28, bar.hookStart > 0 ? 9 : 0);
    const he = Math.max(bar.hookEnd * ctx.scale * 0.28, bar.hookEnd > 0 ? 9 : 0);
    if (bar.hookStart > 0) dimV(ctx, x1 - 11, yy, yy + dir * hs, String(Math.round(bar.hookStart)), 6);
    if (bar.hookEnd > 0) dimV(ctx, x2 + 8, yy, yy + dir * he, String(Math.round(bar.hookEnd)), 6);
    drawShopSpec(ctx, x1, x2, yy, mark, shopSpec(q, bar, family), dir);
    yy += 32;
  }
  return yy;
}

function drawExtraShopRow(ctx: Ctx, bars: ResolvedBar[], schedule: ScheduleRow[], y: number, dir: 1 | -1) {
  for (const b of bars) {
    const x1 = xAt(ctx, b.x1);
    const x2 = xAt(ctx, b.x2);
    const row = markForBar(schedule, b);
    const family = row?.family ?? barFamilyOf(b);
    const mark = row?.mark ?? "";
    drawHookedBar(ctx, x1, x2, y, b.hookStart, b.hookEnd, dir, 1.05);
    dimH(ctx, x1, x2, y + (dir > 0 ? -10 : 10), String(Math.round(b.straight)), 6.2);
    const hs = Math.max(b.hookStart * ctx.scale * 0.28, b.hookStart > 0 ? 8 : 0);
    const he = Math.max(b.hookEnd * ctx.scale * 0.28, b.hookEnd > 0 ? 8 : 0);
    if (b.hookStart > 0) dimV(ctx, x1 - 10, y, y + dir * hs, String(Math.round(b.hookStart)), 6);
    if (b.hookEnd > 0) dimV(ctx, x2 + 7, y, y + dir * he, String(Math.round(b.hookEnd)), 6);
    drawShopSpec(ctx, x1, x2, y, mark, shopSpec(b.qty, b, family), dir);
  }
}

type CutLoc = {
  n: number;
  x: number;
  kind: "support" | "span";
  extraTop: ResolvedBar[];
  extraBot: ResolvedBar[];
  spacing: number;
};

function buildCuts(ctx: Ctx): CutLoc[] {
  const { project, model } = ctx;
  const raw: Omit<CutLoc, "n">[] = [];
  project.supports.forEach((_, i) => {
    const f = supportFaces(project, i);
    const spanI = i === 0 ? 0 : Math.min(i, project.spans.length) - (i === project.spans.length ? 1 : 0);
    const zones = stirrupZonesForSpan(project, Math.max(0, Math.min(spanI, project.spans.length - 1)), model.extraTop);
    raw.push({
      x: f.axis,
      kind: "support",
      extraTop: model.extraTop.filter((b) => covers(b, f.axis, 80)),
      extraBot: model.extraBottom.filter((b) => covers(b, f.axis, 40)),
      spacing: zones.left.spacing || project.stirrups[spanI]?.a1 || 150,
    });
  });
  project.spans.forEach((_, i) => {
    const left = supportFaces(project, i).right;
    const right = supportFaces(project, i + 1).left;
    const x = (left + right) / 2;
    const zones = stirrupZonesForSpan(project, i, model.extraTop);
    raw.push({
      x,
      kind: "span",
      extraTop: model.extraTop.filter((b) => covers(b, x, 40)),
      extraBot: model.extraBottom.filter((b) => covers(b, x, 80)),
      spacing: zones.mid.spacing,
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
    return `${c.kind}|${et}|${eb}|${c.spacing}`;
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

function drawCutMark(ctx: Ctx, x: number, y0: number, y1: number, n: number) {
  line(ctx, x, y0, x, y1, 0.4);
  const s = 3.6;
  line(ctx, x - s, y0, x + s, y0, 0.45);
  line(ctx, x - s, y0, x, y0 + s * 1.3, 0.45);
  line(ctx, x + s, y0, x, y0 + s * 1.3, 0.45);
  line(ctx, x - s, y1, x + s, y1, 0.45);
  line(ctx, x - s, y1, x, y1 - s * 1.3, 0.45);
  line(ctx, x + s, y1, x, y1 - s * 1.3, 0.45);
  textSimple(ctx, String(n), x, y0 - 1, 7, true, "center");
  textSimple(ctx, String(n), x, y1 + 9, 7, true, "center");
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
    textSimple(ctx, sup.axisName || String(i), ax, y1 + 69, 8, true, "center");
  });

  const dimY = y0 - 28;
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

  project.spans.forEach((sp, i) => {
    const a = xAt(ctx, model.xs[i]);
    const b = xAt(ctx, model.xs[i + 1]);
    dimH(ctx, a, b, y1 + 48, String(sp.L), 7.5);
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

  for (const t of model.stirrups.ticks) {
    const x = xAt(ctx, t.x);
    line(ctx, x, y0 + 2.5, x, y1 - 2.5, t.dense ? 0.5 : 0.32);
  }

  const stMark = model.schedule.find((r) => r.family === "D")?.mark ?? "9";
  for (const lb of model.stirrups.labels) {
    const x = xAt(ctx, lb.x);
    markCircle(ctx, x - 28, y0 - 12, stMark, 5.8);
    textSimple(ctx, lb.text.replace(/^\d+/, (m) => m), x - 21, y0 - 9.5, 6.2);
  }

  const call = (bar: ResolvedBar, y: number, side: 1 | -1) => {
    const row = markForBar(model.schedule, bar);
    if (!row) return;
    const x = xAt(ctx, (bar.x1 + bar.x2) / 2);
    markCircle(ctx, x - 18, y + (side > 0 ? 11 : -8), String(row.markNum), 5.6);
    textSimple(ctx, barNotation(bar.qty, bar.dia), x - 11, y + (side > 0 ? 13.5 : -5.5), 6.3);
  };
  for (const b of model.extraTop) call(b, topY, 1);
  for (const b of model.extraBottom) call(b, botY, -1);

  const mb = model.schedule.find((r) => r.family === "B1");
  const mt = model.schedule.find((r) => r.family === "T1");
  if (mt && model.mainTop[0]) {
    textSimple(ctx, `${mt.markNum}  ${barNotation(model.mainTop[0].qty, model.mainTop[0].dia)}`, xStart - 6, topY + 4, 6.5, false, "right");
  }
  if (mb && model.mainBottom[0]) {
    textSimple(ctx, `${mb.markNum}  ${barNotation(model.mainBottom[0].qty, model.mainBottom[0].dia)}`, xStart - 6, botY + 4, 6.5, false, "right");
  }

  const elev = ctx.project.info.elevation;
  const elevStr = elev === 0 ? "±0.000" : (elev > 0 ? `+${elev.toFixed(3)}` : elev.toFixed(3));
  textSimple(ctx, elevStr, xStart - 8, y0 + 3, 7, false, "right");
  dimV(ctx, xStart - 22, y0, y1, String(model.H), 7);

  for (const c of cuts) {
    drawCutMark(ctx, xAt(ctx, c.x), y0 - 18, y1 + 20, c.n);
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

function barXs(cx: number, w: number, pad: number, n: number) {
  const count = Math.max(1, n);
  if (count === 1) return [cx + w / 2];
  return Array.from({ length: count }, (_, i) => cx + pad + ((w - 2 * pad) * i) / (count - 1));
}

function drawSectionCallout(ctx: Ctx, x: number, y: number, mark: string, text: string, toX: number, toY: number) {
  markCircle(ctx, x, y, mark, 6.2);
  textSimple(ctx, text, x + 8, y + 2.6, 6.5);
  line(ctx, x + 6, y, toX, toY, 0.35);
}

function drawCrossSection(
  ctx: Ctx,
  ox: number,
  oy: number,
  cut: CutLoc,
  title: string,
) {
  const { model, project } = ctx;
  const W = Math.max(model.B * SECTION_SCALE, 18);
  const H = Math.max(model.H * SECTION_SCALE, 28);
  const cx = ox + 52;
  const boxY = oy + 16;
  rect(ctx, cx, boxY, W, H, 1.05);
  const inset = Math.max(3.2, (project.info.cover || 25) * SECTION_SCALE);
  rect(ctx, cx + inset, boxY + inset, Math.max(W - inset * 2, 4), Math.max(H - inset * 2, 4), 0.45);
  dashV(ctx, cx + W / 2, boxY - 4, boxY + H + 10, 2.4, 1.8, 0.25);

  const pad = inset + 3.2;
  const r = 2.15;
  const topN = Math.min(model.mainTop[0]?.qty || 0, 6);
  const botN = Math.min(model.mainBottom[0]?.qty || 0, 6);
  const topXs = barXs(cx, W, pad, Math.max(topN, 2));
  const botXs = barXs(cx, W, pad, Math.max(botN, 2));
  if (topN) placeDots(ctx, topXs.slice(0, topN), boxY + pad, r);
  if (botN) placeDots(ctx, botXs.slice(0, botN), boxY + H - pad, r);

  const extraTop = cut.kind === "support" ? cut.extraTop : cut.extraTop.filter((b) => covers(b, cut.x, 20));
  const extraBot = cut.kind === "span" ? cut.extraBot : cut.extraBot.filter((b) => covers(b, cut.x, 20));
  const drawExtras = (bars: ResolvedBar[], fromTop: boolean) => {
    const seen = new Set<number>();
    for (const b of bars) {
      if (seen.has(b.layer)) continue;
      seen.add(b.layer);
      const off = extraLayerOffsetMm(b.layer) * SECTION_SCALE + (b.layer <= 1 ? 3.2 : 0);
      const y = fromTop ? boxY + pad + off : boxY + H - pad - off;
      const n = Math.max(1, Math.min(b.qty || 1, 4));
      const xs =
        b.layer <= 1 && topN >= 2
          ? barXs(cx, W, pad, topN).slice(0, -1).map((x, i, arr) => (x + (arr[i + 1] ?? x + 8)) / 2).slice(0, n)
          : barXs(cx, W, pad + 2, n);
      placeDots(ctx, xs, y, r);
    }
  };
  drawExtras(extraTop, true);
  drawExtras(extraBot, false);

  dimV(ctx, cx + W + 10, boxY, boxY + H, String(model.H), 6);
  dimH(ctx, cx, cx + W / 2, boxY + H + 11, String(model.B1), 5.8);
  dimH(ctx, cx + W / 2, cx + W, boxY + H + 11, String(model.B1 || Math.round(model.B / 2)), 5.8);
  dimH(ctx, cx, cx + W, boxY + H + 22, String(model.B), 6.2);

  const mt = model.schedule.find((r) => r.family === "T1");
  const mb = model.schedule.find((r) => r.family === "B1");
  const st = model.schedule.find((r) => r.family === "D");
  if (mt && model.mainTop[0]) {
    drawSectionCallout(ctx, cx - 38, boxY + pad, String(mt.markNum), barNotation(model.mainTop[0].qty, model.mainTop[0].dia), cx + pad, boxY + pad);
  }
  if (mb && model.mainBottom[0]) {
    drawSectionCallout(ctx, cx - 38, boxY + H - pad, String(mb.markNum), barNotation(model.mainBottom[0].qty, model.mainBottom[0].dia), cx + pad, boxY + H - pad);
  }
  const extra = cut.kind === "support" ? extraTop[0] : extraBot[0];
  if (extra) {
    const row = markForBar(model.schedule, extra);
    if (row) {
      const y = cut.kind === "support" ? boxY + pad + 10 : boxY + H / 2;
      drawSectionCallout(ctx, cx - 38, y, String(row.markNum), barNotation(extra.qty, extra.dia), cx + W * 0.35, y);
    }
  }
  if (st) {
    drawSectionCallout(ctx, cx - 38, boxY + H / 2 + 6, st.mark, `Ø${model.stirrups.dia} a${cut.spacing}`, cx + inset, boxY + H / 2);
  }

  textSimple(ctx, title, cx + W / 2, boxY + H + 38, 9, true, "center");
  line(ctx, cx + W / 2 - 14, boxY + H + 40, cx + W / 2 + 14, boxY + H + 40, 0.9);
  line(ctx, cx + W / 2 - 14, boxY + H + 42, cx + W / 2 + 14, boxY + H + 42, 0.55);
  textSimple(ctx, "TL: 1/25", cx + W / 2, boxY + H + 54, 7, false, "center");
}

function drawStirrupDetail(ctx: Ctx, ox: number, oy: number, row: ScheduleRow | undefined) {
  if (!row) return;
  const { model } = ctx;
  const s = 0.22;
  const w = Math.max(model.stirrups.innerB * s, 22);
  const h = Math.max(model.stirrups.innerH * s, 36);
  const x = ox + 24;
  const y = oy + 8;
  rect(ctx, x, y, w, h, 0.9);
  line(ctx, x, y + 8, x - 10, y + 2, 0.8);
  dimH(ctx, x, x + w, y + h + 12, String(Math.round(model.stirrups.innerB)), 6.2);
  dimV(ctx, x + w + 10, y, y + h, String(Math.round(model.stirrups.innerH)), 6.2);
  dimV(ctx, x - 14, y, y + 10, String(Math.round(model.stirrups.hook)), 5.8);
  const spec = `${row.qtyEach}Ø${row.dia} L=${row.barLength}`;
  markCircle(ctx, x + w / 2 - 36, y + h + 28, row.mark, 6.5);
  textSimple(ctx, spec, x + w / 2 - 28, y + h + 31, 7);
}

function drawShape(ctx: Ctx, row: ScheduleRow, x: number, y: number, w: number, h: number) {
  const cy = y + h / 2 + 1;
  if (row.shape === "stirrup") {
    const bw = Math.min(40, w * 0.28);
    const bh = Math.min(h - 8, 22);
    const sx = x + w / 2 - bw / 2;
    const sy = cy - bh / 2;
    rect(ctx, sx, sy, bw, bh, 0.65);
    line(ctx, sx, sy + 4, sx - 7, sy - 2, 0.65);
    textSimple(ctx, String(Math.round(row.segs[0] ?? 0)), sx + bw / 2, sy + bh + 7, 5.6, false, "center");
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
    textSimple(ctx, String(Math.round(row.segs[1] ?? 0)), (x1 + x2) / 2, cy - 2, 6, false, "center");
    textSimple(ctx, String(Math.round(row.segs[2] ?? 0)), x2 + 1, cy + (dir > 0 ? hook + 7 : 8), 5.5, false, "center");
  } else if (row.shape === "l-left") {
    line(ctx, x1, cy, x1, cy + dir * hook, 0.85);
    textSimple(ctx, String(Math.round(row.segs[0] ?? 0)), x1 - 1, cy + (dir > 0 ? hook + 7 : 8), 5.5, false, "center");
    textSimple(ctx, String(Math.round(row.segs[1] ?? 0)), (x1 + x2) / 2, cy - 2, 6, false, "center");
  } else if (row.shape === "l-right") {
    line(ctx, x2, cy, x2, cy + dir * hook, 0.85);
    textSimple(ctx, String(Math.round(row.segs[0] ?? 0)), (x1 + x2) / 2, cy - 2, 6, false, "center");
    textSimple(ctx, String(Math.round(row.segs[1] ?? 0)), x2 + 1, cy + (dir > 0 ? hook + 7 : 8), 5.5, false, "center");
  } else {
    textSimple(ctx, String(Math.round(row.segs[0] ?? 0)), (x1 + x2) / 2, cy - 2, 6, false, "center");
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
  line(ctx, x + w / 2 - 92, y + 14, x + w / 2 + 92, y + 14, 0.7);
  const ty0 = y + 18;
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
  const h = gridH + 52;
  textSimple(ctx, "TỔNG HỢP CỐT THÉP", x + w / 2, y + 2, 10.5, true, "center");
  line(ctx, x + w / 2 - 78, y + 14, x + w / 2 + 78, y + 14, 0.7);
  const ty0 = y + 18;
  rect(ctx, x, ty0, w, h, 0.9);
  line(ctx, x + labW, ty0, x + labW, ty0 + gridH, 0.45);
  for (let i = 1; i < Math.max(dias.length, 1); i++) {
    line(ctx, x + labW + i * colW, ty0, x + labW + i * colW, ty0 + gridH, 0.4);
  }
  const labels = ["ĐƯỜNG KÍNH (mm):", "CHIỀU DÀI (m):", "TRỌNG LƯỢNG (kg):", "SỐ THANH 11.7m:"];
  labels.forEach((lb, i) => {
    if (i > 0) line(ctx, x, ty0 + i * rowH, x + w, ty0 + i * rowH, 0.35);
    textSimple(ctx, lb, x + 8, ty0 + i * rowH + 16, 7);
  });
  dias.forEach((d, i) => {
    const cx = x + labW + i * colW + colW / 2;
    textSimple(ctx, `Ø${d.dia}`, cx, ty0 + 16, 8, true, "center");
    textSimple(ctx, fmtNum(d.lengthM), cx, ty0 + rowH + 16, 7.5, false, "center");
    textSimple(ctx, fmtNum(d.weight), cx, ty0 + rowH * 2 + 16, 7.5, false, "center");
    const stock = d.dia <= 10 ? "—" : String(Math.ceil(d.lengthM / STOCK_M));
    textSimple(ctx, stock, cx, ty0 + rowH * 3 + 16, 7.5, false, "center");
  });
  if (dias.length === 0) {
    textSimple(ctx, "—", x + labW + colW / 2, ty0 + 16, 8, false, "center");
  }
  const g1 = dias.filter((d) => d.dia <= 10).reduce((s, d) => s + d.weight, 0);
  const g2 = dias.filter((d) => d.dia > 10 && d.dia <= 18).reduce((s, d) => s + d.weight, 0);
  const g3 = dias.filter((d) => d.dia > 18).reduce((s, d) => s + d.weight, 0);
  const fy = ty0 + gridH + 14;
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
  const originLeft = 118;
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

  const elevTop = 66;
  const beamH = 52;
  let y = drawElevation(ctx, elevTop, beamH, cuts);

  const title = `${project.info.name} (SL=${project.info.quantity}; L=${Math.round(model.total)})`;
  textSimple(ctx, title, PAGE_W / 2, y + 2, 13, true, "center");
  textSimple(ctx, "TL: 1/50", PAGE_W / 2, y + 18, 9, false, "center");
  y += 38;

  const mt = model.mainTop[0];
  const mtRow = model.schedule.find((r) => r.family === "T1");
  if (mt) y = drawMainShopRows(ctx, mt, mtRow, y, 1) + 6;

  if (model.extraTop.length) {
    project.supports.forEach((sup, i) => {
      const f = supportFaces(project, i);
      const left = xAt(ctx, f.left);
      const right = xAt(ctx, f.right);
      hatch(ctx, left, y - 10, Math.max(right - left, 2), 20, 3.4);
      rect(ctx, left, y - 10, Math.max(right - left, 2), 20, 0.45);
      void sup;
    });
    drawExtraShopRow(ctx, model.extraTop, model.schedule, y, 1);
    y += 40;
  }

  if (model.extraBottom.length) {
    drawExtraShopRow(ctx, model.extraBottom, model.schedule, y, -1);
    y += 40;
  }

  const mb = model.mainBottom[0];
  const mbRow = model.schedule.find((r) => r.family === "B1");
  if (mb) y = drawMainShopRows(ctx, mb, mbRow, y, -1) + 8;

  const uniqueCuts: CutLoc[] = [];
  const seen = new Set<number>();
  for (const c of cuts) {
    if (seen.has(c.n)) continue;
    seen.add(c.n);
    uniqueCuts.push(c);
  }
  uniqueCuts.sort((a, b) => a.n - b.n);

  const stirrupRow = model.schedule.find((r) => r.family === "D");
  const sectTop = Math.max(y + 8, 455);
  const n = Math.max(uniqueCuts.length, 1);
  const stirrupW = stirrupRow ? 130 : 20;
  const avail = PAGE_W - 40 - stirrupW;
  const pitch = Math.min(128, avail / n);
  uniqueCuts.forEach((c, i) => {
    drawCrossSection(ctx, 22 + i * pitch, sectTop, c, `${c.n}-${c.n}`);
  });
  if (stirrupRow) {
    drawStirrupDetail(ctx, 22 + n * pitch, sectTop + 8, stirrupRow);
  }

  const tableY = Math.min(sectTop + 168, 660);
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
