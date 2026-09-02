"use client";

import { Panel } from "@/components/ui/field";
import type { Span } from "@/lib/types";

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
  const mid = (a + b) / 2;
  const span = b - a;
  return (
    <g stroke="#d8b4fe" fill="#e9d5ff" strokeWidth={0.8}>
      {span > 4 && <line x1={a} y1={y} x2={b} y2={y} />}
      <line x1={a - 2.5} y1={y - 2.5} x2={a + 2.5} y2={y + 2.5} />
      {span > 4 && <line x1={b - 2.5} y1={y - 2.5} x2={b + 2.5} y2={y + 2.5} />}
      <text x={span > 10 ? mid : a - 4} y={y - 3} textAnchor={span > 10 ? "middle" : "end"} fontSize={8} stroke="none">
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
}: {
  x: number;
  y1: number;
  y2: number;
  label: string;
}) {
  const a = Math.min(y1, y2);
  const b = Math.max(y1, y2);
  return (
    <g stroke="#d8b4fe" fill="#e9d5ff" strokeWidth={0.8}>
      <line x1={x} y1={a} x2={x} y2={b} />
      <line x1={x - 2.5} y1={a - 2.5} x2={x + 2.5} y2={a + 2.5} />
      <line x1={x - 2.5} y1={b - 2.5} x2={x + 2.5} y2={b + 2.5} />
      <text x={x + 5} y={(a + b) / 2 + 3} fontSize={8} stroke="none">
        {label}
      </text>
    </g>
  );
}

export function SectionSketch({ span }: { span: Span }) {
  const B = Math.max(span.B || 1, 1);
  const H = Math.max(span.H || 1, 1);
  const B1 = Number.isFinite(span.B1) ? Math.max(0, span.B1) : B / 2;
  const t = span.slabType ?? 0;
  const leftOver = t === 1 || t === 2 ? Math.max(span.Hl || 0, 0) : 0;
  const rightOver = t === 1 || t === 3 ? Math.max(span.Hr || 0, 0) : 0;
  const leftTh = leftOver > 0 ? Math.max(span.Hsl || 80, 20) : 0;
  const rightTh = rightOver > 0 ? Math.max(span.Hsr || 80, 20) : 0;

  const totalW = leftOver + B + rightOver;
  const innerW = 108;
  const innerH = 100;
  const scale = Math.min(innerW / totalW, innerH / H);
  const ox = 18 + (innerW - totalW * scale) / 2;
  const oy = 14;
  const stemX = ox + leftOver * scale;
  const stemY = oy;
  const stemW = B * scale;
  const stemH = H * scale;
  const axisX = stemX + Math.min(B1, B) * scale;
  const leftX = ox;
  const rightX = stemX + stemW;
  const slabTop = oy;
  const bot = stemY + stemH;

  return (
    <Panel title="Tiết diện" className="w-52 shrink-0">
      <svg viewBox="0 0 168 188" className="h-[168px] w-full">
        <defs>
          <linearGradient id={`secFill-${span.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        {leftOver > 0 && (
          <rect
            x={leftX}
            y={slabTop}
            width={leftOver * scale + stemW * 0.02}
            height={leftTh * scale}
            fill={`url(#secFill-${span.id})`}
            stroke="#e5e7eb"
            strokeWidth={0.8}
          />
        )}
        {rightOver > 0 && (
          <rect
            x={rightX - stemW * 0.02}
            y={slabTop}
            width={rightOver * scale + stemW * 0.02}
            height={rightTh * scale}
            fill={`url(#secFill-${span.id})`}
            stroke="#e5e7eb"
            strokeWidth={0.8}
          />
        )}
        <rect
          x={stemX}
          y={stemY}
          width={stemW}
          height={stemH}
          fill={`url(#secFill-${span.id})`}
          stroke="#e5e7eb"
          strokeWidth={0.9}
        />
        <line
          x1={axisX}
          y1={oy - 8}
          x2={axisX}
          y2={bot + 6}
          stroke="#f87171"
          strokeDasharray="3 2"
          strokeWidth={1.1}
        />
        <DimV x={Math.max(rightX, ox + totalW * scale) + 10} y1={oy} y2={bot} label={`H=${Math.round(H)}`} />
        <DimH x1={stemX} x2={stemX + stemW} y={bot + 28} label={`B=${Math.round(B)}`} />
        <DimH x1={stemX} x2={axisX} y={bot + 14} label={`B1=${Math.round(B1)}`} />
      </svg>
    </Panel>
  );
}
