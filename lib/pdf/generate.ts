import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { BeamProject } from "../types";
import {
  barNotation,
  computeModel,
  supportWidthLabel,
  type ComputedModel,
  type ResolvedBar,
  type ScheduleRow,
} from "../calc";

const PAGE_W = 1684;
const PAGE_H = 1191;
const BLACK = rgb(0, 0, 0);

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

function line(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w = 0.7,
) {
  ctx.page.drawLine({
    start: { x: x1, y: ty(y1) },
    end: { x: x2, y: ty(y2) },
    thickness: w,
    color: BLACK,
  });
}

function rect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  t = 0.8,
) {
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
}

function circle(ctx: Ctx, cx: number, cy: number, r: number, fill = false) {
  ctx.page.drawCircle({
    x: cx,
    y: ty(cy),
    size: r,
    borderColor: BLACK,
    borderWidth: 0.6,
    color: fill ? BLACK : undefined,
  });
}

function markCircle(ctx: Ctx, cx: number, cy: number, mark: string, r = 7) {
  circle(ctx, cx, cy, r, false);
  textSimple(ctx, mark, cx, cy + 2.6, mark.length > 2 ? 6 : 8, false, "center");
}

function dimH(
  ctx: Ctx,
  x1: number,
  x2: number,
  y: number,
  label: string,
  size = 7.5,
) {
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  line(ctx, a, y, b, y, 0.45);
  const tick = 3;
  line(ctx, a, y - tick, a, y + tick, 0.45);
  line(ctx, b, y - tick, b, y + tick, 0.45);
  // arrow heads
  line(ctx, a, y, a + 5, y - 2, 0.4);
  line(ctx, a, y, a + 5, y + 2, 0.4);
  line(ctx, b, y, b - 5, y - 2, 0.4);
  line(ctx, b, y, b - 5, y + 2, 0.4);
  textSimple(ctx, label, (a + b) / 2, y - 2, size, false, "center");
}

function dimV(
  ctx: Ctx,
  x: number,
  y1: number,
  y2: number,
  label: string,
  size = 7,
) {
  const a = Math.min(y1, y2);
  const b = Math.max(y1, y2);
  line(ctx, x, a, x, b, 0.45);
  line(ctx, x - 3, a, x + 3, a, 0.45);
  line(ctx, x - 3, b, x + 3, b, 0.45);
  textSimple(ctx, label, x + 4, (a + b) / 2 + 3, size, false, "left");
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
  const hs = hookStart * ctx.scale * 0.35;
  const he = hookEnd * ctx.scale * 0.35;
  if (hookStart > 0) {
    line(ctx, x1, y, x1, y + dir * Math.max(hs, 10), thick);
    line(ctx, x1, y, x1 - 2, y + dir * 4, 0.5);
  }
  if (hookEnd > 0) {
    line(ctx, x2, y, x2, y + dir * Math.max(he, 10), thick);
    line(ctx, x2, y, x2 + 2, y + dir * 4, 0.5);
  }
}

function drawShopRow(
  ctx: Ctx,
  bar: ResolvedBar,
  mark: string,
  y: number,
  dir: 1 | -1,
) {
  const x1 = xAt(ctx, bar.x1);
  const x2 = xAt(ctx, bar.x2);
  drawHookedBar(ctx, x1, x2, y, bar.hookStart, bar.hookEnd, dir);
  dimH(ctx, x1, x2, y - dir * 14, String(Math.round(bar.straight)), 7);
  if (bar.hookStart > 0) {
    dimV(ctx, x1 - 12, y, y + dir * Math.max(bar.hookStart * ctx.scale * 0.35, 10), String(Math.round(bar.hookStart)), 6.5);
  }
  if (bar.hookEnd > 0) {
    dimV(ctx, x2 + 8, y, y + dir * Math.max(bar.hookEnd * ctx.scale * 0.35, 10), String(Math.round(bar.hookEnd)), 6.5);
  }
  const mid = (x1 + x2) / 2;
  const specQty = mark.includes(".") ? 1 : bar.qty;
  const spec = `${mark} ${specQty}Ø${bar.dia}-L=${Math.round(bar.cutLength)}`;
  markCircle(ctx, mid - 70, y + (dir > 0 ? 16 : -10), mark, 7.5);
  textSimple(ctx, spec, mid - 60, y + (dir > 0 ? 20 : -6), 8);
}

function drawLongitudinal(ctx: Ctx, yTop: number, beamH: number) {
  const { project, model } = ctx;
  const y0 = yTop;
  const y1 = yTop + beamH;
  const xStart = xAt(ctx, 0);
  const xEnd = xAt(ctx, model.total);

  // beam outline
  line(ctx, xStart, y0, xEnd, y0, 1.1);
  line(ctx, xStart, y1, xEnd, y1, 1.1);

  // columns / supports
  project.supports.forEach((sup, i) => {
    const x = xAt(ctx, model.xs[i]);
    const half = ((sup.B || 200) * ctx.scale) / 2;
    const colH = 26;
    line(ctx, x - half, y1, x + half, y1, 1.1);
    line(ctx, x - half, y1, x - half, y1 + colH, 1.1);
    line(ctx, x + half, y1, x + half, y1 + colH, 1.1);
    line(ctx, x - half, y0, x - half, y0 - colH, 1.1);
    line(ctx, x + half, y0, x + half, y0 - colH, 1.1);
    line(ctx, x - half, y0, x + half, y0, 1.1);
    // axis dashed
    for (let yy = y0 - 36; yy < y1 + 40; yy += 6) {
      line(ctx, x, yy, x, Math.min(yy + 3, y1 + 40), 0.35);
    }
    textSimple(ctx, supportWidthLabel(project, i), x, y1 + 18, 7, false, "center");
  });

  // span dimensions
  project.spans.forEach((sp, i) => {
    const a = xAt(ctx, model.xs[i]);
    const b = xAt(ctx, model.xs[i + 1]);
    dimH(ctx, a, b, y1 + 36, String(sp.L), 8);
  });

  // main bars inside section
  const topY = y0 + 8;
  const botY = y1 - 8;
  for (const b of model.mainTop) {
    line(ctx, xAt(ctx, b.x1), topY, xAt(ctx, b.x2), topY, 0.9);
  }
  for (const b of model.mainBottom) {
    line(ctx, xAt(ctx, b.x1), botY, xAt(ctx, b.x2), botY, 0.9);
  }
  for (const b of model.extraTop) {
    line(ctx, xAt(ctx, b.x1), topY + 7, xAt(ctx, b.x2), topY + 7, 0.9);
  }
  for (const b of model.extraBottom) {
    line(ctx, xAt(ctx, b.x1), botY - 7, xAt(ctx, b.x2), botY - 7, 0.9);
  }

  // stirrup ticks
  for (const t of model.stirrups.ticks) {
    const x = xAt(ctx, t.x);
    line(ctx, x, y0 + 3, x, y1 - 3, t.dense ? 0.55 : 0.4);
  }

  // stirrup labels under beam
  const labelY = y1 + 8;
  for (const lb of model.stirrups.labels) {
    const x = xAt(ctx, lb.x);
    markCircle(ctx, x - 22, labelY + 4, "9", 6.2);
    textSimple(ctx, lb.text, x - 14, labelY + 7, 6.5);
  }

  // extra bar marks along section
  const extraTopMarks = model.schedule.filter((r) => r.bars[0]?.face === "top" && r.bars[0]?.kind === "extra");
  const extraBotMarks = model.schedule.filter((r) => r.bars[0]?.face === "bottom" && r.bars[0]?.kind === "extra");
  for (const row of extraTopMarks) {
    for (const b of row.bars) {
      const x = xAt(ctx, (b.x1 + b.x2) / 2);
      markCircle(ctx, x, topY + 18, row.mark, 6.2);
      textSimple(ctx, barNotation(b.qty, b.dia), x + 9, topY + 21, 6.5);
    }
  }
  for (const row of extraBotMarks) {
    for (const b of row.bars) {
      const x = xAt(ctx, (b.x1 + b.x2) / 2);
      markCircle(ctx, x, botY - 4, row.mark, 6.2);
      textSimple(ctx, barNotation(b.qty, b.dia), x + 9, botY - 1, 6.5);
    }
  }

  // main bar end labels
  const mb = model.schedule.find((r) => r.bars[0]?.face === "bottom" && r.bars[0]?.kind === "main");
  const mt = model.schedule.find((r) => r.bars[0]?.face === "top" && r.bars[0]?.kind === "main");
  if (mb && model.mainBottom[0]) {
    textSimple(ctx, `${mb.mark}  ${barNotation(model.mainBottom[0].qty, model.mainBottom[0].dia)}`, xStart - 8, botY + 4, 7, false, "right");
    textSimple(ctx, `${mb.mark}  ${barNotation(model.mainBottom[0].qty, model.mainBottom[0].dia)}`, xEnd + 8, botY + 4, 7);
  }
  if (mt && model.mainTop[0]) {
    textSimple(ctx, `${mt.mark}  ${barNotation(model.mainTop[0].qty, model.mainTop[0].dia)}`, xStart - 8, topY + 4, 7, false, "right");
    textSimple(ctx, `${mt.mark}  ${barNotation(model.mainTop[0].qty, model.mainTop[0].dia)}`, xEnd + 8, topY + 4, 7);
  }

  // elevation
  const elev = ctx.project.info.elevation;
  const elevStr = elev === 0 ? "±0.000" : elev.toFixed(3);
  textSimple(ctx, elevStr, xEnd + 36, y0 + 4, 8);
  dimV(ctx, xEnd + 28, y0, y1, String(model.H), 7.5);

  // section marks 1-1 and 2-2
  if (project.spans.length > 0) {
    const s0 = model.xs[0];
    const s1 = model.xs[1] ?? model.total;
    const x11 = xAt(ctx, s0 + (s1 - s0) * 0.18);
    const x22 = xAt(ctx, s0 + (s1 - s0) * 0.5);
    drawSectionMark(ctx, x11, y0 - 8, y1 + 8, "1");
    drawSectionMark(ctx, x22, y0 - 8, y1 + 8, "2");
  }
}

function drawSectionMark(ctx: Ctx, x: number, y0: number, y1: number, n: string) {
  line(ctx, x, y0, x, y1, 0.5);
  textSimple(ctx, n, x, y0 - 2, 7, true, "center");
  textSimple(ctx, n, x, y1 + 10, 7, true, "center");
}

function drawCrossSection(
  ctx: Ctx,
  ox: number,
  oy: number,
  title: string,
  top: { mark: string; text: string },
  bot: { mark: string; text: string },
  extra: { mark: string; text: string }[],
  stirrup: { mark: string; text: string },
) {
  const { model } = ctx;
  const scale = 0.22;
  const W = model.B * scale;
  const H = model.H * scale;
  const cx = ox + 70;
  const topY = oy;
  const boxY = oy + 18;
  rect(ctx, cx, boxY, W, H, 1.1);
  // stirrup inner
  const inset = 6;
  rect(ctx, cx + inset, boxY + inset, W - inset * 2, H - inset * 2, 0.6);

  const r = 3.2;
  const pad = 10;
  // top bars
  const tcount = 3;
  for (let i = 0; i < tcount; i++) {
    const x = cx + pad + ((W - 2 * pad) * i) / Math.max(tcount - 1, 1);
    circle(ctx, x, boxY + pad, r, true);
  }
  // bottom bars
  for (let i = 0; i < tcount; i++) {
    const x = cx + pad + ((W - 2 * pad) * i) / Math.max(tcount - 1, 1);
    circle(ctx, x, boxY + H - pad, r, true);
  }
  // extra mid
  extra.slice(0, 1).forEach(() => {
    circle(ctx, cx + pad, boxY + H / 2, r, true);
    circle(ctx, cx + W - pad, boxY + H / 2, r, true);
  });

  // dimensions
  dimV(ctx, cx + W + 14, boxY, boxY + H, String(model.H), 7);
  const b1 = model.B1;
  dimH(ctx, cx, cx + W / 2, boxY + H + 16, String(b1), 6.5);
  dimH(ctx, cx + W / 2, cx + W, boxY + H + 16, String(b1), 6.5);
  textSimple(ctx, String(model.B), cx + W / 2, boxY + H + 28, 7, false, "center");

  // callouts left
  markCircle(ctx, cx - 36, boxY + pad, top.mark, 6.5);
  textSimple(ctx, top.text, cx - 28, boxY + pad + 3, 7);
  markCircle(ctx, cx - 36, boxY + H - pad, bot.mark, 6.5);
  textSimple(ctx, bot.text, cx - 28, boxY + H - pad + 3, 7);
  markCircle(ctx, cx - 36, boxY + H / 2 - 8, stirrup.mark, 6.5);
  textSimple(ctx, stirrup.text, cx - 28, boxY + H / 2 - 5, 7);
  extra.forEach((e, i) => {
    markCircle(ctx, cx - 36 - i * 14, boxY + H / 2 + 10, e.mark, 6);
    if (i === 0) textSimple(ctx, e.text, cx - 28, boxY + H / 2 + 13, 7);
  });

  textSimple(ctx, title, cx + W / 2, boxY + H + 44, 9, true, "center");
  void topY;
}

function drawShape(ctx: Ctx, row: ScheduleRow, x: number, y: number, w: number, h: number) {
  const cy = y + h / 2;
  if (row.shape === "stirrup") {
    const bw = 36;
    const bh = 22;
    const sx = x + 28;
    const sy = cy - bh / 2;
    rect(ctx, sx, sy, bw, bh, 0.7);
    line(ctx, sx, sy, sx - 8, sy + 6, 0.7);
    textSimple(ctx, String(row.segs[0] ?? ""), sx + bw / 2, sy + bh + 8, 6, false, "center");
    textSimple(ctx, String(row.segs[1] ?? ""), sx + bw + 3, cy + 2, 6);
    textSimple(ctx, String(row.segs[2] ?? ""), sx - 10, sy - 2, 6);
    return;
  }
  const x1 = x + 8;
  const x2 = x + w - 10;
  line(ctx, x1, cy, x2, cy, 0.9);
  if (row.shape === "u-top") {
    line(ctx, x1, cy, x1, cy + 10, 0.9);
    line(ctx, x2, cy, x2, cy + 10, 0.9);
    textSimple(ctx, String(row.segs[0] ?? ""), x1 - 2, cy + 12, 6, false, "center");
    textSimple(ctx, String(row.segs[1] ?? ""), (x1 + x2) / 2, cy - 2, 6.5, false, "center");
    textSimple(ctx, String(row.segs[2] ?? ""), x2 + 2, cy + 12, 6, false, "center");
  } else if (row.shape === "u-bottom") {
    line(ctx, x1, cy, x1, cy - 10, 0.9);
    line(ctx, x2, cy, x2, cy - 10, 0.9);
    textSimple(ctx, String(row.segs[0] ?? ""), x1 - 2, cy + 8, 6, false, "center");
    textSimple(ctx, String(row.segs[1] ?? ""), (x1 + x2) / 2, cy - 2, 6.5, false, "center");
    textSimple(ctx, String(row.segs[2] ?? ""), x2 + 2, cy + 8, 6, false, "center");
  } else if (row.shape === "l-left") {
    line(ctx, x1, cy, x1, cy - 10, 0.9);
    textSimple(ctx, String(row.segs[0] ?? ""), x1 - 2, cy + 8, 6, false, "center");
    textSimple(ctx, String(row.segs[1] ?? ""), (x1 + x2) / 2, cy - 2, 6.5, false, "center");
  } else if (row.shape === "l-right") {
    line(ctx, x2, cy, x2, cy - 10, 0.9);
    textSimple(ctx, String(row.segs[0] ?? ""), (x1 + x2) / 2, cy - 2, 6.5, false, "center");
    textSimple(ctx, String(row.segs[1] ?? ""), x2 + 2, cy + 8, 6, false, "center");
  } else {
    textSimple(ctx, String(row.segs[0] ?? ""), (x1 + x2) / 2, cy - 2, 6.5, false, "center");
  }
}

function drawTable(ctx: Ctx, x: number, y: number, _w: number) {
  const { project, model } = ctx;
  const rows = model.schedule;
  const headerH = 36;
  const rowH = 16.4;
  const h = headerH + rows.length * rowH + 22;
  const cols = [
    { key: "name", w: 48 },
    { key: "stt", w: 32 },
    { key: "shape", w: 210 },
    { key: "dia", w: 42 },
    { key: "len", w: 50 },
    { key: "q1", w: 32 },
    { key: "qt", w: 36 },
    { key: "tm", w: 52 },
    { key: "wt", w: 58 },
  ];
  const w = cols.reduce((s, c) => s + c.w, 0);
  textSimple(ctx, "BẢNG THỐNG KÊ CỐT THÉP", x + w / 2, y + 2, 11, true, "center");
  const tableY = y + 16;
  rect(ctx, x, tableY, w, h, 0.9);

  let cx = x;
  const colX: number[] = [];
  for (const c of cols) {
    colX.push(cx);
    cx += c.w;
  }
  const mid = (i: number) => colX[i] + cols[i].w / 2;

  // header lines
  line(ctx, x, tableY + 18, x + w, tableY + 18, 0.5);
  line(ctx, x, tableY + headerH, x + w, tableY + headerH, 0.7);
  for (let i = 1; i < cols.length; i++) {
    const xx = colX[i];
    line(ctx, xx, tableY, xx, tableY + h - 22, 0.5);
  }
  line(ctx, colX[5], tableY + 18, colX[7], tableY + 18, 0.4);
  line(ctx, colX[6], tableY + 18, colX[6], tableY + h - 22, 0.45);

  textSimple(ctx, "TÊN", mid(0), tableY + 8, 6.5, false, "center");
  textSimple(ctx, "CẤU", mid(0), tableY + 16, 6.5, false, "center");
  textSimple(ctx, "KIỆN", mid(0), tableY + 24, 6.5, false, "center");
  textSimple(ctx, "STT", mid(1), tableY + 12, 7, false, "center");
  textSimple(ctx, "HÌNH DẠNG, KÍCH THƯỚC", mid(2), tableY + 16, 7, false, "center");
  textSimple(ctx, "ĐƯỜNG", mid(3), tableY + 8, 6.2, false, "center");
  textSimple(ctx, "KÍNH", mid(3), tableY + 16, 6.2, false, "center");
  textSimple(ctx, "(mm)", mid(3), tableY + 28, 6, false, "center");
  textSimple(ctx, "CHIỀU DÀI", mid(4), tableY + 8, 6.2, false, "center");
  textSimple(ctx, "THANH", mid(4), tableY + 16, 6.2, false, "center");
  textSimple(ctx, "(mm)", mid(4), tableY + 28, 6, false, "center");
  textSimple(ctx, "SỐ LƯỢNG", (mid(5) + mid(6)) / 2, tableY + 8, 6.2, false, "center");
  textSimple(ctx, "1 CK", mid(5), tableY + 28, 6, false, "center");
  textSimple(ctx, "T. BỘ", mid(6), tableY + 28, 6, false, "center");
  textSimple(ctx, "TỔNG", mid(7), tableY + 8, 6.2, false, "center");
  textSimple(ctx, "CHIỀU DÀI", mid(7), tableY + 16, 6, false, "center");
  textSimple(ctx, "(m)", mid(7), tableY + 28, 6, false, "center");
  textSimple(ctx, "TRỌNG LƯỢNG", mid(8), tableY + 16, 6, false, "center");
  textSimple(ctx, "(kG)", mid(8), tableY + 28, 6, false, "center");

  rows.forEach((row, i) => {
    const ry = tableY + headerH + i * rowH;
    line(ctx, colX[1], ry + rowH, x + w, ry + rowH, 0.35);
    textSimple(ctx, row.mark, mid(1), ry + 12, 8, false, "center");
    drawShape(ctx, row, colX[2], ry, cols[2].w, rowH);
    textSimple(ctx, String(row.dia), mid(3), ry + 12, 8, false, "center");
    textSimple(ctx, String(row.barLength), mid(4), ry + 12, 8, false, "center");
    textSimple(ctx, String(row.qtyEach), mid(5), ry + 12, 8, false, "center");
    textSimple(ctx, String(row.qtyTotal), mid(6), ry + 12, 8, false, "center");
    textSimple(ctx, row.totalM.toFixed(1), mid(7), ry + 12, 8, false, "center");
    textSimple(ctx, row.weight.toFixed(1), mid(8), ry + 12, 8, false, "center");
  });

  const name = `(DẦM: ${project.info.name})`;
  const sl = `(SL: ${project.info.quantity})`;
  textSimple(ctx, name, mid(0), tableY + headerH + 40, 7, false, "center");
  textSimple(ctx, sl, mid(0), tableY + headerH + 52, 7, false, "center");

  const fy = tableY + headerH + rows.length * rowH;
  line(ctx, x, fy, x + w, fy, 0.7);
  const sum = model.byDia.map((d) => `Ø${d.dia}: ${d.weight.toFixed(1)}`).join("    ");
  textSimple(ctx, `Tổng hợp thép theo đường kính (kg):    ${sum}`, x + 8, fy + 14, 7.5);
}

function assignMarks(model: ComputedModel) {
  const mainBot = model.schedule.filter((r) => r.bars[0]?.kind === "main" && r.bars[0]?.face === "bottom");
  const extraBot = model.schedule.filter((r) => r.bars[0]?.kind === "extra" && r.bars[0]?.face === "bottom");
  const mainTop = model.schedule.filter((r) => r.bars[0]?.kind === "main" && r.bars[0]?.face === "top");
  const extraTop = model.schedule.filter((r) => r.bars[0]?.kind === "extra" && r.bars[0]?.face === "top");
  const stirrup = model.schedule.find((r) => r.shape === "stirrup");
  return { mainBot, extraBot, mainTop, extraTop, stirrup };
}

export async function generateBeamPdf(
  project: BeamProject,
  fonts: { regular: ArrayBuffer; bold: ArrayBuffer },
): Promise<Uint8Array> {
  const model = computeModel(project);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit as never);
  const font = await pdf.embedFont(fonts.regular, { subset: true });
  const fontBold = await pdf.embedFont(fonts.bold, { subset: true });
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  const originX = 150;
  const usable = 1380;
  const scale = model.total > 0 ? usable / model.total : 0.05;

  const ctx: Ctx = { page, font, fontBold, project, model, originX, scale };

  const marks = assignMarks(model);

  // --- TOP shop: main top bars (each bar as 5.1 5.2 5.3) ---
  let y = 48;
  const mt = model.mainTop[0];
  const mtMark = marks.mainTop[0]?.markNum ?? 5;
  if (mt) {
    for (let i = (mt.qty || 1) - 1; i >= 0; i--) {
      drawShopRow(ctx, { ...mt, qty: 1 }, `${mtMark}.${i + 1}`, y, 1);
      y += 58;
    }
  }

  // extra top bars
  y = 250;
  const extraTopGroups = marks.extraTop;
  for (const row of extraTopGroups) {
    for (const b of row.bars) {
      const x1 = xAt(ctx, b.x1);
      const x2 = xAt(ctx, b.x2);
      drawHookedBar(ctx, x1, x2, y, b.hookStart, b.hookEnd, 1, 1.05);
      dimH(ctx, x1, x2, y - 12, String(Math.round(b.straight)), 7);
      if (b.hookStart) dimV(ctx, x1 - 10, y, y + 12, String(Math.round(b.hookStart)), 6);
      if (b.hookEnd) dimV(ctx, x2 + 6, y, y + 12, String(Math.round(b.hookEnd)), 6);
      const mid = (x1 + x2) / 2;
      markCircle(ctx, mid - 62, y + 14, row.mark, 7);
      textSimple(ctx, `${row.mark} ${b.qty}Ø${b.dia}-L=${Math.round(b.cutLength)}`, mid - 52, y + 18, 8);
    }
  }

  // longitudinal section
  const secTop = 330;
  const beamDrawH = 72;
  drawLongitudinal(ctx, secTop, beamDrawH);

  // extra bottom shop
  y = 470;
  for (const row of marks.extraBot) {
    for (const b of row.bars) {
      const x1 = xAt(ctx, b.x1);
      const x2 = xAt(ctx, b.x2);
      const by = 545;
      drawHookedBar(ctx, x1, x2, by, b.hookStart, b.hookEnd, -1, 1.05);
      dimH(ctx, x1, x2, by - 14, String(Math.round(b.straight)), 7);
      const mid = (x1 + x2) / 2;
      markCircle(ctx, mid - 62, by + 16, row.mark, 7);
      textSimple(ctx, `${row.mark} ${b.qty}Ø${b.dia}-L=${Math.round(b.cutLength)}`, mid - 52, by + 20, 8);
    }
  }

  // main bottom shop
  const mb = model.mainBottom[0];
  const mbMark = marks.mainBot[0]?.markNum ?? 1;
  y = 610;
  if (mb) {
    for (let i = 0; i < (mb.qty || 1); i++) {
      drawShopRow(ctx, { ...mb, qty: 1 }, `${mbMark}.${i + 1}`, y, -1);
      y += 58;
    }
  }

  // title
  const title = `KẾT CẤU DẦM ${project.info.name}(SL: ${project.info.quantity})`;
  textSimple(ctx, title, PAGE_W / 2, 820, 16, true, "center");

  // cross sections
  const topCall = marks.mainTop[0]
    ? { mark: marks.mainTop[0].mark, text: barNotation(model.mainTop[0]?.qty ?? 0, model.mainTop[0]?.dia ?? 0) }
    : { mark: "5", text: "" };
  const botCall = marks.mainBot[0]
    ? { mark: marks.mainBot[0].mark, text: barNotation(model.mainBottom[0]?.qty ?? 0, model.mainBottom[0]?.dia ?? 0) }
    : { mark: "1", text: "" };
  const extraTopCall = extraTopGroups.slice(0, 3).map((r) => ({
    mark: r.mark,
    text: barNotation(r.bars[0]?.qty ?? 2, r.bars[0]?.dia ?? 20),
  }));
  const extraBotCall = marks.extraBot.slice(0, 3).map((r) => ({
    mark: r.mark,
    text: barNotation(r.bars[0]?.qty ?? 2, r.bars[0]?.dia ?? 20),
  }));
  const stMark = marks.stirrup?.mark ?? "9";
  const stDia = model.stirrups.dia;

  drawCrossSection(
    ctx,
    80,
    860,
    "MC 1-1",
    topCall,
    botCall,
    extraTopCall,
    { mark: stMark, text: `Ø${stDia}a150` },
  );
  drawCrossSection(
    ctx,
    280,
    860,
    "MC 2-2",
    topCall,
    botCall,
    extraBotCall,
    { mark: stMark, text: `Ø${stDia}a200` },
  );

  drawTable(ctx, 500, 848, 560);

  // frame
  ctx.page.drawRectangle({
    x: 18,
    y: 18,
    width: PAGE_W - 36,
    height: PAGE_H - 36,
    borderColor: BLACK,
    borderWidth: 1.1,
  });

  return pdf.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
