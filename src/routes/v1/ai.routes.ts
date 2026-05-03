import { Router } from "express";
import {
  naturalLanguageSearch,
  generateListingDescription,
  chat,
} from "../../controllers/v1/ai.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /ai/search:
 *   post:
 *     summary: Search listings using natural language
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 example: "cozy apartment in New York for 2 people under $150"
 *     responses:
 *       200:
 *         description: Listings matching the natural language query
 */
router.post("/search", naturalLanguageSearch);

/**
 * @swagger
 * /ai/generate-description:
 *   post:
 *     summary: Generate a listing description using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, location, type, guests, amenities, price]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Beachfront Villa"
 *               location:
 *                 type: string
 *                 example: "Miami, FL"
 *               type:
 *                 type: string
 *                 example: "VILLA"
 *               guests:
 *                 type: integer
 *                 example: 6
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Pool", "WiFi", "BBQ"]
 *               price:
 *                 type: number
 *                 example: 250
 *     responses:
 *       200:
 *         description: Generated listing description
 */
router.post("/generate-description", authenticate, generateListingDescription);

/**
 * @swagger
 * /ai/chat:
 *   post:
 *     summary: Chat with the Airbnb AI assistant
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message, sessionId]
 *             properties:
 *               message:
 *                 type: string
 *                 example: "What listings do you have in Miami?"
 *               sessionId:
 *                 type: string
 *                 example: "user-123-session-abc"
 *     responses:
 *       200:
 *         description: AI response
 */
router.post("/chat", chat);

export default router;
