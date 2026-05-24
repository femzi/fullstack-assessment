import * as ordersRepository from "../repositories/ordersRepository";
import * as productsRepository from "../repositories/productsRepository";
import * as paymentsRepository from "../repositories/paymentsRepository";
import * as paymentGateway from "./paymentGateway";
import redis from "../db/redis";
import db from "../db/postgres";

const makeError = (message: string, status: number): any =>
  Object.assign(new Error(message), { status });

async function withTransaction(callback: (client: any) => Promise<any>) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function createOrder({ customerId, items, totalAmount }: any) {
  if (!customerId || !Array.isArray(items) || items.length === 0) {
    throw makeError("customerId and items are required", 400);
  }

  return withTransaction(async (client) => {
    const enrichedItems: any[] = [];

    for (const item of items) {
      const product = await productsRepository.getProductByIdForUpdate(
        item.productId,
        client,
      );
      if (!product) {
        throw makeError(`Product ${item.productId} not found`, 404);
      }
      if (product.stock < item.quantity) {
        throw makeError(`Insufficient stock for ${product.name}`, 409);
      }
      enrichedItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: Number(product.price),
        name: product.name,
      });
    }

    for (const item of enrichedItems) {
      await productsRepository.decrementStock(
        item.productId,
        item.quantity,
        client,
      );
    }

    const calculatedTotal = enrichedItems.reduce(
      (sum: number, item: any) => sum + item.unitPrice * item.quantity,
      0,
    );

    const order = await ordersRepository.createOrder(
      {
        customerId,
        totalAmount: calculatedTotal,
        items: enrichedItems,
      },
      client,
    );

    return order;
  });
}

async function chargeOrder({ orderId, idempotencyKey }: any) {
  if (idempotencyKey) {
    const cached = await redis.get(`idem:${idempotencyKey}`);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  return withTransaction(async (client) => {
    const order = await ordersRepository.getOrderByIdForUpdate(orderId, client);
    if (!order) {
      throw makeError("Order not found", 404);
    }

    if (order.status !== "PENDING") {
      throw makeError("Only pending orders can be charged", 409);
    }

    const gatewayResponse = await paymentGateway.charge({
      orderId: order.id,
      amount: order.totalAmount,
    });

    const payment = await paymentsRepository.createPayment(
      {
        orderId: order.id,
        amount: gatewayResponse.chargedAmount,
        providerTxnId: gatewayResponse.providerTxnId,
        status: "SUCCESS",
        idempotencyKey,
      },
      client,
    );

    const updatedOrder = await ordersRepository.markOrderAsPaid(
      order.id,
      client,
    );

    const result = { order: updatedOrder, payment };

    if (idempotencyKey) {
      await redis.set(
        `idem:${idempotencyKey}`,
        JSON.stringify(result),
        "EX",
        3600,
      );
    }

    return result;
  });
}

async function processPaymentWebhook({ providerEventId, orderId, eventType, payload }: any) {
  return withTransaction(async (client) => {
    const event = await paymentsRepository.createWebhookEvent(
      {
        providerEventId,
        orderId,
        eventType,
        payload,
      },
      client,
    );

    if (!event) {
      return { accepted: true, duplicate: true };
    }

    if (eventType === "payment_succeeded") {
      await ordersRepository.markOrderAsPaid(orderId, client);
    }

    return { accepted: true };
  });
}

async function getOrderById(orderId: any) {
  const order = await ordersRepository.getOrderWithDetails(orderId);
  if (!order) {
    throw makeError("Order not found", 404);
  }
  return order;
}

async function listOrders(params: any) {
  return ordersRepository.listOrders(params);
}

export {
  createOrder,
  chargeOrder,
  processPaymentWebhook,
  getOrderById,
  listOrders,
};
