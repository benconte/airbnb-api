import { Router } from "express";
import {
  getAllBookings,
  getBookingById,
  createBooking,
  deleteBooking,
  updateBookingStatus,
} from "../controllers/bookings.controller";
import { authenticate, requireGuest } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", getAllBookings);
router.get("/:id", getBookingById);
router.post("/", authenticate, requireGuest, createBooking);
router.patch("/:id/status", authenticate, updateBookingStatus);
router.delete("/:id", authenticate, deleteBooking);

export default router;
