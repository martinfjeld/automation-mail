import rateLimit from "express-rate-limit";

export const setupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: "Too many setup attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const generateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 generation requests per hour
  message: "Too many generation requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
