import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";

import env from "./config/env";
import logger from "./config/logger";
import routes from "./routes";
import {
  handleStripeWebhook,
  handleStripeWebhookDev,
} from "./modules/rent-payment/rent-payment.controller";
import { handleStripeBillingWebhook } from "./modules/billing/billing.controller";
import metricsRoutes from "./routes/metrics.route";
import healthRoutes from "./routes/health.route";
import devRoutes from "./routes/dev.route";
import { apiLimiter } from "./middlewares/rateLimiter";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { requestIdMiddleware } from "./middlewares/requestId.middleware";
import { metricsMiddleware } from "./middlewares/metrics.middleware";
import { requestLoggerMiddleware } from "./middlewares/requestLogger.middleware";

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://hooks.stripe.com",
        ],
        connectSrc: ["'self'", "https://api.stripe.com"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
);
const parseCorsOrigins = (originStr: string) => {
  if (originStr.includes(",")) {
    return originStr.split(",").map((o) => o.trim());
  }
  return originStr;
};

app.use(
  cors({
    origin: parseCorsOrigins(env.CORS_ORIGIN),
    credentials: true,
  }),
);
app.use(compression());

// Stripe rent webhook requires raw body (must be before express.json)
app.post(
  `/api/${env.API_VERSION}/webhooks/stripe`,
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

// Landlord SaaS billing webhook (separate secret from rent)
app.post(
  `/api/${env.API_VERSION}/webhooks/stripe-billing`,
  express.raw({ type: "application/json" }),
  handleStripeBillingWebhook,
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Dev Stripe webhook (no signature) — STRIPE_WEBHOOK_DEV_MODE=true only
app.post(
  `/api/${env.API_VERSION}/webhooks/stripe/dev-test`,
  handleStripeWebhookDev,
);

// Observability middleware — applied before all routes
app.use(requestIdMiddleware);
app.use(metricsMiddleware);
app.use(requestLoggerMiddleware);

app.use(
  "/uploads",
  (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(process.cwd(), "uploads")),
);
app.use(
  "/payment-tester",
  express.static(path.join(process.cwd(), "public/payment-tester")),
);

// Metrics and health — excluded from rate limiting
app.use("/metrics", metricsRoutes);
app.use(`/api/${env.API_VERSION}/health`, healthRoutes);
app.use(`/api/${env.API_VERSION}/dev`, devRoutes);

try {
  const swaggerDocument = YAML.load(
    path.join(process.cwd(), "docs/swagger.yaml"),
  );
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch {
  logger.warn("Swagger documentation not loaded");
}

app.use(`/api/${env.API_VERSION}`, apiLimiter, routes);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Welcome to B Aziz API",
    docs: "/api-docs",
    paymentTester: "/payment-tester/",
    health: `/api/${env.API_VERSION}/health`,
    metrics: "/metrics",
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
