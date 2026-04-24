import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserListings,
  getUserBookings,
} from "../controllers/users.controller";

const router = Router();

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

// Sub-resource routes
router.get("/:id/listings", getUserListings);
router.get("/:id/bookings", getUserBookings);

export default router;
