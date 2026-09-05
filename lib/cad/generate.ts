import {
  barNotation,
  computeModel,
  extraLayerOffsetMm,
  supportFaces,
  type ComputedModel,
  type ScheduleRow,
} from "../calc";
import { extraTieElevationNote } from "../extra-ties";
import { defaultSupportAxisName } from "../sample";
import type { BeamProject } from "../types";
import { buildShopCuts, type CutLoc } from "../pdf/generate";
import { DxfDoc } from "./dxf";

const ELEV_SCALE = 1 / 50;
const SECT_SCALE = 0.2;
const BEAM_H = 18;
const ORIGIN_X = 55;

function xAt(originX: number, mm: number) {
  return originX + mm * ELEV_SCALE;
}

function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function uniqueCuts(cuts: CutLoc[]) {
  const out: CutLoc[] = [];
  const seen = new Set<number>();
  for (const c of cuts) {
    if (seen.has(c.n)) continue;
    seen.add(c.n);
    out.push(c);
  }
  return out.sort((a, b) => a.n - b.n);
}

function dimH(d: DxfDoc, x1: number, x2: number, y: number, label: string) {
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  if (b - a < 1) return;
  d.line(a, y - 1.2, a, y + 1.2, "DIM");
  d.line(b, y - 1.2, b, y + 1.2, "DIM");
  d.line(a, y, b, y, "DIM");
  d.text((a + b) / 2, y - 3.4, 2.2, label, "center", "DIM");
}

function markCircle(d: DxfDoc, x: number, y: number, mark: string, r = 2.4) {
  d.circle(x, y, r, "TEXT");
  d.text(x, y - 0.8, Math.min(2.4, r * 0.9), mark, "center", "TEXT");
}

function hookedBar(d: DxfDoc, x1: number, x2: number, y: number, hookStart: number, hookEnd: number, dir: 1 | -1) {
  d.line(x1, y, x2, y, "SHOP");
  const hs = hookStart > 0 ? Math.max(3.2, hookStart * ELEV_SCALE * 0.28) : 0;
  const he = hookEnd > 0 ? Math.max(3.2, hookEnd * ELEV_SCALE * 0.28) : 0;
  if (hs) d.line(x1, y, x1, y + dir * hs, "SHOP");
  if (he) d.line(x2, y, x2, y + dir * he, "SHOP");
}

function barXs(left: number, right: number, n: number) {
  const count = Math.max(1, n);
  if (count === 1) return [(left + right) / 2];
  return Array.from({ length: count }, (_, i) => left + ((right - left) * i) / (count - 1));
}

function drawElevation(d: DxfDoc, project: BeamProject, model: ComputedModel, cuts: CutLoc[], yTop: number) {
  const first = supportFaces(project, 0);
  const lastF = supportFaces(project, project.spans.length);
  const x0 = xAt(ORIGIN_X, first.left);
  const x1 = xAt(ORIGIN_X, lastF.right);
  const y0 = yTop;
  const y1 = yTop + BEAM_H;
  d.rect(x0, y0, x1 - x0, BEAM_H, "SHOP");

  project.supports.forEach((sup, i) => {
    const f = supportFaces(project, i);
    const left = xAt(ORIGIN_X, f.left);
    const right = xAt(ORIGIN_X, f.right);
    const ax = xAt(ORIGIN_X, f.axis);
    d.rect(left, y0 - 6, Math.max(right - left, 1), 6, "SHOP");
    d.rect(left, y1, Math.max(right - left, 1), 6, "SHOP");
    d.dashV(ax, y0 - 18, y1 + 20);
    d.circle(ax, y1 + 24, 3.2, "AXIS");
    d.text(ax, y1 + 23, 2.6, sup.axisName || defaultSupportAxisName(i), "center", "AXIS");
  });

  project.spans.forEach((sp, i) => {
    const a = xAt(ORIGIN_X, model.xs[i]);
    const b = xAt(ORIGIN_X, model.xs[i + 1]);
    dimH(d, a, b, y1 + 16, String(sp.L));
    const note = extraTieElevationNote(project, i);
    if (note) d.text((a + b) / 2, y0 - 16, 2, note, "center", "TEXT");
  });

  const cover = Math.max(2.2, (project.info.cover || 25) * (BEAM_H / Math.max(model.H, 1)));
  const topY = y0 + cover;
  const botY = y1 - cover;
  for (const b of model.mainTop) hookedBar(d, xAt(ORIGIN_X, b.x1), xAt(ORIGIN_X, b.x2), topY, b.hookStart, b.hookEnd, 1);
  for (const b of model.mainBottom) hookedBar(d, xAt(ORIGIN_X, b.x1), xAt(ORIGIN_X, b.x2), botY, b.hookStart, b.hookEnd, -1);
  for (const b of model.extraTop) {
    hookedBar(d, xAt(ORIGIN_X, b.x1), xAt(ORIGIN_X, b.x2), topY + extraLayerOffsetMm(b.layer) * 0.12, b.hookStart, b.hookEnd, 1);
  }
  for (const b of model.extraBottom) {
    hookedBar(d, xAt(ORIGIN_X, b.x1), xAt(ORIGIN_X, b.x2), botY - extraLayerOffsetMm(b.layer) * 0.12, b.hookStart, b.hookEnd, -1);
  }

  d.text(x0 - 18, (y0 + y1) / 2 - 1, 2.4, String(model.H), "center", "DIM");

  for (const c of cuts) {
    if (c.kind !== "span") continue;
    const x = xAt(ORIGIN_X, c.x) - 8;
    d.line(x, y0 - 16, x, y1 + 8, "AXIS");
    d.text(x, y0 - 20, 2.4, String(c.n), "center", "AXIS");
    d.text(x, y1 + 9, 2.4, String(c.n), "center", "AXIS");
  }

  return y1 + 32;
}

function drawSection(d: DxfDoc, ox: number, oy: number, model: ComputedModel, project: BeamProject, cut: CutLoc) {
  const W = Math.max(model.B * SECT_SCALE, 12);
  const H = Math.max(model.H * SECT_SCALE, 20);
  const cx = ox + 22;
  const boxY = oy + 4;
  const cover = project.info.cover || 25;
  const inset = Math.max(1.6, cover * SECT_SCALE);
  d.rect(cx, boxY, W, H, "SHOP");
  const topN = Math.min(Math.max(model.mainTop[0]?.qty || 0, 0), 8);
  const botN = Math.min(Math.max(model.mainBottom[0]?.qty || 0, 0), 8);
  const innerL = cx + inset + 1;
  const innerR = cx + W - inset - 1;
  const topY = boxY + inset + 1.2;
  const botY = boxY + H - inset - 1.2;
  for (const x of barXs(innerL, innerR, topN)) d.circle(x, topY, 0.9, "SHOP");
  for (const x of barXs(innerL, innerR, botN)) d.circle(x, botY, 0.9, "SHOP");
  d.text(cx + W / 2, boxY + H + 10, 2.8, `${cut.n}-${cut.n}`, "center", "TITLE");
  d.text(cx + W / 2, boxY + H + 14, 2.1, "TL: 1/25", "center", "TEXT");
  const mt = model.mainTop[0];
  const mb = model.mainBottom[0];
  if (mt) d.text(cx + W + 4, topY - 0.6, 2, `${barNotation(mt.qty, mt.dia)}`, "left", "TEXT");
  if (mb) d.text(cx + W + 4, botY - 0.6, 2, `${barNotation(mb.qty, mb.dia)}`, "left", "TEXT");
  d.text(cx - 3, (topY + botY) / 2, 2, `Ø${model.stirrups.dia} a${cut.spacing}`, "right", "TEXT");
  return H + 22;
}

function drawSchedule(d: DxfDoc, x: number, y: number, project: BeamProject, rows: ScheduleRow[]) {
  const cols = [14, 12, 58, 10, 18, 10, 12, 14, 18, 18];
  const w = cols.reduce((s, c) => s + c, 0);
  const headerH = 12;
  const rowH = 5.6;
  d.text(x + w / 2, y, 3.4, "BẢNG THỐNG KÊ CỐT THÉP", "center", "TITLE");
  const ty0 = y + 6;
  const h = headerH + rows.length * rowH;
  d.rect(x, ty0, w, h, "TABLE");
  const colX: number[] = [];
  let cx = x;
  for (const c of cols) {
    colX.push(cx);
    cx += c;
  }
  const mid = (i: number) => colX[i] + cols[i] / 2;
  for (let i = 1; i < cols.length; i++) {
    if (i === 7) d.line(colX[i], ty0 + headerH, colX[i], ty0 + h, "TABLE");
    else d.line(colX[i], ty0, colX[i], ty0 + h, "TABLE");
  }
  d.line(x, ty0 + headerH, x + w, ty0 + headerH, "TABLE");
  d.line(colX[6], ty0 + 6, colX[8], ty0 + 6, "TABLE");
  const heads: [number, string][] = [
    [0, "TÊN"],
    [1, "SỐ HIỆU"],
    [2, "HÌNH DẠNG"],
    [3, "Ø"],
    [4, "DÀI 1T"],
    [5, "C.KIỆN"],
    [8, "TỔNG DÀI"],
    [9, "TỔNG KG"],
  ];
  for (const [i, t] of heads) d.text(mid(i), ty0 + 4.2, 1.8, t, "center", "TEXT");
  d.text((colX[6] + colX[8]) / 2, ty0 + 2.2, 1.8, "SỐ THANH", "center", "TEXT");
  d.text(mid(6), ty0 + 8.6, 1.6, "MỘT CK", "center", "TEXT");
  d.text(mid(7), ty0 + 8.6, 1.6, "TOÀN BỘ", "center", "TEXT");

  rows.forEach((row, i) => {
    const ry = ty0 + headerH + i * rowH;
    d.line(colX[1], ry + rowH, x + w, ry + rowH, "TABLE");
    d.text(mid(1), ry + 3.6, 1.9, row.mark, "center", "TEXT");
    d.text(mid(2), ry + 3.6, 1.7, row.segs.map((s) => Math.round(s)).join(" · ") || "—", "center", "TEXT");
    d.text(mid(3), ry + 3.6, 1.9, String(row.dia), "center", "TEXT");
    d.text(mid(4), ry + 3.6, 1.9, String(row.barLength), "center", "TEXT");
    d.text(mid(5), ry + 3.6, 1.9, String(row.qtyMembers), "center", "TEXT");
    d.text(mid(6), ry + 3.6, 1.9, String(row.qtyEach), "center", "TEXT");
    d.text(mid(7), ry + 3.6, 1.9, String(row.qtyTotal), "center", "TEXT");
    d.text(mid(8), ry + 3.6, 1.8, fmt(row.totalM), "center", "TEXT");
    d.text(mid(9), ry + 3.6, 1.8, fmt(row.weight), "center", "TEXT");
  });
  d.text(mid(0), ty0 + headerH + (rows.length * rowH) / 2, 2.4, project.info.name || "DẦM", "center", "TITLE");
  return { w, h: h + 8 };
}

function drawSummary(d: DxfDoc, x: number, y: number, model: ComputedModel) {
  const dias = model.byDia;
  const colW = 28;
  const labW = 48;
  const w = labW + Math.max(dias.length, 1) * colW;
  d.text(x + w / 2, y, 3.4, "TỔNG HỢP CỐT THÉP", "center", "TITLE");
  const ty0 = y + 6;
  const rowH = 7;
  d.rect(x, ty0, w, 4 * rowH, "TABLE");
  d.line(x + labW, ty0, x + labW, ty0 + 4 * rowH, "TABLE");
  const labels = ["Ø (mm)", "Dài (m)", "kg", "Thanh 11.7m"];
  labels.forEach((lb, i) => {
    if (i) d.line(x, ty0 + i * rowH, x + w, ty0 + i * rowH, "TABLE");
    d.text(x + 2, ty0 + i * rowH + 4.6, 2, lb, "left", "TEXT");
  });
  dias.forEach((dia, i) => {
    const cx = x + labW + i * colW + colW / 2;
    d.line(x + labW + i * colW, ty0, x + labW + i * colW, ty0 + 4 * rowH, "TABLE");
    d.text(cx, ty0 + 4.6, 2.1, `Ø${dia.dia}`, "center", "TEXT");
    d.text(cx, ty0 + rowH + 4.6, 2, fmt(dia.lengthM), "center", "TEXT");
    d.text(cx, ty0 + 2 * rowH + 4.6, 2, fmt(dia.weight), "center", "TEXT");
    d.text(cx, ty0 + 3 * rowH + 4.6, 2, dia.dia <= 10 ? "—" : String(Math.ceil(dia.lengthM / 11.7)), "center", "TEXT");
  });
}

export function generateBeamDxf(project: BeamProject): string {
  const model = computeModel(project);
  const cuts = buildShopCuts(project, model);
  const d = new DxfDoc();
  let y = 12;
  y = drawElevation(d, project, model, cuts, y);
  const title = `${project.info.name} (SL=${project.info.quantity}; L=${Math.round(model.total)})`;
  const first = supportFaces(project, 0);
  const lastF = supportFaces(project, project.spans.length);
  const midX = (xAt(ORIGIN_X, first.left) + xAt(ORIGIN_X, lastF.right)) / 2;
  d.text(midX, y, 4.2, title, "center", "TITLE");
  d.text(midX, y + 6, 2.6, "TL: 1/50  ·  file CAD (DXF) — không bị cắt khổ giấy", "center", "TEXT");
  y += 16;

  const uniques = uniqueCuts(cuts);
  const boxW = Math.max(model.B * SECT_SCALE, 12);
  const pitch = Math.max(boxW + 48, 72);
  let sectH = 0;
  uniques.forEach((c, i) => {
    const h = drawSection(d, 16 + i * pitch, y, model, project, c);
    sectH = Math.max(sectH, h);
  });
  y += sectH + 10;

  const table = drawSchedule(d, 16, y, project, model.schedule);
  drawSummary(d, 16 + table.w + 12, y, model);
  return d.toString();
}
