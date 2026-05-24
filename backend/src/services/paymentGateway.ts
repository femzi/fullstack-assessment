import {
  PAYMENT_FAILURE_RATE,
  PAYMENT_DELAY_MIN_MS,
  PAYMENT_DELAY_MAX_MS,
} from "../config/env";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function charge({ orderId, amount }) {
  const wait = randomBetween(PAYMENT_DELAY_MIN_MS, PAYMENT_DELAY_MAX_MS);
  await delay(wait);

  if (Math.random() < PAYMENT_FAILURE_RATE) {
   throw Object.assign(new Error("Payment gateway declined"), { status: 502 });
  }

  return {
    providerTxnId: `txn_${orderId}_${Date.now()}_${Math.floor(
      Math.random() * 1e6,
    )}`,
    chargedAmount: amount,
  };
}

export { charge };
