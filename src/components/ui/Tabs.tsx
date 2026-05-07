import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "./cn";

interface TabsContextValue {
  value: string;
  onValueChange: (v: string) => void;
  values: string[];
  registerRef: (value: string, el: HTMLButtonElement | null) => void;
  focusValue: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function Tabs({
  value,
  onValueChange,
  children,
  className,
  "aria-label": ariaLabel,
}: TabsProps) {
  const refs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const values = useMemo(() => {
    const collected: string[] = [];
    Children.forEach(children, (child) => {
      if (
        isValidElement<{ value?: string }>(child) &&
        typeof child.props.value === "string"
      ) {
        collected.push(child.props.value);
      }
    });
    return collected;
  }, [children]);

  const registerRef = useCallback((v: string, el: HTMLButtonElement | null) => {
    if (el) {
      refs.current.set(v, el);
    } else {
      refs.current.delete(v);
    }
  }, []);

  const focusValue = useCallback((v: string) => {
    refs.current.get(v)?.focus();
  }, []);

  const ctx = useMemo<TabsContextValue>(
    () => ({ value, onValueChange, values, registerRef, focusValue }),
    [value, onValueChange, values, registerRef, focusValue]
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn("flex items-center gap-1", className)}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabButtonProps {
  value: string;
  icon?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export function TabButton({
  value,
  icon,
  disabled,
  children,
  className,
}: TabButtonProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error("TabButton must be a child of <Tabs>");
  }
  const isActive = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      ref={(el) => ctx.registerRef(value, el)}
      onClick={() => {
        if (!isActive) {
          ctx.onValueChange(value);
        }
      }}
      onKeyDown={(e) => {
        const idx = ctx.values.indexOf(value);
        if (idx < 0) {
          return;
        }
        let nextIdx: number | null = null;
        if (e.key === "ArrowRight") {
          nextIdx = (idx + 1) % ctx.values.length;
        } else if (e.key === "ArrowLeft") {
          nextIdx = (idx - 1 + ctx.values.length) % ctx.values.length;
        } else if (e.key === "Home") {
          nextIdx = 0;
        } else if (e.key === "End") {
          nextIdx = ctx.values.length - 1;
        }
        if (nextIdx === null) {
          return;
        }
        e.preventDefault();
        const nextValue = ctx.values[nextIdx];
        ctx.focusValue(nextValue);
      }}
      className={cn(
        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50",
        isActive
          ? "bg-curro-blue text-white shadow-lg"
          : "text-text-muted hover:bg-gray-50",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}
