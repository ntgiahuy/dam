"use client";

import type { StirrupKind } from "@/lib/types";

export function StirrupSketch({
  kind = "don",
  extraC = false,
  extraNested = false,
  extraDouble = false,
}: {
  kind?: StirrupKind;
  extraC?: boolean;
  extraNested?: boolean;
  extraDouble?: boolean;
}) {
  const twin = kind === "kep";
  return (
    <svg
      viewBox="0 0 168 150"
      className="h-[148px] w-[168px] shrink-0 rounded border border-zinc-700 bg-white"
      aria-hidden
    >
      <rect x={1} y={1} width={166} height={148} fill="#fafafa" />
      <StirrupPath ox={twin ? 28 : 44} />
      {twin ? <StirrupPath ox={88} /> : null}
      {extraNested && !extraDouble ? <InnerHoop /> : null}
      {extraDouble ? (
        <>
          <InnerHoop ox={-6} />
          <InnerHoop ox={6} />
        </>
      ) : null}
      {extraC ? <CLink /> : null}
    </svg>
  );
}

function StirrupPath({ ox }: { ox: number }) {
  const x = ox;
  const y = 28;
  const w = 52;
  const h = 88;
  const r = 7;
  return (
    <g fill="none" stroke="#ea580c" strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round">
      <path
        d={`M ${x + 10} ${y + 4}
           L ${x + w - r} ${y + 4}
           Q ${x + w} ${y + 4} ${x + w} ${y + 4 + r}
           L ${x + w} ${y + h - r}
           Q ${x + w} ${y + h} ${x + w - r} ${y + h}
           L ${x + r} ${y + h}
           Q ${x} ${y + h} ${x} ${y + h - r}
           L ${x} ${y + 4 + r}
           Q ${x} ${y + 4} ${x + r} ${y + 4}
           L ${x + 14} ${y + 4}
           L ${x + 14} ${y + 18}`}
      />
    </g>
  );
}

function InnerHoop({ ox = 0 }: { ox?: number }) {
  const x = 58 + ox;
  const y = 42;
  const w = 28;
  const h = 58;
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={4}
      fill="none"
      stroke="#0d9488"
      strokeWidth={2}
    />
  );
}

function CLink() {
  return (
    <path
      d="M 78 40 L 78 108 L 102 108"
      fill="none"
      stroke="#2563eb"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
