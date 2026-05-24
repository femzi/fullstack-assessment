import { Routes, Route, Link } from "react-router-dom";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import AdminPage from "./pages/AdminPage";
import { useCart } from "./state/CartContext";

export default function App() {
  const { items } = useCart();
  const cartCount = items.length ||`0`;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          Storefront
        </Link>
        <nav>
          <Link to="/cart">Cart ({cartCount})</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}
