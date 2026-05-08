import React, { useState, useEffect, useRef } from "react";
import { MoreVertical } from "lucide-react";

export type OverflowItem = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

export function OverflowMenu({
  items,
  danger,
}: {
  items: OverflowItem[];
  danger?: OverflowItem;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`p-2 rounded-lg transition-colors ${open ? "bg-gray-100 text-text-dark" : "hover:bg-gray-100 text-text-muted hover:text-text-dark"}`}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl border border-gray-100 shadow-lg py-1 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-text-dark hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-text-muted">{it.icon}</span>
              {it.label}
            </button>
          ))}
          {danger && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  danger.onClick();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                {danger.icon}
                {danger.label}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
