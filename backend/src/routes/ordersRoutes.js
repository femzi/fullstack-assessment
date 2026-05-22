const express = require("express");
const ordersService = require("../services/ordersService");
const requireAdmin = require("../middleware/requireAdmin");
const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { customerId, items, totalAmount } = req.body;
    const order = await ordersService.createOrder({
      customerId,
      items,
      totalAmount,
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const orders = await ordersService.listOrders({ limit, offset });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const order = await ordersService.getOrderById(req.params.id);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
