"use client";

function endPath(type: number, side: "left" | "right", y: number, dir: number) {
  const axis = side === "left" ? 40 : 170;
  const inner = side === "left" ? 52 : 158;
  const eighth = side === "left" ? 72 : 138;
  const hook = 16;
  if (type === 4) {
    const hx = axis;
    return side === "left"
      ? `M ${hx} ${y + dir * hook} L ${hx} ${y}`
      : `L ${hx} ${y} L ${hx} ${y + dir * hook}`;
  }
  if (type === 1) {
    return side === "left" ? `M ${eighth} ${y}` : `L ${eighth} ${y}`;
  }
  if (type === 2) {
    return side === "left" ? `M ${inner} ${y}` : `L ${inner} ${y}`;
  }
  return side === "left" ? `M ${axis} ${y}` : `L ${axis} ${y}`;
}

export function ExtraShapeSketch({
  startType,
  endType,
  face,
  startHook,
  endHook,
}: {
  startType: number;
  endType: number;
  face: "top" | "bottom";
  startHook?: number;
  endHook?: number;
}) {
  const dir = face === "bottom" ? -1 : 1;
  const yA = 38;
  const yB = 54;
  const dA = `${endPath(startType, "left", yA, dir)} ${endPath(endType, "right", yA, dir)}`;
  const dB = `${endPath(startType, "left", yB, -dir)} ${endPath(endType, "right", yB, -dir)}`;

  return (
    <div className="rounded border border-zinc-700 bg-zinc-950 p-2">
      <div className="mb-1 text-[11px] text-zinc-400">Thanh mẫu (chưa cần Thêm)</div>
      <svg viewBox="0 0 210 80" className="h-[88px] w-full max-w-[280px]">
        <rect x={28} y={22} width={24} height={42} fill="none" stroke="#86ef65" />
        <rect x={158} y={22} width={24} height={42} fill="none" stroke="#86ef65" />
        <rect x={40} y={30} width={130} height={26} fill="none" stroke="#4ade80" />
        <line x1={40} y1={8} x2={40} y2={72} stroke="#a3e635" strokeDasharray="3 2" strokeWidth={1} />
        <line x1={170} y1={8} x2={170} y2={72} stroke="#a3e635" strokeDasharray="3 2" strokeWidth={1} />
        <circle cx={40} cy={12} r={7} fill="#1a1a1a" stroke="#facc15" />
        <circle cx={170} cy={12} r={7} fill="#1a1a1a" stroke="#facc15" />
        <text x={40} y={15} textAnchor="middle" fill="#facc15" fontSize={8}>
          0
        </text>
        <text x={170} y={15} textAnchor="middle" fill="#facc15" fontSize={8}>
          1
        </text>
        <path d={dA} fill="none" stroke="#ef4444" strokeWidth={2.2} strokeLinecap="square" />
        <path d={dB} fill="none" stroke="#ef4444" strokeWidth={2.2} strokeLinecap="square" />
        {startType === 4 && startHook ? (
          <text x={8} y={face === "bottom" ? 28 : 70} fill="#fca5a5" fontSize={8}>
            {startHook}
          </text>
        ) : null}
        {endType === 4 && endHook ? (
          <text x={202} y={face === "bottom" ? 28 : 70} textAnchor="end" fill="#fca5a5" fontSize={8}>
            {endHook}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
