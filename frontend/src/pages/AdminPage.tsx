import { useEffect, useState } from "react";
import { listOrdersAdmin, listProducts, updateProductAdmin } from "../api";
import type { Order, Product } from "../types";

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Record<number, Partial<Product>>>({});
  const [saveError, setSaveError] = useState<Record<number, string>>({});
  const [authorized, setAuthorized] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) return;
    listOrdersAdmin().then(setOrders);
    listProducts().then(setProducts);
  }, [authorized]);

  async function login() {
    if (!tokenInput.trim()) {
      setAuthError("Please enter a token");
      return;
    }

    const token = tokenInput.trim();
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

    try {
      const response = await fetch(`${apiUrl}/orders`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        sessionStorage.setItem("admin_token", token);
        setAuthorized(true);
        setAuthError(null);
      } else if (response.status === 401 || response.status === 403) {
        setAuthError("Wrong token, please try again");
      } else {
        setAuthError("Login failed");
      }
    } catch (err) {
      setAuthError("Login failed");
    }
  }

  function onChangeField(id: number, field: keyof Product, value: string) {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function save(p: Product) {
    const draft = editing[p.id] || {};
    setSaveError((prev) => ({ ...prev, [p.id]: "" }));
    try {
      const updated = await updateProductAdmin(p.id, {
        price: draft.price !== undefined ? Number(draft.price) : undefined,
        stock: draft.stock !== undefined ? Number(draft.stock) : undefined,
        description: draft.description as string | undefined,
        name: draft.name as string | undefined,
      });
      setProducts((current) =>
        current.map((it) => (it.id === p.id ? updated : it)),
      );
      setEditing((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
    } catch (err) {
      setSaveError((prev) => ({
        ...prev,
        [p.id]: err instanceof Error ? err.message : "Save failed",
      }));
    }
  }

  if (!authorized) {
    return (
      <div className="page">
        <h1>Admin Login</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "300px" }}>
          <input
            type="password"
            placeholder="Enter admin token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          <button className="primary" onClick={login}>
            Login
          </button>
          {authError && <p style={{ color: "red" }}>{authError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Admin</h1>

      <section>
        <h2>Orders</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.customerId}</td>
                <td>${o.totalAmount}</td>
                <td>{o.status}</td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Products</h2>
        <ul className="admin-products">
          {products.map((p) => (
            <li key={p.id} className="admin-product">
              <input
                type="text"
                defaultValue={p.name}
                onChange={(e) => onChangeField(p.id, "name", e.target.value)}
              />
              <input
                type="text"
                defaultValue={p.price}
                onChange={(e) => onChangeField(p.id, "price", e.target.value)}
              />
              <input
                type="text"
                defaultValue={String(p.stock)}
                onChange={(e) => onChangeField(p.id, "stock", e.target.value)}
              />
              <textarea
                defaultValue={p.description}
                onChange={(e) =>
                  onChangeField(p.id, "description", e.target.value)
                }
              />
              <button onClick={() => save(p)}>Save</button>
              {saveError[p.id] && (
                <p style={{ color: "red" }}>{saveError[p.id]}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}