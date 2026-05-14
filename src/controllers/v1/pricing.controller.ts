import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { Prisma, PricingBadge } from "../../../generated/prisma/client";
import prisma from "../../config/prisma";
import { clearCachePrefix } from "../../config/cache";

// ── GET all pricings for a listing ───────────────────────────────────────────
export const getListingPricings = async (req: Request, res: Response): Promise<void> => {
  try {
    const listingId = req.params.id as string;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ message: "Listing not found." });
      return;
    }

    const pricings = await prisma.listingPricing.findMany({
      where: { listingId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    res.json(pricings);
  } catch (err) {
    handleError(err, res, "getListingPricings");
  }
};

// ── CREATE a pricing tier (host only) ────────────────────────────────────────
export const createListingPricing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const listingId = req.params.id as string;
    const { name, description, tags, price, badge, sortOrder } = req.body as {
      name?: string;
      description?: string;
      tags?: string[];
      price?: number;
      badge?: string;
      sortOrder?: number;
    };

    if (!name || price === undefined) {
      res.status(400).json({ message: "Missing required fields: name, price." });
      return;
    }

    // Verify listing ownership
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ message: "Listing not found." });
      return;
    }
    if (listing.hostId !== req.userId && req.role !== "ADMIN") {
      res.status(403).json({ message: "You can only manage pricings for your own listings." });
      return;
    }

    const parsedBadge =
      badge && Object.values(PricingBadge).includes(badge as PricingBadge)
        ? (badge as PricingBadge)
        : undefined;

    const pricing = await prisma.listingPricing.create({
      data: {
        listingId,
        name,
        description,
        tags: tags ?? [],
        price,
        badge: parsedBadge,
        sortOrder: sortOrder ?? 0,
      },
    });

    clearCachePrefix("listings_");
    res.status(201).json(pricing);
  } catch (err) {
    handleError(err, res, "createListingPricing");
  }
};

// ── UPDATE a pricing tier (host only) ────────────────────────────────────────
export const updateListingPricing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, pricingId } = req.params as { id: string; pricingId: string };

    const existing = await prisma.listingPricing.findUnique({
      where: { id: pricingId },
      include: { listing: { select: { hostId: true } } },
    });

    if (!existing || existing.listingId !== id) {
      res.status(404).json({ message: "Pricing tier not found." });
      return;
    }

    if (existing.listing.hostId !== req.userId && req.role !== "ADMIN") {
      res.status(403).json({ message: "You can only manage pricings for your own listings." });
      return;
    }

    const { name, description, tags, price, badge, sortOrder, isActive } = req.body as {
      name?: string;
      description?: string;
      tags?: string[];
      price?: number;
      badge?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    };

    const parsedBadge =
      badge === null
        ? null
        : badge && Object.values(PricingBadge).includes(badge as PricingBadge)
          ? (badge as PricingBadge)
          : undefined;

    const updated = await prisma.listingPricing.update({
      where: { id: pricingId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(tags !== undefined && { tags }),
        ...(price !== undefined && { price }),
        ...(parsedBadge !== undefined && { badge: parsedBadge }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    clearCachePrefix("listings_");
    res.json(updated);
  } catch (err) {
    handleError(err, res, "updateListingPricing");
  }
};

// ── DELETE a pricing tier (host only) ────────────────────────────────────────
export const deleteListingPricing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, pricingId } = req.params as { id: string; pricingId: string };

    const existing = await prisma.listingPricing.findUnique({
      where: { id: pricingId },
      include: { listing: { select: { hostId: true } } },
    });

    if (!existing || existing.listingId !== id) {
      res.status(404).json({ message: "Pricing tier not found." });
      return;
    }

    if (existing.listing.hostId !== req.userId && req.role !== "ADMIN") {
      res.status(403).json({ message: "You can only manage pricings for your own listings." });
      return;
    }

    await prisma.listingPricing.delete({ where: { id: pricingId } });

    clearCachePrefix("listings_");
    res.json({ message: "Pricing tier deleted successfully." });
  } catch (err) {
    handleError(err, res, "deleteListingPricing");
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
