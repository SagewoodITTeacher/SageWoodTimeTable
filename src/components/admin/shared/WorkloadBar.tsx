import React from "react";
import { WorkloadBreakdown } from "./types";

export function WorkloadBar({
  breakdown,
  assigned,
  target,
  onClick,
}: {
  breakdown: WorkloadBreakdown;
  assigned: number;
  target: number;
  onClick?: () => void;
}) {
  const overload = target > 0 && assigned > target;
  const segments: Array<{ v: number; cls: string; label: string }> = [
    { v: breakdown.morning, cls: "bg-gray-300", label: "Morning" },
    { v: breakdown.afternoon, cls: "bg-gray-500", label: "Afternoon" },
    { v: breakdown.tech, cls: "bg-blue-500", label: "Tech" },
    { v: breakdown.standby, cls: "bg-emerald-500", label: "Standby" },
  ];

  let used = 0;
  const rendered = segments.map((seg) => {
    const raw = target > 0 ? (seg.v / target) * 100 : 0;
    const headroom = Math.max(0, 100 - used);
    const w = Math.max(0, Math.min(raw, headroom));
    used += w;
    return { ...seg, w };
  });

  const overflowPct = overload
    ? Math.min(((assigned - target) / target) * 100, 35)
    : 0;
  const tooltip = onClick
    ? `Morning ${breakdown.morning} · Afternoon ${breakdown.afternoon} · Tech ${breakdown.tech} · Standby ${breakdown.standby} — click to inspect`
    : `Morning ${breakdown.morning} · Afternoon ${breakdown.afternoon} · Tech ${breakdown.tech} · Standby ${breakdown.standby}`;

  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex flex-col gap-1 min-w-[140px] text-left ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity rounded" : ""}`}
      title={tooltip}
      aria-label={onClick ? "Inspect workload details" : undefined}
    >
      <div className="flex items-stretch h-2 rounded-full overflow-hidden bg-gray-100">
        <div className="flex flex-1">
          {rendered.map((s) =>
            s.w > 0 ? (
              <div
                key={s.label}
                className={s.cls}
                style={{ width: `${s.w}%` }}
              />
            ) : null,
          )}
        </div>
        {overload && (
          <div
            className="bg-curro-red"
            style={{ width: `${overflowPct}%`, marginLeft: 1 }}
          />
        )}
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] font-mono leading-none">
        <span
          className={`font-black ${overload ? "text-curro-red" : "text-curro-blue"}`}
        >
          {assigned.toLocaleString()}
        </span>
        <span className="text-text-muted">
          / {target.toLocaleString()} min
        </span>
      </div>
    </Wrapper>
  );
}
