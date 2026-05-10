import type { ReactNode } from "react";
import { cn } from "./cn";

export type SectionCardVariant = "emerald" | "red" | "blue" | "amber" | "zinc";

interface VariantStyle {
  header: string;
  border: string;
  iconBg: string;
}

const VARIANTS: Record<SectionCardVariant, VariantStyle> = {
  emerald: {
    header: "bg-emerald-600 text-white",
    border: "border-b-4 border-emerald-800",
    iconBg: "bg-white/15",
  },
  red: {
    header: "bg-curro-red text-white",
    border: "border-b-4 border-red-800",
    iconBg: "bg-white/10",
  },
  blue: {
    header: "bg-curro-blue text-white",
    border: "border-b-4 border-blue-900",
    iconBg: "bg-white/10",
  },
  amber: {
    header: "bg-amber-500 text-white",
    border: "border-b-4 border-amber-700",
    iconBg: "bg-white/15",
  },
  zinc: {
    header: "bg-zinc-900 text-white",
    border: "border-b-4 border-zinc-700",
    iconBg: "bg-white/10",
  },
};

export interface SectionCardProps {
  variant: SectionCardVariant;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  headerActions?: ReactNode;
  className?: string;
  id?: string;
  children: ReactNode;
}

export function SectionCard({
  variant,
  title,
  subtitle,
  icon,
  headerActions,
  className,
  id,
  children,
}: SectionCardProps) {
  const v = VARIANTS[variant];
  return (
    <section
      id={id}
      className={cn(
        "bento-card overflow-hidden",
        className
      )}
    >
      <header
        className={cn(
          "p-8 flex items-center justify-between",
          "bg-white/[0.02] border-b border-white/5",
          // v.header, // Let's simplify and use the common bento header style
          // v.border
        )}
      >
        <div className="flex items-center gap-5 min-w-0">
          {icon && (
            <div
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner",
                // v.iconBg
              )}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-[0.2em] leading-tight truncate text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {headerActions && <div className="shrink-0 ml-4">{headerActions}</div>}
      </header>
      <div className="p-8">{children}</div>
    </section>
  );
}
