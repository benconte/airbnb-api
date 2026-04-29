import "dotenv/config";
import express, { Request, Response } from "express";
import usersRouter from "./routes/v1/users.routes";
import listingsRouter from "./routes/v1/listings.routes";
import bookingsRouter from "./routes/v1/bookings.routes";
import authRouter from "./routes/v1/auth.routes";
import { userUploadRouter, listingUploadRouter } from "./routes/v1/upload.routes";
import { connectDB } from "./config/prisma";
import { setupSwagger } from "./config/swagger";

const app = express();
const PORT = process.env["PORT"] ?? 3333;

// Middleware
app.use(express.json());

// Swagger docs
setupSwagger(app);

// Routes
app.use("/v1/auth", authRouter);
app.use("/v1/users", usersRouter);
app.use("/v1/users", userUploadRouter);       // POST /users/:id/avatar, DELETE /users/:id/avatar
app.use("/v1/listings", listingsRouter);
app.use("/v1/listings", listingUploadRouter); // POST /listings/:id/photos, DELETE /listings/:id/photos/:photoId
app.use("/v1/bookings", bookingsRouter);

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
