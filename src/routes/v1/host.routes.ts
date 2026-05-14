import { Router } from "express";
import { authenticate, requireHost } from "../../middlewares/auth.middleware";
import {
  getHostListings,
  getHostBookings,
  getHostAnalytics,
} from "../../controllers/v1/host.controller";

const router = Router();

// All host routes require authentication + HOST (or ADMIN) role
router.use(authenticate, requireHost);

/**
 * @swagger
 * /api/v1/host/listings:
 *   get:
 *     summary: Get all listings owned by the authenticated host
 *     tags: [Host]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of host's listings
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — host role required
 */
router.get("/listings", getHostListings);

/**
 * @swagger
 * /api/v1/host/bookings:
 *   get:
 *     summary: Get all bookings for the authenticated host's listings
 *     tags: [Host]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, CANCELLED]
 *     responses:
 *       200:
 *         description: Paginated list of bookings on host's listings
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — host role required
 */
router.get("/bookings", getHostBookings);

/**
 * @swagger
 * /api/v1/host/analytics:
 *   get:
 *     summary: Get analytics dashboard data for the authenticated host
 *     tags: [Host]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregated earnings, booking counts, and monthly trend data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — host role required
 */
router.get("/analytics", getHostAnalytics);

export default router;
