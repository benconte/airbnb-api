import { Router } from "express";
import {
  getAllDisputes,
  getMyDisputes,
  getDisputeById,
  createDispute,
  updateDisputeStatus,
  deleteDispute,
  escalateDispute,
} from "../../controllers/v1/disputes.controller";
import {
  getDisputeMessages,
  createDisputeMessage,
  deleteDisputeMessage,
} from "../../controllers/v1/dispute-messages.controller";
import { authenticate, requireAdmin } from "../../middlewares/auth.middleware";
import upload from "../../config/multer";

const router = Router();

// ── Dispute CRUD ──────────────────────────────────────────────────────────────

// GET /api/v1/disputes — admin: list all disputes with pagination & filters
router.get("/", authenticate, requireAdmin, getAllDisputes);

// GET /api/v1/disputes/me — authenticated user: list their own disputes
router.get("/me", authenticate, getMyDisputes);

// GET /api/v1/disputes/:id — admin or involved user: get one dispute
router.get("/:id", authenticate, getDisputeById);

// POST /api/v1/disputes — authenticated user: file a dispute (guest OR host)
router.post("/", authenticate, createDispute);

// PATCH /api/v1/disputes/:id/status — admin: update status & resolution
router.patch("/:id/status", authenticate, requireAdmin, updateDisputeStatus);

// PATCH /api/v1/disputes/:id/escalate — reporter only: escalate dispute to admin review
router.patch("/:id/escalate", authenticate, escalateDispute);

// DELETE /api/v1/disputes/:id — admin: remove dispute record
router.delete("/:id", authenticate, requireAdmin, deleteDispute);

// ── Dispute Messages (threaded chat with evidence images) ─────────────────────

// GET /api/v1/disputes/:id/messages — all involved parties + admin
router.get("/:id/messages", authenticate, getDisputeMessages);

// POST /api/v1/disputes/:id/messages — send message (text + up to 5 images)
router.post(
  "/:id/messages",
  authenticate,
  upload.array("images", 5),
  createDisputeMessage
);

// DELETE /api/v1/disputes/:id/messages/:msgId — sender or admin
router.delete("/:id/messages/:msgId", authenticate, deleteDisputeMessage);

export default router;
