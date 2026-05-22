import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CartPage from "../pages/CartPage";
import { CartContext } from "../state/CartContext";
import type { CartItem } from "../types";

vi.mock("../api", () => ({
  createOrder: vi.fn(),
}));

import { createOrder } from "../api";

const mockItems: CartItem[] = [
  { productId: 1, name: "Headphones", price: 99.99, quantity: 1 },
];

function renderCartPage() {
  return render(
    <MemoryRouter>
      <CartContext.Provider
        value={{
          items: mockItems,
          total: 99.99,
          add: vi.fn(),
          remove: vi.fn(),
          clear: vi.fn(),
        }}
      >
        <CartPage />
      </CartContext.Provider>
    </MemoryRouter>,
  );
}

describe("CartPage - double submit prevention", () => {
  it("disables checkout button while request is in flight", async () => {
    let resolveOrder: (val: unknown) => void;
    (createOrder as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveOrder = resolve;
      }),
    );

    renderCartPage();

    const button = screen.getByText("Checkout");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Processing...")).toBeDisabled();
    });

    resolveOrder!({ id: 1 });
  });

  it("shows error message when checkout fails", async () => {
    (createOrder as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Insufficient stock"),
    );

    renderCartPage();

    const button = screen.getByText("Checkout");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Insufficient stock")).toBeInTheDocument();
    });
  });
});