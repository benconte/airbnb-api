import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { Prisma, ListingType } from "../../../generated/prisma/client";
import prisma from "../../config/prisma";

export const getAllListings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { location, type, maxPrice, sortBy, order } = req.query as Record<string, string>;

    // Pagination
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "10", 10) || 10);
    const skip = (page - 1) * limit;

    const where: Prisma.ListingWhereInput = {};

    if (location) {
      where.location = { contains: location, mode: "insensitive" };
    }

    if (type && Object.values(ListingType).includes(type as ListingType)) {
      where.type = type as ListingType;
    }

    if (maxPrice) {
      const parsed = parseFloat(maxPrice);
      if (!isNaN(parsed)) where.pricePerNight = { lte: parsed };
    }

    const allowedSortFields = ["pricePerNight", "createdAt", "rating", "title"] as const;
    type SortField = (typeof allowedSortFields)[number];

    const sortField: SortField =
      allowedSortFields.includes(sortBy as SortField) ? (sortBy as SortField) : "createdAt";
    const sortOrder: "asc" | "desc" = order === "asc" ? "asc" : "desc";

    const listings = await prisma.listing.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortField]: sortOrder },
      select: {
        id: true,
        title: true,
        location: true,
        pricePerNight: true,
        type: true,
        guests: true,
        rating: true,
        createdAt: true,
        host: {
          select: { name: true, avatar: true },
        },
      },
    });

    const total = await prisma.listing.count({ where });

    res.json({
      data: listings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleError(err, res, "getAllListings");
  }
};

export const getListingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        host: true,
        bookings: true,
      },
    });

    if (!listing) {
      res.status(404).json({ message: `Listing with id ${id} not found.` });
      return;
    }

    res.json(listing);
  } catch (err) {
    handleError(err, res, "getListingById");
  }
};

export const createListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, location, pricePerNight, guests, type, amenities, rating } =
      req.body as {
        title?: string;
        description?: string;
        location?: string;
        pricePerNight?: number;
        guests?: number;
        type?: ListingType;
        amenities?: string[];
        rating?: number;
      };

    if (!title || !description || !location || !pricePerNight || !guests || !type || !amenities) {
      res.status(400).json({
        message:
          "Missing required fields: title, description, location, pricePerNight, guests, type, amenities.",
      });
      return;
    }

    const hostId = req.userId;
    if (!hostId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const host = await prisma.user.findFirst({ where: { id: hostId } });
    if (!host) {
      res.status(404).json({ message: `Host user with id ${hostId} not found.` });
      return;
    }

    const newListing = await prisma.listing.create({
      data: {
        title,
        description,
        location,
        pricePerNight,
        guests,
        type,
        amenities,
        hostId,
        ...(rating !== undefined && { rating }),
      },
    });

    res.status(201).json(newListing);
  } catch (err) {
    handleError(err, res, "createListing");
  }
};

export const updateListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.listing.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: `Listing with id ${id} not found.` });
      return;
    }

    if (existing.hostId !== req.userId && req.role !== "ADMIN") {
      res.status(403).json({ message: "You can only edit your own listings" });
      return;
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: req.body as Prisma.ListingUpdateInput,
    });

    res.json(updated);
  } catch (err) {
    handleError(err, res, "updateListing");
  }
};

export const deleteListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.listing.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: `Listing with id ${id} not found.` });
      return;
    }

    if (existing.hostId !== req.userId && req.role !== "ADMIN") {
      res.status(403).json({ message: "You can only delete your own listings" });
      return;
    }

    const deleted = await prisma.listing.delete({ where: { id } });
    res.json({ message: "Listing deleted successfully.", listing: deleted });
  } catch (err) {
    handleError(err, res, "deleteListing");
  }
};

function handleError(err: unknown, res: Response, operation: string): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[${operation}] Prisma error ${err.code}: ${err.message}`);

    if (err.code === "P2002") {
      res.status(409).json({ message: "Unique constraint violation." });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ message: "Record not found." });
      return;
    }
    if (err.code === "P2003") {
      res.status(400).json({ message: "Invalid foreign key — related record does not exist." });
      return;
    }
  }

  console.error(`[${operation}] Unexpected error:`, err);
  res.status(500).json({ message: "Something went wrong." });
}
