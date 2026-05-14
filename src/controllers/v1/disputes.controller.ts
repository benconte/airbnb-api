import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { Prisma, DisputeStatus, DisputeReason } from "../../../generated/prisma/client";
import prisma from "../../config/prisma";

// ── GET all disputes (admin) ──────────────────────────────────────────────────
export const getAllDisputes = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "10", 10) || 10);
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const reason = req.query.reason as string | undefined;

    const where: Prisma.DisputeWhereInput = {};
    if (status && Object.values(DisputeStatus).includes(status as DisputeStatus)) {
      where.status = status as DisputeStatus;
    }
    if (reason && Object.values(DisputeReason).includes(reason as DisputeReason)) {
      where.reason = reason as DisputeReason;
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reporter: { select: { id: true, name: true, email: true, avatar: true } },
          booking: {
            include: {
              listing: { select: { title: true, location: true } },
              guest: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.dispute.count({ where }),
    ]);

    res.json({
      data: disputes,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleError(err, res, "getAllDisputes");
  }
};

// ── GET dispute by ID ─────────────────────────────────────────────────────────
export const getDisputeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const disputeId = id as string;
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        reporter: { select: { id: true, name: true, email: true, avatar: true } },
        booking: {
          include: {
            listing: { select: { id: true, title: true, location: true } },
            guest: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!dispute) {
      res.status(404).json({ message: `Dispute with id ${id} not found.` });
      return;
    }

    res.json(dispute);
  } catch (err) {
    handleError(err, res, "getDisputeById");
  }
};

// ── CREATE dispute (authenticated user) ───────────────────────────────────────
export const createDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, reason, bookingId } = req.body as {
      title?: string;
      description?: string;
      reason?: string;
      bookingId?: string;
    };

    if (!title || !description || !bookingId) {
      res.status(400).json({ message: "Missing required fields: title, description, bookingId." });
      return;
    }

    const reporterId = req.userId;
    if (!reporterId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    // Verify the booking exists and belongs to the reporter (or admin)
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      res.status(404).json({ message: "Booking not found." });
      return;
    }

    if (booking.guestId !== reporterId && req.role !== "ADMIN") {
      res.status(403).json({ message: "You can only file disputes for your own bookings." });
      return;
    }

    const parsedReason = reason && Object.values(DisputeReason).includes(reason as DisputeReason)
      ? (reason as DisputeReason)
      : "OTHER" as DisputeReason;

    const dispute = await prisma.dispute.create({
      data: {
        title,
        description,
        reason: parsedReason,
        reporterId,
        bookingId,
      },
      include: {
        reporter: { select: { id: true, name: true, email: true, avatar: true } },
        booking: {
          include: {
            listing: { select: { title: true, location: true } },
          },
        },
      },
    });

    res.status(201).json(dispute);
  } catch (err) {
    handleError(err, res, "createDispute");
  }
};

// ── UPDATE dispute status / resolution (admin) ────────────────────────────────
export const updateDisputeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body as { status?: string; resolution?: string };

    if (!status || !Object.values(DisputeStatus).includes(status as DisputeStatus)) {
      res.status(400).json({
        message: `Invalid status. Must be one of: ${Object.values(DisputeStatus).join(", ")}.`,
      });
      return;
    }

    const disputeId = id as string;

    const existing = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!existing) {
      res.status(404).json({ message: `Dispute with id ${id} not found.` });
      return;
    }

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: status as DisputeStatus,
        ...(resolution !== undefined && { resolution }),
      },
      include: {
        reporter: { select: { id: true, name: true, email: true, avatar: true } },
        booking: {
          include: {
            listing: { select: { title: true, location: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    handleError(err, res, "updateDisputeStatus");
  }
};

// ── DELETE dispute (admin) ────────────────────────────────────────────────────
export const deleteDispute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const disputeId = id as string;
    const existing = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!existing) {
      res.status(404).json({ message: `Dispute with id ${id} not found.` });
      return;
    }

    await prisma.dispute.delete({ where: { id: disputeId } });
    res.json({ message: "Dispute deleted successfully." });
  } catch (err) {
    handleError(err, res, "deleteDispute");
  }
};

function handleError(err: unknown, res: Response, operation: string): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[${operation}] Prisma error ${err.code}: ${err.message}`);
    if (err.code === "P2025") {
      res.status(404).json({ message: "Record not found." });
      return;
    }
  }
  console.error(`[${operation}] Unexpected error:`, err);
  res.status(500).json({ message: "Something went wrong." });
}
