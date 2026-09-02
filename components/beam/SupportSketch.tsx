"use client";

import { Panel } from "@/components/ui/field";
import { supportGeometry } from "@/lib/calc";

export function SupportSketch({ B, B1 }: { B: number; B1: number }) {
  const { width, leftToAxis } = supportGeometry(B, B1);
  const vw = 248;
  const vh = 188;
  const axis = 124;
  const scale = 96 / Math.max(width, 40);
  const colW = Math.max(width * scale, 8);
  const left = axis - leftToAxis * scale;
  const beamY = 72;
  const colTop = 28;
  const colBot = 156;
  const b1Span = Math.abs(axis - left);

  return (
    <Panel title="Sơ đồ gối" className="w-[272px] shrink-0">
      <svg viewBox={`0 0 ${vw} ${vh}`} className="h-[176px] w-full">
        <rect
          x={left}
          y={colTop}
          width={colW}
          height={colBot - colTop}
          fill="#fbbf24"
          opacity={0.9}
          stroke="#e5e7eb"
          strokeWidth={0.9}
        />
        <rect x={12} y={beamY} width={vw - 24} height={28} fill="#2563eb" opacity={0.92} stroke="#e5e7eb" />
        <line
          x1={axis}
          y1={14}
          x2={axis}
          y2={colBot + 6}
          stroke="#a3e635"
          strokeDasharray="3.5 2.2"
          strokeWidth={1.2}
        />
        <line x1={left} y1={colBot + 8} x2={left + colW} y2={colBot + 8} stroke="#e5e7eb" strokeWidth={0.8} />
        <text x={left + colW / 2} y={colBot + 20} textAnchor="middle" fill="#e5e7eb" fontSize={10}>
          B={Math.round(width)}
        </text>
        {b1Span > 8 ? (
          <>
            <line x1={left} y1={20} x2={axis} y2={20} stroke="#e5e7eb" strokeWidth={0.8} />
            <text x={(left + axis) / 2} y={16} textAnchor="middle" fill="#e5e7eb" fontSize={10}>
              B1={Math.round(leftToAxis)}
            </text>
          </>
        ) : (
          <text x={axis - 6} y={18} textAnchor="end" fill="#a1a1aa" fontSize={10}>
            B1={Math.round(leftToAxis)}
          </text>
        )}
      </svg>
    </Panel>
  );
}
