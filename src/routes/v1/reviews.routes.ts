import { Router } from "express";
import { deleteReview } from "../../controllers/v1/reviews.controller";
import { authenticate } from "../../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "review-123"
 *         rating:
 *           type: integer
 *           example: 5
 *         comment:
 *           type: string
 *           example: "Great place!"
 *         userId:
 *           type: string
 *           example: "user-123"
 *         listingId:
 *           type: string
 *           example: "listing-123"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00.000Z"
 */

/**
 * @swagger
 * /api/v1/reviews/{id}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Review not found
 */
router.delete("/:id", authenticate, deleteReview);

export default router;
