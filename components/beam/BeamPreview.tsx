"use client";

import { useMemo, useState } from "react";
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
  const [hoverSupport, setHoverSupport] = useState<number | null>(null);
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
              className={selectSupports ? undefined : "cursor-pointer"}
              pointerEvents={selectSupports ? "none" : "all"}
              onClick={() => onSelectSpan(i)}
            />
          );
        })}

        <path
          d={`M ${x(0)} ${y0} L ${x(model.total)} ${y0} L ${x(model.total)} ${y1} L ${x(0)} ${y1} Z`}
          fill="none"
          stroke="#86ef65"
          strokeWidth={1.4}
          pointerEvents="none"
        />

        {project.supports.map((sup, i) => {
          const cx = x(model.xs[i]);
          const Bmm = sup.B || 200;
          const B1mm = sup.B1 > 0 ? sup.B1 : Bmm / 2;
          const colW = Math.max(Bmm * scale, 8);
          const left = cx - B1mm * scale;
          const hitW = Math.max(colW + 14, 32);
          const hitX = Math.min(left, cx) - 7;
          const active = selectSupports && selectedSupport === i;
          const hovered = selectSupports && hoverSupport === i && !active;
          return (
            <g key={sup.id}>
              <rect
                x={hitX}
                y={4}
                width={hitW}
                height={y1 + 22}
                fill={active ? "rgba(59,130,246,0.14)" : hovered ? "rgba(96,165,250,0.08)" : "transparent"}
                stroke={active ? "#60a5fa" : hovered ? "#93c5fd" : "transparent"}
                strokeWidth={active ? 1.6 : hovered ? 1 : 0}
                className={selectSupports ? "cursor-pointer" : undefined}
                pointerEvents={selectSupports ? "all" : "none"}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSupport(i);
                }}
                onMouseEnter={() => setHoverSupport(i)}
                onMouseLeave={() => setHoverSupport((cur) => (cur === i ? null : cur))}
              />
              <line
                x1={cx}
                y1={8}
                x2={cx}
                y2={y1 + 18}
                stroke="#a3e635"
                strokeDasharray="4 3"
                strokeWidth={0.8}
                pointerEvents="none"
              />
              <rect
                x={left}
                y={y1}
                width={colW}
                height={16}
                fill="none"
                stroke="#86ef65"
                strokeWidth={1.2}
                pointerEvents="none"
              />
              <rect
                x={left}
                y={y0 - 16}
                width={colW}
                height={16}
                fill="none"
                stroke="#86ef65"
                strokeWidth={1.2}
                pointerEvents="none"
              />
              <circle cx={cx} cy={14} r={9} fill="#1a1a1a" stroke={active ? "#60a5fa" : "#facc15"} strokeWidth={1.2} pointerEvents="none" />
              <text
                x={cx}
                y={18}
                textAnchor="middle"
                fill={active ? "#93c5fd" : "#facc15"}
                fontSize={10}
                fontFamily="sans-serif"
                pointerEvents="none"
              >
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
            pointerEvents="none"
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
            pointerEvents="none"
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
            pointerEvents="none"
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
            pointerEvents="none"
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
            pointerEvents="none"
          />
        ))}

        {project.secondary.map((s) => (
          <g key={s.id} pointerEvents="none">
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
            pointerEvents="none"
          >
            L={sp.L}
          </text>
        ))}
      </svg>
      <div className="pointer-events-none absolute bottom-1 left-2 text-[10px] text-zinc-500">
        {project.info.name} · {project.spans.length} nhịp
        {project.mainBottom[0]
          ? ` · ${barNotation(project.mainBottom[0].qty, project.mainBottom[0].dia)} dưới`
          : " · chưa có thép chủ"}{" "}
        · {supportWidthLabel(project, selectedSupport)} gối {selectSupports ? selectedSupport : "đầu"}
      </div>
    </div>
  );
}
