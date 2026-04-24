import "dotenv/config";
import express, { Request, Response } from "express";
import usersRouter from "./routes/users.routes";
import listingsRouter from "./routes/listings.routes";
import bookingsRouter from "./routes/bookings.routes";
import { connectDB } from "./config/prisma";

const app = express();
const PORT = process.env["PORT"] ?? 3333;

// Middleware
app.use(express.json());

// Routes
app.use("/users", usersRouter);
app.use("/listings", listingsRouter);
app.use("/bookings", bookingsRouter);

// 404 catch-all for unknown routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found." });
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
