import "dotenv/config";

export const PORT = process.env.PORT || 3000;
export const DATABASE_URL = process.env.DATABASE_URL;
export const REDIS_URL = process.env.REDIS_URL;
export const PAYMENT_FAILURE_RATE = Number(process.env.PAYMENT_FAILURE_RATE || 0.1);
export const PAYMENT_DELAY_MIN_MS = Number(process.env.PAYMENT_DELAY_MIN_MS || 50);
export const PAYMENT_DELAY_MAX_MS = Number(process.env.PAYMENT_DELAY_MAX_MS || 600);
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me";
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "replace-me";
