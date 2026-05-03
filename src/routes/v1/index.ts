import { Router } from "express";
import authRouter from "./auth.routes.js";
import usersRouter from "./users.routes.js";
import listingsRouter from "./listings.routes.js";
import bookingsRouter from "./bookings.routes.js";
import reviewsRouter from "./reviews.routes.js";
import aiRouter from "./ai.routes.js";
import { listingUploadRouter, userUploadRouter } from "./upload.routes.js";
import { getListingsStats, getUsersStats } from "../../controllers/v1/stats.controller.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/users", usersRouter);
v1Router.use("/users", userUploadRouter);       // POST /users/:id/avatar, DELETE /users/:id/avatar
v1Router.get("/users/stats", getUsersStats);
v1Router.use("/listings", listingsRouter);
v1Router.get("/listings/stats", getListingsStats);
v1Router.use("/listings", listingUploadRouter); // POST /listings/:id/photos, DELETE /listings/:id/photos/:photoId
v1Router.use("/bookings", bookingsRouter);
v1Router.use("/reviews", reviewsRouter);
v1Router.use("/ai", aiRouter);

export default v1Router;
