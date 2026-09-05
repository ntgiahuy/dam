"use client";

import { useMemo, useState } from "react";
import type { BeamProject, ExtraBar, TabId } from "@/lib/types";
import {
  computeModel,
  resolveExtraBars,
  supportWidthLabel,
  barNotation,
  supportGeometry,
  extraLayerOffsetMm,
  type ResolvedBar,
} from "@/lib/calc";
import { extraTieElevationNote } from "@/lib/extra-ties";

export function BeamPreview({
  project,
  tab,
  selectedSpan,
  selectedSupport,
  highlightStart,
  highlightEnd,
  extraDraft,
  onSelectSpan,
  onSelectSupport,
}: {
  project: BeamProject;
  tab: TabId;
  selectedSpan: number;
  selectedSupport: number;
  highlightStart: number;
  highlightEnd: number;
  extraDraft: ExtraBar | null;
  onSelectSpan: (i: number) => void;
  onSelectSupport: (i: number) => void;
}) {
  const model = useMemo(() => computeModel(project), [project]);
  const extraFace = tab === "extraTop" ? "top" : "bottom";
  const samples = useMemo(() => {
    if (!extraDraft || (tab !== "extraBottom" && tab !== "extraTop")) return [];
    return resolveExtraBars(project, [extraDraft], extraFace);
  }, [extraDraft, extraFace, project, tab]);
  const [hoverSupport, setHoverSupport] = useState<number | null>(null);
  const padL = 56;
  const padR = 24;
  const padT = 58;
  const beamH = 70;
  const W = 1100;
  const H = 186;
  const focusExtra = tab === "extraBottom" || tab === "extraTop";
  const viewX0 = 0;
  const viewX1 = model.total;
  const viewW = Math.max(viewX1 - viewX0, 1);
  const scale = (W - padL - padR) / viewW;
  const x = (mm: number) => padL + (mm - viewX0) * scale;
  const y0 = padT;
  const y1 = padT + beamH;
  const planes = barPlanes(y0, y1, beamH, model.H, project.info.cover);
  const axisCy = 13;
  const axisR = 9;
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
          const active = !selectSupports && i >= highlightStart && i < highlightEnd;
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
          const { width: Bmm, leftToAxis: B1mm } = supportGeometry(sup.B, sup.B1);
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
                y1={2}
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
              <circle
                cx={cx}
                cy={axisCy}
                r={axisR}
                fill="#1a1a1a"
                stroke={active ? "#60a5fa" : "#facc15"}
                strokeWidth={1.2}
                pointerEvents="none"
              />
              <text
                x={cx}
                y={axisCy + 4}
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

        {model.mainBottom.map((b, i) => (
            <RebarMark
              key={`${b.sourceId}-${b.pieceIndex ?? i}-${Math.round(b.x1)}`}
              b={b}
              x={x}
              y={planes.botMain}
              face="bottom"
              color="#ef4444"
              width={2}
              opacity={focusExtra ? 0.22 : 1}
            />
        ))}
        {focusExtra && extraFace === "bottom" && model.mainBottom.length === 0 && (
            <line
              key="ghost-bot"
              x1={x(0)}
              x2={x(model.total)}
              y1={planes.botMain}
              y2={planes.botMain}
              stroke="#ef4444"
              strokeWidth={1.5}
              opacity={0.22}
              pointerEvents="none"
            />
        )}
        {model.extraBottom.map((b) => (
            <RebarMark
              key={b.sourceId}
              b={b}
              x={x}
              y={extraY("bottom", b.layer, planes)}
              face="bottom"
              color="#f87171"
              width={1.7}
              opacity={tab === "extraBottom" ? 0.4 : 1}
            />
        ))}
        {model.mainTop.map((b) => (
            <RebarMark
              key={b.sourceId}
              b={b}
              x={x}
              y={planes.topMain}
              face="top"
              color="#ef4444"
              width={2}
              opacity={focusExtra ? 0.22 : 1}
            />
        ))}
        {focusExtra && extraFace === "top" && model.mainTop.length === 0 && (
            <line
              key="ghost-top"
              x1={x(0)}
              x2={x(model.total)}
              y1={planes.topMain}
              y2={planes.topMain}
              stroke="#ef4444"
              strokeWidth={1.5}
              opacity={0.22}
              pointerEvents="none"
            />
        )}
        {model.extraTop.map((b) => (
            <RebarMark
              key={b.sourceId}
              b={b}
              x={x}
              y={extraY("top", b.layer, planes)}
              face="top"
              color="#f87171"
              width={1.7}
              opacity={tab === "extraTop" ? 0.35 : 1}
            />
        ))}
        {project.spans.map((_, i) => {
          if (!project.stirrups[i]?.antiBuckling) return null;
          const midY = (planes.topMain + planes.botMain) / 2;
          return (
            <line
              key={`cp-${i}`}
              x1={x(model.xs[i])}
              x2={x(model.xs[i + 1] ?? model.xs[i])}
              y1={midY}
              y2={midY}
              stroke="#e879f9"
              strokeWidth={1.6}
              pointerEvents="none"
            />
          );
        })}

        {!focusExtra &&
          model.stirrups.ticks.filter((_, i) => i % 2 === 0).map((t, i) => (
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

        {project.spans.map((sp, i) => {
          const extraNote = extraTieElevationNote(project, i);
          return (
          <g key={`L-${sp.id}`} pointerEvents="none">
            <text
              x={(x(model.xs[i]) + x(model.xs[i + 1])) / 2}
              y={axisCy + 4}
              textAnchor="middle"
              fill="#d4d4d8"
              fontSize={10}
            >
              L={sp.L}
            </text>
            {extraNote ? (
              <text
                x={(x(model.xs[i]) + x(model.xs[i + 1])) / 2}
                y={y0 - 10}
                textAnchor="middle"
                fill="#fbbf24"
                fontSize={8}
              >
                {extraNote}
              </text>
            ) : null}
          </g>
          );
        })}

        {samples.map((sample, i) =>
          extraFace === "bottom" ? (
            <g key={`sample-bot-${i}`}>
              <RebarMark
                b={sample}
                x={x}
                y={extraY("bottom", extraDraft?.layer ?? 1, planes)}
                face="bottom"
                color="#ef4444"
                width={2.6}
              />
              <text
                x={(x(sample.x1) + x(sample.x2)) / 2}
                y={extraY("bottom", extraDraft?.layer ?? 1, planes) - 8}
                textAnchor="middle"
                fill="#fca5a5"
                fontSize={9}
                pointerEvents="none"
              >
                mẫu lớp {extraDraft?.layer ?? 1} · {sample.startType}→{sample.endType}
              </text>
            </g>
          ) : (
            <g key={`sample-top-${i}`}>
              <RebarMark
                b={sample}
                x={x}
                y={extraY("top", extraDraft?.layer ?? 1, planes)}
                face="top"
                color="#ef4444"
                width={2.6}
              />
              <text
                x={(x(sample.x1) + x(sample.x2)) / 2}
                y={extraY("top", extraDraft?.layer ?? 1, planes) + 12}
                textAnchor="middle"
                fill="#fca5a5"
                fontSize={9}
                pointerEvents="none"
              >
                mẫu lớp {extraDraft?.layer ?? 1} · {sample.startType}→{sample.endType}
              </text>
            </g>
          ),
        )}
      </svg>
      <div className="pointer-events-none absolute bottom-1 left-2 text-[10px] text-zinc-500">
        {focusExtra
          ? "Thanh đỏ: mẫu theo Dạng bắt đầu / kết thúc — chưa cần Thêm"
          : `${project.info.name} · ${project.spans.length} nhịp${
              project.mainBottom[0]
                ? ` · ${barNotation(project.mainBottom[0].qty, project.mainBottom[0].dia)} dưới`
                : " · chưa có thép chủ"
            } · ${supportWidthLabel(project, selectedSupport)} gối ${selectSupports ? selectedSupport : selectedSpan}`}
      </div>
    </div>
  );
}

type BarPlanes = { botMain: number; topMain: number; mmToPx: number };

function barPlanes(y0: number, y1: number, beamHpx: number, Hmm: number, coverMm: number): BarPlanes {
  const mmToPx = beamHpx / Math.max(Hmm || 500, 1);
  const cover = Math.max(7, (coverMm || 25) * mmToPx);
  return { botMain: y1 - cover, topMain: y0 + cover, mmToPx };
}

function extraY(face: "top" | "bottom", layer: number, planes: BarPlanes) {
  const inward = extraLayerOffsetMm(layer) * planes.mmToPx;
  return face === "bottom" ? planes.botMain - inward : planes.topMain + inward;
}

function RebarMark({
  b,
  x,
  y,
  face,
  color,
  width,
  opacity = 1,
}: {
  b: ResolvedBar;
  x: (mm: number) => number;
  y: number;
  face: "top" | "bottom";
  color: string;
  width: number;
  opacity?: number;
}) {
  const hookPx = 16;
  const dir = face === "bottom" ? -1 : 1;
  const x1 = x(b.x1);
  const x2 = x(b.x2);
  const parts = [`M ${x1} ${b.hookStart > 0 ? y + dir * hookPx : y}`];
  if (b.hookStart > 0) parts.push(`L ${x1} ${y}`);
  parts.push(`L ${x2} ${y}`);
  if (b.hookEnd > 0) parts.push(`L ${x2} ${y + dir * hookPx}`);
  const lap = b.spliceLapMm && b.spliceLapMm > 0 ? b.spliceLapMm : 0;
  return (
    <g pointerEvents="none" opacity={opacity}>
      <path
        d={parts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {lap > 0 ? (
        <line
          x1={x(b.x2 - lap)}
          x2={x2}
          y1={y}
          y2={y}
          stroke={color}
          strokeWidth={width + 1.4}
          strokeLinecap="butt"
          opacity={0.45}
        />
      ) : null}
    </g>
  );
}
