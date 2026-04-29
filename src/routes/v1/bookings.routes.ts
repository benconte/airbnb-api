import { Router } from "express";
import {
  getAllBookings,
  getBookingById,
  createBooking,
  deleteBooking,
  updateBookingStatus,
} from "../../controllers/v1/bookings.controller";
import { authenticate, requireGuest } from "../../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 1
 *         checkIn:
 *           type: string
 *           format: date-time
 *           example: "2024-06-01T00:00:00.000Z"
 *         checkOut:
 *           type: string
 *           format: date-time
 *           example: "2024-06-07T00:00:00.000Z"
 *         totalPrice:
 *           type: number
 *           example: 840.00
 *         status:
 *           type: string
 *           enum: [PENDING, CONFIRMED, CANCELLED]
 *           example: CONFIRMED
 *         guestId:
 *           type: string
 *           example: 2
 *         listingId:
 *           type: string
 *           example: 1
 *         guest:
 *           $ref: '#/components/schemas/User'
 *         listing:
 *           $ref: '#/components/schemas/Listing'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-05-20T14:00:00.000Z"
 *     CreateBookingInput:
 *       type: object
 *       required:
 *         - listingId
 *         - checkIn
 *         - checkOut
 *       properties:
 *         listingId:
 *           type: string
 *           example: 1
 *         checkIn:
 *           type: string
 *           format: date-time
 *           example: "2024-06-01T00:00:00.000Z"
 *         checkOut:
 *           type: string
 *           format: date-time
 *           example: "2024-06-07T00:00:00.000Z"
 */

/**
 * @swagger
 * /api/v1/bookings:
 *   get:
 *     summary: Get all bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of bookings per page
 *     responses:
 *       200:
 *         description: List of bookings with guest and listing info
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", getAllBookings);

/**
 * @swagger
 * /api/v1/bookings/{id}:
 *   get:
 *     summary: Get a booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking with guest and listing details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", getBookingById);

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     description: The total price is auto-calculated from `pricePerNight × nights`. The guest ID is derived from the authenticated user's token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBookingInput'
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Missing fields or invalid dates
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Listing not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authenticate, requireGuest, createBooking);

/**
 * @swagger
 * /api/v1/bookings/{id}/status:
 *   patch:
 *     summary: Update booking status
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, CONFIRMED, CANCELLED]
 *                 example: CONFIRMED
 *     responses:
 *       200:
 *         description: Booking status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Invalid status value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/:id/status", authenticate, updateBookingStatus);

/**
 * @swagger
 * /api/v1/bookings/{id}:
 *   delete:
 *     summary: Cancel a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:id", authenticate, deleteBooking);

export default router;
