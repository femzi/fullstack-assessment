import express from "express";
import cors from "cors";

import productsRoutes from "./routes/productsRoutes";
import ordersRoutes from "./routes/ordersRoutes";
import paymentsRoutes from "./routes/paymentsRoutes";
import adminRoutes from "./routes/adminRoutes";
import { FRONTEND_ORIGIN } from "./config/env";

const app = express();

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  }),
);
 
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/products", productsRoutes);
app.use("/orders", ordersRoutes);
app.use("/payments", paymentsRoutes);
app.use("/admin", adminRoutes);

app.use((error, req, res, next) => {
  console.error("Request failed", error.message);
  const status = error.status || 500;
  res.status(status).json({
    error: error.message || "Internal server error",
  });
});
export default app;