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
import { authenticate, requireAdmin, requireGuest } from "../../middlewares/auth.middleware";

const router = Router();

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

// DELETE /api/v1/disputes/:id — admin: remove dispute record
router.delete("/:id", authenticate, requireAdmin, deleteDispute);

// PATCH /api/v1/disputes/:id/escalate — reporter/guest only: escalate dispute to admin review
router.patch('/:id/escalate', authenticate, escalateDispute);

export default router;
