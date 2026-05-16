import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { Prisma, DisputeStatus, DisputeReason, Role } from "../../../generated/prisma/client";
import prisma from "../../config/prisma";

// ── GET all disputes (admin) ──────────────────────────────────────────────────
export const getAllDisputes = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "10", 10) || 10);
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const reason = req.query.reason as string | undefined;
    const againstRole = req.query.againstRole as string | undefined;

    const where: Prisma.DisputeWhereInput = {};
    if (status && Object.values(DisputeStatus).includes(status as DisputeStatus)) {
      where.status = status as DisputeStatus;
    }
    if (reason && Object.values(DisputeReason).includes(reason as DisputeReason)) {
      where.reason = reason as DisputeReason;
    }
    if (againstRole && Object.values(Role).includes(againstRole as Role)) {
      where.againstRole = againstRole as Role;
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reporter: { select: { id: true, name: true, email: true, avatar: true, role: true } },
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

// ── GET disputes for the authenticated user (as reporter OR involved party) ───
export const getMyDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "10", 10) || 10);
    const skip = (page - 1) * limit;

    const where: Prisma.DisputeWhereInput = {
      OR: [
        // Disputes I filed
        { reporterId: userId },
        // Disputes filed against me as a host
        { booking: { listing: { hostId: userId } } },
        // Disputes filed against me as a guest
        { booking: { guestId: userId } },
      ],
    };

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          booking: {
            include: {
              listing: { select: { id: true, title: true, location: true } },
              guest: { select: { id: true, name: true, email: true } },
            },
          },
          reporter: { select: { id: true, name: true, email: true, avatar: true, role: true } },
        },
      }),
      prisma.dispute.count({ where }),
    ]);

    res.json({
      data: disputes,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleError(err, res, "getMyDisputes");
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
        reporter: { select: { id: true, name: true, email: true, avatar: true, role: true } },
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

// ── CREATE dispute (authenticated user — guest OR host) ────────────────────────
export const createDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, reason, bookingId, againstRole } = req.body as {
      title?: string;
      description?: string;
      reason?: string;
      bookingId?: string;
      againstRole?: string;
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

    const reporter = await prisma.user.findUnique({ where: { id: reporterId } });
    if (!reporter) {
      res.status(404).json({ message: "Reporter not found." });
      return;
    }

    // Verify the booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { select: { hostId: true } } },
    });
    if (!booking) {
      res.status(404).json({ message: "Booking not found." });
      return;
    }

    // Guests can file disputes about their own bookings (against the host)
    // Hosts can file disputes about bookings on their listings (against the guest)
    const isGuest = booking.guestId === reporterId;
    const isHost = booking.listing.hostId === reporterId;
    const isAdmin = req.role === "ADMIN";

    if (!isGuest && !isHost && !isAdmin) {
      res.status(403).json({
        message: "You can only file disputes for bookings you are involved in.",
      });
      return;
    }

    // Determine the "againstRole" based on who is filing
    // Guests dispute against the HOST; hosts dispute against the GUEST
    let resolvedAgainstRole: Role = "HOST";
    if (againstRole && Object.values(Role).includes(againstRole as Role)) {
      resolvedAgainstRole = againstRole as Role;
    } else if (isHost) {
      resolvedAgainstRole = "GUEST";
    } else {
      resolvedAgainstRole = "HOST";
    }

    const parsedReason =
      reason && Object.values(DisputeReason).includes(reason as DisputeReason)
        ? (reason as DisputeReason)
        : ("OTHER" as DisputeReason);

    const dispute = await prisma.dispute.create({
      data: {
        title,
        description,
        reason: parsedReason,
        againstRole: resolvedAgainstRole,
        reporterId,
        bookingId,
      },
      include: {
        reporter: { select: { id: true, name: true, email: true, avatar: true, role: true } },
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
        reporter: { select: { id: true, name: true, email: true, avatar: true, role: true } },
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


// ── ESCALATE dispute to admin (reporter/guest only) ───────────────────────────
export const escalateDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.userId!;

    const dispute = await prisma.dispute.findUnique({
      where: { id },
    });

    if (!dispute) {
      res.status(404).json({ message: `Dispute with id ${id} not found.` });
      return;
    }

    if (dispute.reporterId !== userId) {
      res.status(403).json({ message: 'Only the reporter can escalate this dispute.' });
      return;
    }

    if (dispute.status !== 'OPEN') {
      res.status(400).json({
        message: `Cannot escalate a dispute with status "${dispute.status}". Only OPEN disputes can be escalated.`,
      });
      return;
    }

    const updated = await prisma.dispute.update({
      where: { id },
      data: { status: 'UNDER_REVIEW' },
      include: {
        reporter: { select: { id: true, name: true, email: true, avatar: true, role: true } },
        booking: {
          include: {
            listing: { select: { id: true, title: true, location: true } },
            guest: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    handleError(err, res, 'escalateDispute');
  }
};