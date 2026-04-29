import { Router } from "express";
import authRouter from "./auth.routes.js";
import usersRouter from "./users.routes.js";
import listingsRouter from "./listings.routes.js";
import bookingsRouter from "./bookings.routes.js";
import { listingUploadRouter, userUploadRouter } from "./upload.routes.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/users", usersRouter);
v1Router.use("/users", userUploadRouter);       // POST /users/:id/avatar, DELETE /users/:id/avatar
v1Router.use("/listings", listingsRouter);
v1Router.use("/listings", listingUploadRouter); // POST /listings/:id/photos, DELETE /listings/:id/photos/:photoId
v1Router.use("/bookings", bookingsRouter);

export default v1Router;
