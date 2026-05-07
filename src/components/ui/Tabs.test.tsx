import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabButton } from "./Tabs";

function Demo({
  initial = "a",
  onChange = () => {},
}: {
  initial?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <Tabs value={initial} onValueChange={onChange} aria-label="Demo tabs">
      <TabButton value="a">Alpha</TabButton>
      <TabButton value="b">Beta</TabButton>
      <TabButton value="c">Gamma</TabButton>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders a tablist with three tabs", () => {
    render(<Demo />);
    expect(screen.getByRole("tablist", { name: "Demo tabs" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("marks the active tab with aria-selected=true and the rest false", () => {
    render(<Demo initial="b" />);
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onValueChange when a non-active tab is clicked", async () => {
    const onChange = vi.fn();
    render(<Demo initial="a" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Gamma" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("ArrowRight moves focus to next tab; ArrowLeft moves to previous", async () => {
    render(<Demo initial="a" />);
    const a = screen.getByRole("tab", { name: "Alpha" });
    a.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Beta" })).toBe(document.activeElement);
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toBe(document.activeElement);
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toBe(document.activeElement);
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toBe(document.activeElement);
  });

  it("Home jumps to first tab; End to last", async () => {
    render(<Demo initial="b" />);
    const b = screen.getByRole("tab", { name: "Beta" });
    b.focus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toBe(document.activeElement);
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toBe(document.activeElement);
  });

  it("active tab has tabIndex=0; inactive tabs have tabIndex=-1 (roving tabindex)", () => {
    render(<Demo initial="b" />);
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("tabindex", "-1");
  });
});
