import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { connectDB } from "./config/prisma";
import { setupSwagger } from "./config/swagger";
import morgan from "morgan";
import v1Router from "./routes/v1/index.js";

const app = express();
const PORT = process.env["PORT"] ?? 3333;

// Middleware
app.use(express.json());

// Swagger docs
setupSwagger(app);

app.get("/health", (_: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date() });
});

// dev format in development, combined format in production
app.use(process.env["NODE_ENV"] === "production" ? morgan("combined") : morgan("dev"));

// Routes
app.use("/api/v1", v1Router);

// 404 catch-all for unknown routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found." });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);  // log full error server-side
  res.status(500).json({ error: "Something went wrong" });  // generic message to client
});


// Start server only after DB is connected
const main = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
};

main().catch((err: unknown) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
