import { Router } from "express";
import {
  getAllDisputes,
  getDisputeById,
  createDispute,
  updateDisputeStatus,
  deleteDispute,
} from "../../controllers/v1/disputes.controller";
import { authenticate, requireAdmin } from "../../middlewares/auth.middleware";

const router = Router();

// GET /api/v1/disputes — admin: list all disputes with pagination & filters
router.get("/", authenticate, requireAdmin, getAllDisputes);

// GET /api/v1/disputes/:id — admin: get one dispute
router.get("/:id", authenticate, requireAdmin, getDisputeById);

// POST /api/v1/disputes — authenticated user: file a dispute
router.post("/", authenticate, createDispute);

// PATCH /api/v1/disputes/:id/status — admin: update status & resolution
router.patch("/:id/status", authenticate, requireAdmin, updateDisputeStatus);

// DELETE /api/v1/disputes/:id — admin: remove dispute record
router.delete("/:id", authenticate, requireAdmin, deleteDispute);

export default router;
