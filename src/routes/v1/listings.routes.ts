import { Router } from "express";
import {
  getAllListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  searchListings,
  getFeaturedListings,
  getPendingListings,
  approveListing,
  rejectListing,
  trackListingView,
} from "../../controllers/v1/listings.controller";
import { authenticate, requireAdmin, requireHost } from "../../middlewares/auth.middleware";
import { getListingReviews, createReview } from "../../controllers/v1/reviews.controller";
import { getListingsStats } from "../../controllers/v1/stats.controller";
import {
  getListingPricings,
  createListingPricing,
  updateListingPricing,
  deleteListingPricing,
} from "../../controllers/v1/pricing.controller";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Listing:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 1
 *         title:
 *           type: string
 *           example: "Cozy Downtown Apartment"
 *         description:
 *           type: string
 *           example: "A beautiful apartment in the heart of the city."
 *         location:
 *           type: string
 *           example: "New York, USA"
 *         pricePerNight:
 *           type: number
 *           example: 120.00
 *         guests:
 *           type: integer
 *           example: 4
 *         type:
 *           type: string
 *           enum: [APARTMENT, HOUSE, VILLA, CABIN]
 *           example: APARTMENT
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *           example: ["WiFi", "Kitchen", "Air conditioning"]
 *         rating:
 *           type: number
 *           nullable: true
 *           example: 4.5
 *         hostId:
 *           type: string
 *           example: 1
 *         host:
 *           $ref: '#/components/schemas/User'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00.000Z"
 *     CreateListingInput:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - location
 *         - pricePerNight
 *         - guests
 *         - type
 *         - amenities
 *       properties:
 *         title:
 *           type: string
 *           example: "Cozy Downtown Apartment"
 *         description:
 *           type: string
 *           example: "A beautiful apartment in the heart of the city."
 *         location:
 *           type: string
 *           example: "New York, USA"
 *         pricePerNight:
 *           type: number
 *           example: 120.00
 *         guests:
 *           type: integer
 *           example: 4
 *         type:
 *           type: string
 *           enum: [APARTMENT, HOUSE, VILLA, CABIN]
 *           example: APARTMENT
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *           example: ["WiFi", "Kitchen", "Air conditioning"]
 */

/**
 * @swagger
 * /api/v1/listings/search:
 *   get:
 *     summary: Search and filter listings
 *     tags: [Listings]
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
 *         description: Number of listings per page
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location (case-insensitive partial match)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [APARTMENT, HOUSE, VILLA, CABIN]
 *         description: Filter by listing type
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price per night
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price per night
 *       - in: query
 *         name: guests
 *         schema:
 *           type: integer
 *         description: Minimum number of guests the listing can accommodate
 *     responses:
 *       200:
 *         description: Paginated list of listings matching the criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Listing'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get("/search", searchListings);

/**
 * @swagger
 * /api/v1/listings/featured:
 *   get:
 *     summary: Get featured listings grouped by top locations (for the home page)
 *     tags: [Listings]
 *     parameters:
 *       - in: query
 *         name: sections
 *         schema:
 *           type: integer
 *           default: 3
 *         description: Number of location sections to return
 *       - in: query
 *         name: perSection
 *         schema:
 *           type: integer
 *           default: 8
 *         description: Number of listings per section
 *     responses:
 *       200:
 *         description: Featured listing sections for the home page
 */
router.get("/featured", getFeaturedListings);

/**
 * @swagger
 * /api/v1/listings/stats:
 *   get:
 *     summary: Get listings statistics
 *     tags: [Listings]
 *     responses:
 *       200:
 *         description: Listings statistics including total listings, average price, and counts by location and type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalListings:
 *                   type: integer
 *                   example: 120
 *                 averagePrice:
 *                   type: number
 *                   example: 145.5
 *                 byLocation:
 *                   type: array
 *                   items:
 *                     type: object
 *                 byType:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get("/stats", getListingsStats);

/**
 * @swagger
 * /api/v1/listings/{id}/reviews:
 *   get:
 *     summary: Get all reviews for a listing
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID
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
 *         description: Number of reviews per page
 *     responses:
 *       200:
 *         description: Paginated list of reviews for the listing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Review'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       404:
 *         description: Listing not found
 */
router.get("/:id/reviews", getListingReviews);

/**
 * @swagger
 * /api/v1/listings/{id}/reviews:
 *   post:
 *     summary: Add a review to a listing
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *               - comment
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: "Amazing stay! Highly recommended."
 *     responses:
 *       201:
 *         description: Review created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       400:
 *         description: Missing or invalid fields (e.g., rating not between 1 and 5)
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Listing not found
 */
router.post("/:id/reviews", authenticate, createReview);

/**
 * @swagger
 * /api/v1/listings:
 *   get:
 *     summary: Get all listings
 *     tags: [Listings]
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
 *         description: Number of listings per page
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location (case-insensitive partial match)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [APARTMENT, HOUSE, VILLA, CABIN]
 *         description: Filter by listing type
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price per night
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price per night
 *       - in: query
 *         name: guests
 *         schema:
 *           type: integer
 *         description: Minimum number of guests the listing can accommodate
 *     responses:
 *       200:
 *         description: Paginated list of listings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Listing'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 50
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 */
router.get("/", getAllListings);

/**
 * @swagger
 * /api/v1/listings/{id}:
 *   get:
 *     summary: Get a listing by ID
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID
 *     responses:
 *       200:
 *         description: Listing with host details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Listing'
 *       404:
 *         description: Listing not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", getListingById);

/**
 * @swagger
 * /api/v1/listings:
 *   post:
 *     summary: Create a new listing
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateListingInput'
 *     responses:
 *       201:
 *         description: Listing created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Listing'
 *       400:
 *         description: Missing or invalid fields
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
 */
router.post("/", authenticate, requireHost, createListing);

/**
 * @swagger
 * /api/v1/listings/{id}:
 *   put:
 *     summary: Update a listing
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Updated Apartment Title"
 *               description:
 *                 type: string
 *                 example: "Updated description."
 *               location:
 *                 type: string
 *                 example: "Boston, USA"
 *               pricePerNight:
 *                 type: number
 *                 example: 150.00
 *               guests:
 *                 type: integer
 *                 example: 6
 *               type:
 *                 type: string
 *                 enum: [APARTMENT, HOUSE, VILLA, CABIN]
 *                 example: HOUSE
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["WiFi", "Parking"]
 *     responses:
 *       200:
 *         description: Listing updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Listing'
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
router.put("/:id", authenticate, updateListing);

/**
 * @swagger
 * /api/v1/listings/{id}:
 *   delete:
 *     summary: Delete a listing
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID
 *     responses:
 *       200:
 *         description: Listing deleted successfully
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
router.delete("/:id", authenticate, deleteListing);

// ── Listing Pricing Tiers ─────────────────────────────────────────────────────

/** GET /api/v1/listings/:id/pricings  — public */
router.get("/:id/pricings", getListingPricings);

/** POST /api/v1/listings/:id/pricings  — host only */
router.post("/:id/pricings", authenticate, requireHost, createListingPricing);

/** PATCH /api/v1/listings/:id/pricings/:pricingId  — host only */
router.patch("/:id/pricings/:pricingId", authenticate, requireHost, updateListingPricing);

/** DELETE /api/v1/listings/:id/pricings/:pricingId  — host only */
router.delete("/:id/pricings/:pricingId", authenticate, requireHost, deleteListingPricing);

// ── Listing View Tracking ─────────────────────────────────────────────────────

/**
 * POST /api/v1/listings/:id/view
 * Fire-and-forget: called whenever a guest/host opens the listing detail page.
 * No auth required; userId is inferred from token if present.
 */
router.post("/:id/view", trackListingView);

/**
 * @swagger
 * /api/v1/listings/admin/pending:
 *   get:
 *     summary: Get all listings pending admin approval
 *     tags: [Admin - Listings]
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
 *         description: Paginated list of pending listings with stats
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.get("/admin/pending", authenticate, requireAdmin, getPendingListings);

/**
 * @swagger
 * /api/v1/listings/{id}/approve:
 *   patch:
 *     summary: Approve a listing
 *     tags: [Admin - Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Listing approved, host notified via email
 *       400:
 *         description: Listing already approved
 *       404:
 *         description: Listing not found
 */
router.patch("/admin/:id/approve", authenticate, requireAdmin, approveListing);

/**
 * @swagger
 * /api/v1/listings/{id}/reject:
 *   patch:
 *     summary: Reject a listing with a reason
 *     tags: [Admin - Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Photos do not meet quality standards. Please upload clear, high-resolution images."
 *     responses:
 *       200:
 *         description: Listing rejected, host notified via email
 *       400:
 *         description: Rejection reason is required
 *       404:
 *         description: Listing not found
 */
router.patch("/admin/:id/reject", authenticate, requireAdmin, rejectListing);



export default router;
