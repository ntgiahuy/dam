"use client";

import type { StirrupKind } from "@/lib/types";

/** Minh họa mặt cắt đai — cùng phong cách shop thép cột (đổi Cy→H, Cx→B). */
export function StirrupSketch({
  kind = "don",
  extraC = false,
  extraNested = false,
  extraDouble = false,
  B = 200,
  H = 500,
  bars = 2,
}: {
  kind?: StirrupKind;
  extraC?: boolean;
  extraNested?: boolean;
  extraDouble?: boolean;
  B?: number;
  H?: number;
  bars?: number;
}) {
  const twin = kind === "kep";
  const n = Math.max(2, Math.min(6, Math.round(bars) || 2));
  const box = { x: 52, y: 16, w: 148, h: 196 };
  const inset = 16;
  const sx = box.x + inset;
  const sy = box.y + inset;
  const sw = box.w - inset * 2;
  const sh = box.h - inset * 2;
  const barR = 6.2;
  const xs = Array.from({ length: n }, (_, i) =>
    n === 1 ? sx + sw / 2 : sx + (sw * i) / (n - 1),
  );
  const topY = sy;
  const botY = sy + sh;

  return (
    <svg
      viewBox="0 0 230 270"
      className="h-[220px] w-[188px] shrink-0 rounded border border-zinc-700 bg-[#111]"
      role="img"
      aria-label="Mặt cắt đai dầm"
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
      {extraC ? <CTie x={sx + sw / 2} y1={sy} y2={sy + sh} /> : null}
      {xs.map((x) => (
        <g key={x}>
          <circle cx={x} cy={topY} r={barR} fill="#ff2f2f" />
          <circle cx={x} cy={botY} r={barR} fill="#ff2f2f" />
        </g>
      ))}
      <DimLabels x={box.x} y={box.y} w={box.w} h={box.h} B={B} H={H} />
    </svg>
  );
}

/** Đường đai móc 135° — cùng shop thép cột. */
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
      <text
        x={x + w / 2}
        y={bot + 16}
        textAnchor="middle"
        stroke="none"
        fontSize={12}
        fontWeight={700}
      >
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
