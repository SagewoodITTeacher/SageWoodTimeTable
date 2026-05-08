import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShieldAlert } from "lucide-react";
import { SectionCard } from "./SectionCard";

describe("SectionCard", () => {
  it("renders title and children", () => {
    render(
      <SectionCard variant="red" title="Incidents">
        <p>body</p>
      </SectionCard>
    );
    expect(screen.getByRole("heading", { name: "Incidents" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(
      <SectionCard variant="emerald" title="Stats" subtitle="Last 24h">
        <p />
      </SectionCard>
    );
    expect(screen.getByText("Last 24h")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <SectionCard variant="red" title="X" icon={<ShieldAlert data-testid="icn" />}>
        <p />
      </SectionCard>
    );
    expect(screen.getByTestId("icn")).toBeInTheDocument();
  });

  it("renders headerActions in the right rail", () => {
    render(
      <SectionCard
        variant="blue"
        title="X"
        headerActions={<span data-testid="hdr">2 PENDING</span>}
      >
        <p />
      </SectionCard>
    );
    expect(screen.getByTestId("hdr")).toHaveTextContent("2 PENDING");
  });

  it("applies the variant class to the header", () => {
    const { container } = render(
      <SectionCard variant="emerald" title="X">
        <p />
      </SectionCard>
    );
    const header = container.querySelector("header")!;
    expect(header.className).toMatch(/emerald/);
  });

  it("uses a heading element so screen readers can navigate by headings", () => {
    render(
      <SectionCard variant="red" title="Heading">
        <p />
      </SectionCard>
    );
    expect(screen.getByRole("heading", { name: "Heading" }).tagName).toBe("H2");
  });
});
