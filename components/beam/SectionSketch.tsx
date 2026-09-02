"use client";

import { useId } from "react";
import { Panel } from "@/components/ui/field";
import type { Span } from "@/lib/types";

const DIM = "#d8b4fe";
const DIM_FILL = "#e9d5ff";

function DimH({
  x1,
  x2,
  y,
  label,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
}) {
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  const span = b - a;
  const mid = (a + b) / 2;
  return (
    <g stroke={DIM} fill={DIM_FILL} strokeWidth={0.8}>
      {span > 3 && <line x1={a} y1={y} x2={b} y2={y} />}
      <line x1={a - 2.4} y1={y - 2.4} x2={a + 2.4} y2={y + 2.4} />
      {span > 3 && <line x1={b - 2.4} y1={y - 2.4} x2={b + 2.4} y2={y + 2.4} />}
      <text
        x={span > 14 ? mid : a - 4}
        y={y - 3}
        textAnchor={span > 14 ? "middle" : "end"}
        fontSize={8}
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

function DimV({
  x,
  y1,
  y2,
  label,
  align = "right",
}: {
  x: number;
  y1: number;
  y2: number;
  label: string;
  align?: "left" | "right";
}) {
  const a = Math.min(y1, y2);
  const b = Math.max(y1, y2);
  const h = b - a;
  if (h < 2.5) return null;
  return (
    <g stroke={DIM} fill={DIM_FILL} strokeWidth={0.8}>
      <line x1={x} y1={a} x2={x} y2={b} />
      <line x1={x - 2.4} y1={a - 2.4} x2={x + 2.4} y2={a + 2.4} />
      <line x1={x - 2.4} y1={b - 2.4} x2={x + 2.4} y2={b + 2.4} />
      <text
        x={align === "right" ? x + 5 : x - 5}
        y={h > 11 ? (a + b) / 2 + 3 : a - 2}
        textAnchor={align === "right" ? "start" : "end"}
        fontSize={8}
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

/** Zigzag break at the outer end of a continuing slab. */
function BreakMarks({ x, y, h, side }: { x: number; y: number; h: number; side: "left" | "right" }) {
  const cy = y + h / 2;
  const amp = Math.min(6.5, Math.max(4, h * 0.42));
  const s = side === "left" ? -1 : 1;
  return (
    <path
      d={`M ${x} ${y} L ${x} ${cy - amp}
         L ${x + s * amp} ${cy - amp * 0.28}
         L ${x - s * amp * 0.75} ${cy + amp * 0.28}
         L ${x} ${cy + amp}
         L ${x} ${y + h}`}
      fill="none"
      stroke="#e5e7eb"
      strokeWidth={1.15}
      strokeLinejoin="round"
    />
  );
}

/**
 * Typical beam+slab cross-section (shop-drawing “hình điển hình”).
 * HL / HR = drop from top of stem to top of slab.
 * HSL / HSR = slab thickness.
 * B = stem width; B1 = left face of stem → axis.
 */
export function SectionSketch({ span }: { span: Span }) {
  const uid = useId().replace(/:/g, "");
  const stemFill = `url(#stem-${uid})`;
  const slabFill = `url(#slab-${uid})`;

  const B = Math.max(span.B || 1, 1);
  const H = Math.max(span.H || 1, 1);
  const B1 = Number.isFinite(span.B1) ? Math.max(0, span.B1) : B / 2;
  const t = span.slabType ?? 0;
  const showL = t === 1 || t === 2;
  const showR = t === 1 || t === 3;

  const Hl = showL ? Math.max(span.Hl || 0, 0) : 0;
  const Hr = showR ? Math.max(span.Hr || 0, 0) : 0;
  const HslIn = showL ? Math.max(span.Hsl || 0, 0) : 0;
  const HsrIn = showR ? Math.max(span.Hsr || 0, 0) : 0;
  // Empty thickness still draws a typical slab so “sàn hai bên” matches the CAD sketch.
  const HslDraw = showL ? Math.max(HslIn, 80) : 0;
  const HsrDraw = showR ? Math.max(HsrIn, 80) : 0;

  const maxDown = Math.max(H, Hl + HslDraw, Hr + HsrDraw, 1);

  const vw = 268;
  const vh = 214;
  const padL = showL ? 54 : 22;
  const padR = showR ? 54 : 36;
  const padT = 16;
  const padB = 46;
  const slabLen = 44;
  const innerW = vw - padL - padR;
  const innerH = vh - padT - padB;
  const stemRoom = innerW - (showL ? slabLen : 0) - (showR ? slabLen : 0);
  const scale = Math.min(stemRoom / B, innerH / maxDown);

  const stemW = B * scale;
  const stemH = H * scale;
  const extraX = (stemRoom - stemW) / 2;
  const stemX = padL + (showL ? slabLen : 0) + extraX;
  const stemY = padT;
  const bot = stemY + stemH;
  const axisX = stemX + Math.min(B1, B) * scale;

  const leftTop = stemY + Hl * scale;
  const rightTop = stemY + Hr * scale;
  const leftHpx = showL ? Math.max(HslDraw * scale, 7) : 0;
  const rightHpx = showR ? Math.max(HsrDraw * scale, 7) : 0;
  const leftX = stemX - slabLen;
  const rightX = stemX + stemW;

  return (
    <Panel title="Tiết diện" className="w-[272px] shrink-0">
      <svg viewBox={`0 0 ${vw} ${vh}`} className="h-[196px] w-full">
        <defs>
          <linearGradient id={`stem-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="45%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          <linearGradient id={`slab-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        {showL && (
          <g>
            <rect
              x={leftX}
              y={leftTop}
              width={slabLen + 0.8}
              height={leftHpx}
              fill={slabFill}
              stroke="#e5e7eb"
              strokeWidth={0.8}
            />
            <BreakMarks x={leftX} y={leftTop} h={leftHpx} side="left" />
            <DimV x={leftX - 12} y1={stemY} y2={leftTop} label="HL" align="left" />
            <DimV x={leftX - 12} y1={leftTop} y2={leftTop + leftHpx} label="HSL" align="left" />
            <text x={leftX - 14} y={Math.max(leftTop - 5, 11)} textAnchor="end" fill="#a1a1aa" fontSize={7}>
              {Math.round(Hl)}/{Math.round(HslIn)}
            </text>
          </g>
        )}

        {showR && (
          <g>
            <rect
              x={rightX - 0.8}
              y={rightTop}
              width={slabLen + 0.8}
              height={rightHpx}
              fill={slabFill}
              stroke="#e5e7eb"
              strokeWidth={0.8}
            />
            <BreakMarks x={rightX + slabLen} y={rightTop} h={rightHpx} side="right" />
            <DimV x={rightX + slabLen + 12} y1={stemY} y2={rightTop} label="HR" align="right" />
            <DimV x={rightX + slabLen + 12} y1={rightTop} y2={rightTop + rightHpx} label="HSR" align="right" />
            <text x={rightX + slabLen + 14} y={Math.max(rightTop - 5, 11)} fill="#a1a1aa" fontSize={7}>
              {Math.round(Hr)}/{Math.round(HsrIn)}
            </text>
          </g>
        )}

        <rect x={stemX} y={stemY} width={stemW} height={stemH} fill={stemFill} stroke="#e5e7eb" strokeWidth={0.9} />
        <line
          x1={axisX}
          y1={stemY - 8}
          x2={axisX}
          y2={bot + 5}
          stroke="#f87171"
          strokeDasharray="3.2 2.2"
          strokeWidth={1.15}
        />

        {!showR && <DimV x={stemX + stemW + 11} y1={stemY} y2={bot} label={`H=${Math.round(H)}`} align="right" />}
        {showR && (
          <text x={stemX + stemW + 3} y={bot + 11} fill="#e9d5ff" fontSize={8}>
            H={Math.round(H)}
          </text>
        )}
        <DimH x1={stemX} x2={axisX} y={bot + 18} label={`B1=${Math.round(B1)}`} />
        <DimH x1={stemX} x2={stemX + stemW} y={bot + 34} label={`B=${Math.round(B)}`} />
      </svg>
    </Panel>
  );
}
