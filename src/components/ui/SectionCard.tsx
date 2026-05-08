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
  children: ReactNode;
}

export function SectionCard({
  variant,
  title,
  subtitle,
  icon,
  headerActions,
  className,
  children,
}: SectionCardProps) {
  const v = VARIANTS[variant];
  return (
    <section
      className={cn(
        "bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden",
        className
      )}
    >
      <header
        className={cn(
          "p-6 flex items-center justify-between",
          v.header,
          v.border
        )}
      >
        <div className="flex items-center gap-4 min-w-0">
          {icon && (
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                v.iconBg
              )}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tight leading-tight truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-white/60 text-xs font-black uppercase tracking-widest mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {headerActions && <div className="shrink-0 ml-4">{headerActions}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}
