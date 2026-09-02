"use client";

function hoggingLeft(y: number, hooked: boolean) {
  return hooked ? `M 40 ${y + 16} L 40 ${y} L 78 ${y}` : `M 40 ${y} L 78 ${y}`;
}

function hoggingRight(y: number, hooked: boolean) {
  return hooked ? `M 132 ${y} L 170 ${y} L 170 ${y + 16}` : `M 132 ${y} L 170 ${y}`;
}

function endPath(
  type: number,
  side: "left" | "right",
  y: number,
  dir: number,
  face: "top" | "bottom",
) {
  const axis = side === "left" ? 40 : 170;
  const inner = side === "left" ? 52 : 158;
  const midspan = side === "left" ? 88 : 122;
  const hook = 16;
  if (type === 4) {
    const hx = axis;
    return side === "left"
      ? `M ${hx} ${y + dir * hook} L ${hx} ${y}`
      : `L ${hx} ${y} L ${hx} ${y + dir * hook}`;
  }
  if (type === 1) {
    if (face === "top") return side === "left" ? `M ${axis} ${y}` : `L ${axis} ${y}`;
    return side === "left" ? `M ${midspan} ${y}` : `L ${midspan} ${y}`;
  }
  if (type === 2) {
    if (face === "top") return side === "left" ? `M ${axis} ${y}` : `L ${axis} ${y}`;
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
  startAxis,
  endAxis,
  lastAxis,
}: {
  startType: number;
  endType: number;
  face: "top" | "bottom";
  startHook?: number;
  endHook?: number;
  startAxis?: number;
  endAxis?: number;
  lastAxis?: number;
}) {
  const dir = face === "bottom" ? -1 : 1;
  const yA = 38;
  const yB = 54;
  const hogging = face === "top" && (startType === 1 || endType === 1);
  const both = startType === 1 && endType === 1;
  let leftStub = both || (endType === 1 && startType !== 1);
  let rightStub = both || (startType === 1 && endType !== 1);
  const sameAxis = startAxis != null && endAxis != null && startAxis === endAxis;
  if (sameAxis && face === "top") {
    if (startAxis === 0) {
      leftStub = true;
      rightStub = false;
    } else if (lastAxis != null && startAxis === lastAxis) {
      leftStub = false;
      rightStub = true;
    }
  }
  const hookL = (startHook ?? 0) > 0;
  const hookR = (endHook ?? 0) > 0;
  const dA = hogging
    ? null
    : `${endPath(startType, "left", yA, dir, face)} ${endPath(endType, "right", yA, dir, face)}`;
  const dB = hogging
    ? null
    : `${endPath(startType, "left", yB, -dir, face)} ${endPath(endType, "right", yB, -dir, face)}`;

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
        {hogging ? (
          <>
            {leftStub && (
              <>
                <path d={hoggingLeft(yA, hookL)} fill="none" stroke="#ef4444" strokeWidth={2.2} strokeLinecap="square" />
                <path d={hoggingLeft(yB, hookL)} fill="none" stroke="#ef4444" strokeWidth={2.2} strokeLinecap="square" />
              </>
            )}
            {rightStub && (
              <>
                <path d={hoggingRight(yA, hookR)} fill="none" stroke="#ef4444" strokeWidth={2.2} strokeLinecap="square" />
                <path d={hoggingRight(yB, hookR)} fill="none" stroke="#ef4444" strokeWidth={2.2} strokeLinecap="square" />
              </>
            )}
          </>
        ) : (
          <>
            <path d={dA ?? ""} fill="none" stroke="#ef4444" strokeWidth={2.2} strokeLinecap="square" />
            <path d={dB ?? ""} fill="none" stroke="#ef4444" strokeWidth={2.2} strokeLinecap="square" />
          </>
        )}
        {hookL && startHook ? (
          <text x={8} y={28} fill="#fca5a5" fontSize={8}>
            {startHook}
          </text>
        ) : null}
        {hookR && endHook ? (
          <text x={202} y={28} textAnchor="end" fill="#fca5a5" fontSize={8}>
            {endHook}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
