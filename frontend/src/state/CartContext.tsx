import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";
import type { CartItem, Product } from "../types";

interface CartContextValue {
  items: CartItem[];
  add: (product: Product, quantity?: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  total: number;
}

export const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((product: Product, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((i) => i.productId === product.id);
      if (existing) {
        return current.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          price: parseFloat(product.price),
          quantity,
        },
      ];
    });
  }, []);

  const remove = useCallback((productId: number) => {
    setItems((current) => current.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

 const total = useMemo(
    () =>
      Math.round(
        items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0),
      ) / 100,
    [items],
  );

  const value = useMemo(
    () => ({ items, add, remove, clear, total }),
    [items, add, remove, clear, total],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
