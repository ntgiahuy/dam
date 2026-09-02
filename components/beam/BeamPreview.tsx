"use client";

import { useMemo } from "react";
import type { BeamProject, TabId } from "@/lib/types";
import { computeModel, supportWidthLabel, barNotation } from "@/lib/calc";

export function BeamPreview({
  project,
  tab,
  selectedSpan,
  selectedSupport,
  onSelectSpan,
  onSelectSupport,
}: {
  project: BeamProject;
  tab: TabId;
  selectedSpan: number;
  selectedSupport: number;
  onSelectSpan: (i: number) => void;
  onSelectSupport: (i: number) => void;
}) {
  const model = useMemo(() => computeModel(project), [project]);
  const padL = 56;
  const padR = 24;
  const padT = 36;
  const beamH = 70;
  const W = 1100;
  const H = 160;
  const scale = model.total > 0 ? (W - padL - padR) / model.total : 1;
  const x = (mm: number) => padL + mm * scale;
  const y0 = padT;
  const y1 = padT + beamH;
  const selectSupports = tab === "supports";

  return (
    <div className="relative h-full min-h-[180px] overflow-auto bg-[#1a1a1a]">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full min-h-[180px]">
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={i}
            x1={0}
            x2={W}
            y1={20 + i * 18}
            y2={20 + i * 18}
            stroke="#2a2a2a"
            strokeWidth={0.6}
          />
        ))}

        {project.spans.map((sp, i) => {
          const active = !selectSupports && selectedSpan === i;
          return (
            <rect
              key={sp.id}
              x={x(model.xs[i])}
              y={y0 - 6}
              width={Math.max(x(model.xs[i + 1]) - x(model.xs[i]), 2)}
              height={beamH + 12}
              fill={active ? "rgba(59,130,246,0.12)" : "transparent"}
              stroke={active ? "#3b82f6" : "transparent"}
              strokeWidth={active ? 1.2 : 0}
              className="cursor-pointer"
              onClick={() => onSelectSpan(i)}
            />
          );
        })}

        <path
          d={`M ${x(0)} ${y0} L ${x(model.total)} ${y0} L ${x(model.total)} ${y1} L ${x(0)} ${y1} Z`}
          fill="none"
          stroke="#86ef65"
          strokeWidth={1.4}
        />

        {project.supports.map((sup, i) => {
          const cx = x(model.xs[i]);
          const half = ((sup.B || 200) * scale) / 2;
          const active = selectSupports && selectedSupport === i;
          return (
            <g key={sup.id} className="cursor-pointer" onClick={() => onSelectSupport(i)}>
              <line x1={cx} y1={8} x2={cx} y2={y1 + 18} stroke="#a3e635" strokeDasharray="4 3" strokeWidth={0.8} />
              <rect x={cx - half} y={y1} width={half * 2} height={16} fill="none" stroke="#86ef65" strokeWidth={1.2} />
              <rect x={cx - half} y={y0 - 16} width={half * 2} height={16} fill="none" stroke="#86ef65" strokeWidth={1.2} />
              {active && (
                <rect
                  x={cx - half - 4}
                  y={y0 - 20}
                  width={half * 2 + 8}
                  height={beamH + 40}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth={1.2}
                />
              )}
              <circle cx={cx} cy={14} r={9} fill="#1a1a1a" stroke="#facc15" strokeWidth={1.2} />
              <text x={cx} y={18} textAnchor="middle" fill="#facc15" fontSize={10} fontFamily="sans-serif">
                {i}
              </text>
            </g>
          );
        })}

        {model.mainBottom.map((b) => (
          <line
            key={b.sourceId}
            x1={x(b.x1)}
            x2={x(b.x2)}
            y1={y1 - 10}
            y2={y1 - 10}
            stroke="#ef4444"
            strokeWidth={2}
          />
        ))}
        {model.extraBottom.map((b) => (
          <line
            key={b.sourceId}
            x1={x(b.x1)}
            x2={x(b.x2)}
            y1={y1 - 18}
            y2={y1 - 18}
            stroke="#f87171"
            strokeWidth={1.6}
          />
        ))}
        {model.mainTop.map((b) => (
          <line
            key={b.sourceId}
            x1={x(b.x1)}
            x2={x(b.x2)}
            y1={y0 + 10}
            y2={y0 + 10}
            stroke="#ef4444"
            strokeWidth={2}
          />
        ))}
        {model.extraTop.map((b) => (
          <line
            key={b.sourceId}
            x1={x(b.x1)}
            x2={x(b.x2)}
            y1={y0 + 18}
            y2={y0 + 18}
            stroke="#f87171"
            strokeWidth={1.6}
          />
        ))}

        {model.stirrups.ticks.filter((_, i) => i % 2 === 0).map((t, i) => (
          <line
            key={i}
            x1={x(t.x)}
            x2={x(t.x)}
            y1={y0 + 4}
            y2={y1 - 4}
            stroke="#fb7185"
            strokeWidth={0.5}
            opacity={0.7}
          />
        ))}

        {project.secondary.map((s) => (
          <g key={s.id}>
            <line
              x1={x(s.position)}
              x2={x(s.position)}
              y1={y0 - 8}
              y2={y1}
              stroke="#fde047"
              strokeWidth={2}
            />
            <text x={x(s.position) + 4} y={y0 - 10} fill="#fde047" fontSize={9}>
              {s.kind === "dam-phu" ? "DP" : "Trụ"} {s.position}
            </text>
          </g>
        ))}

        {project.spans.map((sp, i) => (
          <text
            key={`L-${sp.id}`}
            x={(x(model.xs[i]) + x(model.xs[i + 1])) / 2}
            y={y0 - 20}
            textAnchor="middle"
            fill="#d4d4d8"
            fontSize={10}
          >
            L={sp.L}
          </text>
        ))}
      </svg>
      <div className="pointer-events-none absolute bottom-1 left-2 text-[10px] text-zinc-500">
        {project.info.name} · {project.spans.length} nhịp · {barNotation(
          project.mainBottom[0]?.qty ?? 0,
          project.mainBottom[0]?.dia ?? 0,
        )} dưới · {supportWidthLabel(project, 0)} gối đầu
      </div>
    </div>
  );
}
