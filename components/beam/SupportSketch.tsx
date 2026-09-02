"use client";

import { supportGeometry } from "@/lib/calc";

export function SupportSketch({ B, B1 }: { B: number; B1: number }) {
  const { width, leftToAxis } = supportGeometry(B, B1);
  const axis = 70;
  const scale = 80 / Math.max(width, 40);
  const colW = width * scale;
  const left = axis - leftToAxis * scale;
  const beamY = 48;
  const colTop = 18;
  const colBot = 108;
  const b1Span = Math.abs(axis - left);

  return (
    <svg viewBox="0 0 160 130" className="h-[140px] w-[180px] shrink-0 rounded border border-zinc-700 bg-zinc-950">
      <rect x={left} y={colTop} width={colW} height={colBot - colTop} fill="#fbbf24" opacity={0.85} stroke="#e5e7eb" />
      <rect x={8} y={beamY} width={144} height={22} fill="#2563eb" opacity={0.9} stroke="#e5e7eb" />
      <line x1={axis} y1={10} x2={axis} y2={120} stroke="#a3e635" strokeDasharray="3 2" strokeWidth={1} />
      <line x1={left} y1={116} x2={left + colW} y2={116} stroke="#e5e7eb" strokeWidth={0.8} />
      <text x={left + colW / 2} y={127} textAnchor="middle" fill="#e5e7eb" fontSize={9}>
        B
      </text>
      {b1Span > 6 ? (
        <>
          <line x1={left} y1={14} x2={axis} y2={14} stroke="#e5e7eb" strokeWidth={0.8} />
          <text x={(left + axis) / 2} y={12} textAnchor="middle" fill="#e5e7eb" fontSize={9}>
            B1
          </text>
        </>
      ) : (
        <text x={axis - 4} y={12} textAnchor="end" fill="#e5e7eb" fontSize={9}>
          B1=0
        </text>
      )}
    </svg>
  );
}
