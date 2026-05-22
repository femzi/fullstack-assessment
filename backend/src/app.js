const express = require("express");
const cors = require("cors");

const productsRoutes = require("./routes/productsRoutes");
const ordersRoutes = require("./routes/ordersRoutes");
const paymentsRoutes = require("./routes/paymentsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { FRONTEND_ORIGIN } = require("./config/env");

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

module.exports = app;
