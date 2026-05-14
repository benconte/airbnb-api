import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { Prisma, ListingType } from "../../../generated/prisma/client";
import prisma from "../../config/prisma";
import { getCache, setCache, clearCachePrefix } from "../../config/cache";
import { sendEmail } from "../../config/email";
import { listingApprovedEmail, listingRejectedEmail } from "../../templates/emails";

// ── Home page featured sections ──────────────────────────────────────────────

export interface FeaturedSection {
  title: string;
  subtitle?: string;
  listings: FeaturedListing[];
}

export interface FeaturedListing {
  id: string;
  title: string;
  location: string;
  pricePerNight: number;
  rating: number | null;
  photos: { url: string }[];
  guestFavorite: boolean;
}

/** GET /api/v1/listings/featured
 *  Returns up to `sections` location-based carousels, each with `perSection`
 *  top-rated listings. Sections are built from the most-populated distinct
 *  locations found in the database.
 */
export const getFeaturedListings = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `listings_featured_${req.originalUrl}`;
    const cached = getCache(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const maxSections = Math.max(1, parseInt((req.query.sections as string) ?? "10", 10) || 10);
    const perSection = Math.max(1, parseInt((req.query.perSection as string) ?? "20", 10) || 20);

    // Discover the most-populated locations.
    const locationGroups = await prisma.listing.groupBy({
      by: ["location"],
      _count: { location: true },
      orderBy: { _count: { location: "desc" } },
      take: maxSections,
    });

    if (locationGroups.length === 0) {
      res.json({ sections: [] });
      return;
    }

    // Fetch top-rated listings for each location in parallel.
    const sectionPromises = locationGroups.map(async (group) => {
      const location = group.location;

      const listings = await prisma.listing.findMany({
        where: {
          location: {
            contains: location,
            mode: "insensitive"
          },
          isApproved: true
        },
        orderBy: [
          { rating: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        take: perSection,
        select: {
          id: true,
          title: true,
          location: true,
          pricePerNight: true,
          rating: true,
          photos: { select: { url: true }, take: 1 },
        },
      });

      const mapped: FeaturedListing[] = listings.map((l) => ({
        ...l,
        guestFavorite: l.rating !== null && l.rating >= 4.8,
      }));

      // Build a human-readable section title from the stored location string.
      const cityName = location.split(",")[0].trim();

      const section: FeaturedSection = {
        title: `Places to stay in ${cityName}`,
        listings: mapped,
      };

      return section;
    });

    const sections = await Promise.all(sectionPromises);
    const filtered = sections.filter((s) => s.listings.length > 0);

    const responseData = { sections: filtered };
    setCache(cacheKey, responseData, 120); // 2 minutes

    res.json(responseData);
  } catch (err) {
    handleError(err, res, "getFeaturedListings");
  }
};

export const getAllListings = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `listings_${req.originalUrl}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    const { location, type, maxPrice, sortBy, order } = req.query as Record<string, string>;

    // Pagination
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "10", 10) || 10);
    const skip = (page - 1) * limit;

    const where: Prisma.ListingWhereInput = {};

    const searchStr = req.query.search as string || location;
    if (searchStr) {
      where.OR = [
        { title: { contains: searchStr, mode: "insensitive" } },
        { location: { contains: searchStr, mode: "insensitive" } },
      ];
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

    where.isApproved = true;
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
        amenities: true,
        description: true,
        reviews: true,
        hostId: true,
        _count: {
          select: {
            reviews: true,
          },
        },
        guests: true,
        rating: true,
        createdAt: true,
        photos: {
          select: { url: true }
        },
        host: {
          select: { name: true, avatar: true },
        },
      },
    });

    const total = await prisma.listing.count({ where });

    const responseData = {
      data: listings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    setCache(cacheKey, responseData, 60);

    res.json(responseData);
  } catch (err) {
    handleError(err, res, "getAllListings");
  }
};

export const getListingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const listing = await prisma.listing.findUnique({
      where: { id, isApproved: true },
      include: {
        host: true,
        bookings: true,
        photos: true,
        pricings: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
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

export const searchListings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { location, type, minPrice, maxPrice, guests } = req.query as Record<string, string>;

    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "10", 10) || 10);
    const skip = (page - 1) * limit;

    const where: Prisma.ListingWhereInput = {};

    const searchStr = req.query.search as string || location;
    if (searchStr) {
      where.OR = [
        { title: { contains: searchStr, mode: "insensitive" } },
        { location: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    if (type && Object.values(ListingType).includes(type as ListingType)) {
      where.type = type as ListingType;
    }

    if (minPrice || maxPrice) {
      where.pricePerNight = {};
      const parsedMin = parseFloat(minPrice);
      const parsedMax = parseFloat(maxPrice);
      if (!isNaN(parsedMin)) where.pricePerNight.gte = parsedMin;
      if (!isNaN(parsedMax)) where.pricePerNight.lte = parsedMax;
    }

    if (guests) {
      const parsedGuests = parseInt(guests, 10);
      if (!isNaN(parsedGuests)) where.guests = { gte: parsedGuests };
    }
    where.isApproved = true;

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        skip,
        take: limit,
        include: {
          host: { select: { name: true, email: true } },
          photos: { select: { url: true } },
        },
      }),
      prisma.listing.count({ where }),
    ]);

    res.json({
      data: listings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleError(err, res, "searchListings");
  }
};

export const createListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, location, pricePerNight, guests, type, amenities } =
      req.body as {
        title?: string;
        description?: string;
        location?: string;
        pricePerNight?: number;
        guests?: number;
        type?: ListingType;
        amenities?: string[];
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
      },
    });

    clearCachePrefix("listings_");
    clearCachePrefix("stats_");

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

    clearCachePrefix("listings_");
    clearCachePrefix("stats_");

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

    clearCachePrefix("listings_");
    clearCachePrefix("stats_");

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


/**
 * PATCH /api/v1/admin/listings/:id/approve
 * Admin-only. Marks a listing as approved and notifies the host.
 */
export const approveListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { host: { select: { id: true, name: true, email: true } } },
    });

    if (!listing) {
      res.status(404).json({ message: `Listing with id ${id} not found.` });
      return;
    }

    if (listing.isApproved) {
      res.status(400).json({ message: "Listing is already approved." });
      return;
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: { isApproved: true },
    });

    clearCachePrefix("listings_");
    clearCachePrefix("stats_");

    // Fire-and-forget email — don't block the response
    sendEmail(
      listing.host.email,
      `Your listing "${listing.title}" has been approved!`,
      listingApprovedEmail(listing.host.name, listing.title)
    ).catch((err) => console.error("[approveListing] Email failed:", err));

    res.json({ message: "Listing approved successfully.", listing: updated });
  } catch (err) {
    handleError(err, res, "approveListing");
  }
};

/**
 * PATCH /api/v1/admin/listings/:id/reject
 * Admin-only. Marks a listing as not approved (or keeps it unapproved),
 * and emails the host with the provided reason.
 *
 * Body: { reason: string }
 */
export const rejectListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };

    if (!reason || reason.trim() === "") {
      res.status(400).json({ message: "A rejection reason is required." });
      return;
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { host: { select: { id: true, name: true, email: true } } },
    });

    if (!listing) {
      res.status(404).json({ message: `Listing with id ${id} not found.` });
      return;
    }

    // Reset approval (handles re-rejection of previously approved listings too)
    const updated = await prisma.listing.update({
      where: { id },
      data: { isApproved: false },
    });

    clearCachePrefix("listings_");
    clearCachePrefix("stats_");

    sendEmail(
      listing.host.email,
      `Update on your listing "${listing.title}"`,
      listingRejectedEmail(listing.host.name, listing.title, reason.trim())
    ).catch((err) => console.error("[rejectListing] Email failed:", err));

    res.json({ message: "Listing rejected. Host has been notified.", listing: updated });
  } catch (err) {
    handleError(err, res, "rejectListing");
  }
};

/**
 * GET /api/v1/admin/listings/pending
 * Admin-only. Returns all listings pending approval, with pagination.
 */
export const getPendingListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "20", 10) || 20);
    const skip = (page - 1) * limit;

    const [listings, total, totalApproved] = await Promise.all([
      prisma.listing.findMany({
        where: { isApproved: false },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          host: { select: { id: true, name: true, email: true, avatar: true } },
          photos: { select: { url: true } },
          _count: { select: { bookings: true, reviews: true } },
        },
      }),
      prisma.listing.count({ where: { isApproved: false } }),
      prisma.listing.count({ where: { isApproved: true } }),
      // "rejected" = isApproved: false AND older than 5 minutes (heuristic for explicitly rejected)
      // In a real system you'd add a `status` enum. For now we return all unapproved.
      prisma.listing.count({ where: { isApproved: false } }),
    ]);

    res.json({
      data: listings,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        stats: {
          pending: total,
          approved: totalApproved,
          total: total + totalApproved,
        },
      },
    });
  } catch (err) {
    handleError(err, res, "getPendingListings");
  }
};