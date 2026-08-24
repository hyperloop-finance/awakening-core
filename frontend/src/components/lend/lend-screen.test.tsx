import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LendScreen } from "./lend-screen";

describe("LendScreen", () => {
  it("gates simulation behind a valid preview and clears it when input changes", () => {
    render(<LendScreen marketId={`0x${"a".repeat(64)}`} side="LEND" />);

    const simulate = screen.getByRole("button", { name: "Simulate offer submission" });
    expect(simulate).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Preview offer" }));
    expect(screen.getByText("PAT coverage")).toBeInTheDocument();
    expect(simulate).toBeEnabled();
    fireEvent.click(simulate);
    expect(screen.getByText(/No signature or transaction was sent/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("USDC amount"), { target: { value: "0" } });
    expect(screen.queryByText("PAT coverage")).not.toBeInTheDocument();
    expect(simulate).toBeDisabled();
    expect(screen.getByRole("button", { name: /Live signature/ })).toBeDisabled();
  });
});
