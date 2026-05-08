import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "../ui";

function ToastFireButton() {
  const toast = useToast();
  return <button onClick={() => toast.error("Smoke test failure")}>Fire</button>;
}

describe("Toast smoke (AdminPanel replacement target)", () => {
  it("renders an error toast with role=alert when invoked", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastFireButton />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: /fire/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Smoke test failure");
  });
});
