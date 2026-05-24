import Redis from "ioredis";
import { REDIS_URL } from "../config/env";

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
});

redis.on("error", (err) => {
  console.error("Redis error", err.message);
});

export default redis;
