import express from "express";
import * as ordersService from "../services/ordersService";
import { WEBHOOK_SECRET } from "../config/env";

const router = express.Router();

router.post("/charge", async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const idempotencyKey = req.header("Idempotency-Key");
    const result = await ordersService.chargeOrder({ orderId, idempotencyKey });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/webhook", async (req, res, next) => {
  try {
    const signature = req.header("X-Webhook-Secret");
    if (!signature || signature !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const { providerEventId, orderId, eventType, payload } = req.body;
    const result = await ordersService.processPaymentWebhook({
      providerEventId,
      orderId,
      eventType,
      payload,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
