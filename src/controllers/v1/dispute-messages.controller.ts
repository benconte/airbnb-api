import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { Prisma } from "../../../generated/prisma/client";
import prisma from "../../config/prisma";
import { uploadToCloudinary, deleteFromCloudinary } from "../../config/cloudinary";

// ── helpers ─────────────────────────────────────────────────────────────────

function handleError(err: unknown, res: Response, op: string): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    res.status(404).json({ message: "Record not found." });
    return;
  }
  console.error(`[${op}]`, err);
  res.status(500).json({ message: "Something went wrong." });
}

/** Verify the caller is the reporter, the opposing party, or an admin. */
async function canAccessDispute(disputeId: string, userId: string, role: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      booking: { include: { listing: { select: { hostId: true } } } },
    },
  });
  if (!dispute) return null;

  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const isReporter = dispute.reporterId === userId;
  const isHost = dispute.booking.listing.hostId === userId;
  const isGuest = dispute.booking.guestId === userId;

  if (!isAdmin && !isReporter && !isHost && !isGuest) return null;
  return dispute;
}

// ── GET /disputes/:id/messages ────────────────────────────────────────────────
export const getDisputeMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.userId!;
    const role = req.role!;

    const dispute = await canAccessDispute(id, userId, role);
    if (!dispute) {
      res.status(403).json({ message: "Access denied or dispute not found." });
      return;
    }

    const messages = await prisma.disputeMessage.findMany({
      where: { disputeId: id },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, email: true, avatar: true, role: true } },
      },
    });

    res.json({ data: messages, disputeId: id });
  } catch (err) {
    handleError(err, res, "getDisputeMessages");
  }
};

// ── POST /disputes/:id/messages ───────────────────────────────────────────────
// Body: { body?: string }  +  multipart files field "images" (max 5)
export const createDisputeMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.userId!;
    const role = req.role!;

    const dispute = await canAccessDispute(id, userId, role);
    if (!dispute) {
      res.status(403).json({ message: "Access denied or dispute not found." });
      return;
    }

    // Don't allow new messages on closed disputes
    if (dispute.status === "RESOLVED" || dispute.status === "DISMISSED") {
      res.status(400).json({ message: "Cannot add messages to a resolved or dismissed dispute." });
      return;
    }

    const { body } = req.body as { body?: string };
    const files = req.files as Express.Multer.File[] | undefined;

    if (!body?.trim() && (!files || files.length === 0)) {
      res.status(400).json({ message: "Message must contain text or at least one image." });
      return;
    }

    // Upload images to Cloudinary
    const imageUrls: string[] = [];
    const publicIds: string[] = [];

    if (files && files.length > 0) {
      const sliced = files.slice(0, 5);
      for (const file of sliced) {
        const { url, publicId } = await uploadToCloudinary(file.buffer, "airbnb/dispute-evidence");
        imageUrls.push(url);
        publicIds.push(publicId);
      }
    }

    const message = await prisma.disputeMessage.create({
      data: {
        body: body?.trim() || null,
        imageUrls,
        publicIds,
        disputeId: id,
        senderId: userId,
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatar: true, role: true } },
      },
    });

    res.status(201).json(message);
  } catch (err) {
    handleError(err, res, "createDisputeMessage");
  }
};

// ── DELETE /disputes/:id/messages/:msgId ─────────────────────────────────────
// Only the sender or an admin can delete a message
export const deleteDisputeMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, msgId } = req.params as { id: string; msgId: string };
    const userId = req.userId!;
    const role = req.role!;

    const msg = await prisma.disputeMessage.findUnique({
      where: { id: msgId },
      select: { id: true, disputeId: true, senderId: true, publicIds: true },
    });

    if (!msg || msg.disputeId !== id) {
      res.status(404).json({ message: "Message not found." });
      return;
    }

    if (msg.senderId !== userId && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      res.status(403).json({ message: "You can only delete your own messages." });
      return;
    }

    // Clean up Cloudinary assets
    for (const pid of msg.publicIds) {
      await deleteFromCloudinary(pid).catch((e) =>
        console.warn("[deleteDisputeMessage] Cloudinary delete failed:", e)
      );
    }

    await prisma.disputeMessage.delete({ where: { id: msgId } });
    res.json({ message: "Message deleted." });
  } catch (err) {
    handleError(err, res, "deleteDisputeMessage");
  }
};
