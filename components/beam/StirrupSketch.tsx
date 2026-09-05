"use client";

import {
  EXTRA_LAYER_SPACING_MM,
  barPositions,
  extraBarXsInSection,
  extraLayerOffsetMm,
} from "@/lib/calc";
import type { ExtraBar, StirrupKind } from "@/lib/types";

/** Minh họa mặt cắt đai + thép tăng cường (lớp 1 giữa chủ, 2/3 cách 25 mm). */
export function StirrupSketch({
  kind = "don",
  extraC = false,
  extraNested = false,
  extraDouble = false,
  antiBuckling = false,
  B = 200,
  H = 500,
  cover = 25,
  mainTopQty = 2,
  mainBottomQty = 2,
  extraTop = [],
  extraBottom = [],
}: {
  kind?: StirrupKind;
  extraC?: boolean;
  extraNested?: boolean;
  extraDouble?: boolean;
  antiBuckling?: boolean;
  B?: number;
  H?: number;
  cover?: number;
  mainTopQty?: number;
  mainBottomQty?: number;
  extraTop?: ExtraBar[];
  extraBottom?: ExtraBar[];
}) {
  const twin = kind === "kep";
  const topN = Math.max(0, Math.min(8, Math.round(mainTopQty) || 0));
  const botN = Math.max(0, Math.min(8, Math.round(mainBottomQty) || 0));
  const box = { x: 52, y: 16, w: 148, h: 196 };
  const inset = 16;
  const sx = box.x + inset;
  const sy = box.y + inset;
  const sw = box.w - inset * 2;
  const sh = box.h - inset * 2;
  const barR = 5.4;
  const innerHmm = Math.max(H - 2 * cover, 1);
  const mmToPx = sh / innerHmm;
  const topY = sy;
  const botY = sy + sh;
  /** Phóng nhẹ khoảng lớp 2/3 trên minh họa — thông số thật vẫn 25 mm. */
  const layerY = (from: number, layer: number, dir: 1 | -1) =>
    from + dir * sketchLayerOffsetPx(layer, mmToPx, barR);
  const topXs = topN ? barPositions(sx, sx + sw, topN) : [];
  const botXs = botN ? barPositions(sx, sx + sw, botN) : [];

  const byLayer = (bars: ExtraBar[]) => {
    const map = new Map<number, ExtraBar>();
    for (const b of bars) {
      const layer = Math.max(1, Math.round(b.layer || 1));
      const prev = map.get(layer);
      if (!prev || b.qty > prev.qty) map.set(layer, { ...b, layer });
    }
    return [...map.entries()].sort((a, c) => a[0] - c[0]);
  };

  return (
    <svg
      viewBox="0 0 230 286"
      className="h-[236px] w-[188px] shrink-0 rounded border border-zinc-700 bg-[#111]"
      role="img"
      aria-label="Mặt cắt đai và thép tăng cường"
    >
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke="#f5f5f5" strokeWidth={2.4} />
      <path
        d={hookedRect(sx, sy, sw, sh)}
        fill="none"
        stroke="#b0db34"
        strokeWidth={twin ? 5 : 5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {twin ? (
        <path
          d={hookedRect(sx + 7, sy + 7, sw - 14, sh - 14)}
          fill="none"
          stroke="#b0db34"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {extraNested && !extraDouble ? (
        <path
          d={hookedRect(sx + sw * 0.28, sy + 4, sw * 0.44, sh - 8)}
          fill="none"
          stroke="#4dabf7"
          strokeWidth={4.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {extraDouble ? (
        <>
          <path
            d={hookedRect(sx + 2, sy + 4, sw * 0.42, sh - 8)}
            fill="none"
            stroke="#ff6b6b"
            strokeWidth={3.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={hookedRect(sx + sw * 0.56, sy + 4, sw * 0.42, sh - 8)}
            fill="none"
            stroke="#4dabf7"
            strokeWidth={3.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
      {antiBuckling ? (
        <g>
          <CTieH x1={sx} x2={sx + sw} y={sy + sh / 2} />
          <circle cx={sx} cy={sy + sh / 2} r={barR} fill="#e879f9" />
          <circle cx={sx + sw} cy={sy + sh / 2} r={barR} fill="#e879f9" />
          <text x={sx + sw + 6} y={sy + sh / 2 + 3} fill="#f0abfc" fontSize={8}>
            CP
          </text>
        </g>
      ) : extraC ? (
        <CTie x={sx + sw / 2} y1={sy} y2={sy + sh} />
      ) : null}

      {[1, 2, 3].map((layer) => {
        const yT = layerY(topY, layer, 1);
        const yB = layerY(botY, layer, -1);
        return (
          <g key={`guide-${layer}`} opacity={0.35}>
            <line x1={sx} y1={yT} x2={sx + sw} y2={yT} stroke="#38bdf8" strokeDasharray="3 3" strokeWidth={0.7} />
            <line x1={sx} y1={yB} x2={sx + sw} y2={yB} stroke="#fb923c" strokeDasharray="3 3" strokeWidth={0.7} />
          </g>
        );
      })}

      {byLayer(extraTop).map(([layer, bar]) => {
        const y = layerY(topY, layer, 1);
        const xs = extraBarXsInSection(sx, sx + sw, bar.qty, layer, topXs.length ? topXs : [sx, sx + sw]);
        return (
          <g key={`t-${layer}`}>
            {xs.length > 1 ? (
              <line
                x1={xs[0]}
                y1={y}
                x2={xs[xs.length - 1]}
                y2={y}
                stroke="#38bdf8"
                strokeWidth={0.8}
                opacity={0.7}
              />
            ) : null}
            {xs.map((x) => (
              <circle key={x} cx={x} cy={y} r={barR - 0.6} fill="#38bdf8" />
            ))}
            <text x={sx + sw + 6} y={y + 3} fill="#7dd3fc" fontSize={8}>
              {`T L${layer}`}
            </text>
          </g>
        );
      })}
      {byLayer(extraBottom).map(([layer, bar]) => {
        const y = layerY(botY, layer, -1);
        const xs = extraBarXsInSection(sx, sx + sw, bar.qty, layer, botXs.length ? botXs : [sx, sx + sw]);
        return (
          <g key={`b-${layer}`}>
            {xs.length > 1 ? (
              <line
                x1={xs[0]}
                y1={y}
                x2={xs[xs.length - 1]}
                y2={y}
                stroke="#fb923c"
                strokeWidth={0.8}
                opacity={0.7}
              />
            ) : null}
            {xs.map((x) => (
              <circle key={x} cx={x} cy={y} r={barR - 0.6} fill="#fb923c" />
            ))}
            <text x={sx + sw + 6} y={y + 3} fill="#fdba74" fontSize={8}>
              {`B L${layer}`}
            </text>
          </g>
        );
      })}

      {topXs.map((x) => (
        <circle key={`mt-${x}`} cx={x} cy={topY} r={barR} fill="#ff2f2f" />
      ))}
      {botXs.map((x) => (
        <circle key={`mb-${x}`} cx={x} cy={botY} r={barR} fill="#ff2f2f" />
      ))}
      <DimLabels x={box.x} y={box.y} w={box.w} h={box.h} B={B} H={H} />
      <text x={115} y={276} textAnchor="middle" fill="#a1a1aa" fontSize={7.4}>
        {extraTop.length + extraBottom.length
          ? "L1 giữa chủ · L2 +25 · L3 +50 · đỏ: chủ"
          : "Chưa có thép tăng cường trên nhịp này"}
      </text>
    </svg>
  );
}

/** Lớp 2/3 cách chủ đủ để không đè chấm đỏ; lớp 1 vẫn cùng mặt phẳng chủ. */
function sketchLayerOffsetPx(layer: number, mmToPx: number, barR: number) {
  const mm = extraLayerOffsetMm(layer);
  if (mm <= 0) return 0;
  const steps = mm / EXTRA_LAYER_SPACING_MM;
  const drawn = mm * mmToPx;
  const clear = steps * (barR * 2 + 8);
  return Math.max(drawn, clear);
}

function hookedRect(x: number, y: number, w: number, h: number) {
  const i = Math.max(8, Math.min(w, h) * 0.12);
  const a = Math.max(16, Math.min(w, h) * 0.14);
  const o = a * 0.7071;
  const s = Math.max(5, a * 0.28);
  const c = i * 0.5522847498;
  const X = (v: number) => +(x + v).toFixed(2);
  const Y = (v: number) => +(y + h - v).toFixed(2);
  return [
    `M ${X(s + o)} ${Y(h - o)}`,
    `L ${X(s)} ${Y(h)}`,
    `L ${X(w - i)} ${Y(h)}`,
    `C ${X(w - i + c)} ${Y(h)} ${X(w)} ${Y(h - i + c)} ${X(w)} ${Y(h - i)}`,
    `L ${X(w)} ${Y(i)}`,
    `C ${X(w)} ${Y(i - c)} ${X(w - i + c)} ${Y(0)} ${X(w - i)} ${Y(0)}`,
    `L ${X(i)} ${Y(0)}`,
    `C ${X(i - c)} ${Y(0)} ${X(0)} ${Y(i - c)} ${X(0)} ${Y(i)}`,
    `L ${X(0)} ${Y(h - s)}`,
    `L ${X(o)} ${Y(h - s - o)}`,
  ].join(" ");
}

function CTie({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  const hook = 14;
  const bump = 8;
  return (
    <path
      d={`M ${x + hook} ${y1 + bump} L ${x + hook} ${y1} L ${x} ${y1} L ${x} ${y2} L ${x + hook} ${y2} L ${x + hook} ${y2 - bump}`}
      fill="none"
      stroke="#ffa94d"
      strokeWidth={4.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Đai C ngang — móc 2 cây chống phình tại giữa H. */
function CTieH({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  const hook = 14;
  const bump = 8;
  return (
    <path
      d={`M ${x1 + bump} ${y - hook} L ${x1} ${y - hook} L ${x1} ${y} L ${x2} ${y} L ${x2} ${y - hook} L ${x2 - bump} ${y - hook}`}
      fill="none"
      stroke="#ffa94d"
      strokeWidth={4.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function DimLabels({
  x,
  y,
  w,
  h,
  B,
  H,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  B: number;
  H: number;
}) {
  const bot = y + h + 16;
  const left = x - 16;
  return (
    <g stroke="#fff12d" fill="#fff12d" strokeWidth={1.4}>
      <line x1={x} y1={y + h} x2={x} y2={bot} />
      <line x1={x + w} y1={y + h} x2={x + w} y2={bot} />
      <line x1={x} y1={bot} x2={x + w} y2={bot} />
      <line x1={x} y1={bot - 5} x2={x} y2={bot + 5} />
      <line x1={x + w} y1={bot - 5} x2={x + w} y2={bot + 5} />
      <text x={x + w / 2} y={bot + 16} textAnchor="middle" stroke="none" fontSize={12} fontWeight={700}>
        {`B (mm) ${Math.round(B)}`}
      </text>
      <line x1={x} y1={y} x2={left} y2={y} />
      <line x1={x} y1={y + h} x2={left} y2={y + h} />
      <line x1={left} y1={y} x2={left} y2={y + h} />
      <line x1={left - 5} y1={y} x2={left + 5} y2={y} />
      <line x1={left - 5} y1={y + h} x2={left + 5} y2={y + h} />
      <text
        x={left - 10}
        y={y + h / 2}
        textAnchor="middle"
        stroke="none"
        fontSize={12}
        fontWeight={700}
        transform={`rotate(-90 ${left - 10} ${y + h / 2})`}
      >
        {`H (mm) ${Math.round(H)}`}
      </text>
    </g>
  );
}
