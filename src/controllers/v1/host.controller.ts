import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { Prisma } from "../../../generated/prisma/client";
import prisma from "../../config/prisma";

/** GET /api/v1/host/listings — returns listings owned by the authenticated host */
export const getHostListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.userId;
    if (!hostId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "20", 10) || 20);
    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where: { hostId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          photos: { select: { id: true, url: true } },
          _count: { select: { bookings: true, reviews: true } },
        },
      }),
      prisma.listing.count({ where: { hostId } }),
    ]);

    res.json({
      data: listings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleError(err, res, "getHostListings");
  }
};

/** GET /api/v1/host/bookings — returns bookings on the host's listings */
export const getHostBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.userId;
    if (!hostId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "20", 10) || 20);
    const skip = (page - 1) * limit;

    const statusFilter = req.query.status as string | undefined;

    const where: Prisma.BookingWhereInput = {
      listing: { hostId },
      ...(statusFilter && { status: statusFilter as Prisma.EnumBookingStatusFilter }),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          guest: { select: { id: true, name: true, email: true, avatar: true } },
          listing: { select: { id: true, title: true, location: true, pricePerNight: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      data: bookings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleError(err, res, "getHostBookings");
  }
};

/** GET /api/v1/host/analytics — earnings + booking trend data for the host */
export const getHostAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.userId;
    if (!hostId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalListings,
      totalBookings,
      confirmedBookings,
      pendingBookings,
      cancelledBookings,
      monthlyEarningsAgg,
      allTimeEarningsAgg,
      recentBookings,
    ] = await Promise.all([
      prisma.listing.count({ where: { hostId } }),
      prisma.booking.count({ where: { listing: { hostId } } }),
      prisma.booking.count({ where: { listing: { hostId }, status: "CONFIRMED" } }),
      prisma.booking.count({ where: { listing: { hostId }, status: "PENDING" } }),
      prisma.booking.count({ where: { listing: { hostId }, status: "CANCELLED" } }),
      prisma.booking.aggregate({
        where: {
          listing: { hostId },
          status: "CONFIRMED",
          createdAt: { gte: startOfMonth },
        },
        _sum: { totalPrice: true },
      }),
      prisma.booking.aggregate({
        where: { listing: { hostId }, status: "CONFIRMED" },
        _sum: { totalPrice: true },
      }),
      prisma.booking.findMany({
        where: { listing: { hostId } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          guest: { select: { name: true, avatar: true } },
          listing: { select: { title: true } },
        },
      }),
    ]);

    // Build monthly earnings for the current year (last 12 months)
    const monthlyData: { month: string; earnings: number; bookings: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const start = new Date(now.getFullYear(), m, 1);
      const end = new Date(now.getFullYear(), m + 1, 0, 23, 59, 59);
      const [earningsAgg, count] = await Promise.all([
        prisma.booking.aggregate({
          where: {
            listing: { hostId },
            status: "CONFIRMED",
            createdAt: { gte: start, lte: end },
          },
          _sum: { totalPrice: true },
        }),
        prisma.booking.count({
          where: {
            listing: { hostId },
            createdAt: { gte: start, lte: end },
          },
        }),
      ]);
      monthlyData.push({
        month: start.toLocaleString("default", { month: "short" }),
        earnings: earningsAgg._sum.totalPrice ?? 0,
        bookings: count,
      });
    }

    res.json({
      totalListings,
      totalBookings,
      confirmedBookings,
      pendingBookings,
      cancelledBookings,
      monthlyEarnings: monthlyEarningsAgg._sum.totalPrice ?? 0,
      allTimeEarnings: allTimeEarningsAgg._sum.totalPrice ?? 0,
      monthlyData,
      recentBookings,
    });
  } catch (err) {
    handleError(err, res, "getHostAnalytics");
  }
};

function handleError(err: unknown, res: Response, operation: string): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[${operation}] Prisma error ${err.code}: ${err.message}`);
    res.status(500).json({ message: "Database error" });
    return;
  }
  console.error(`[${operation}] Unexpected error:`, err);
  res.status(500).json({ message: "Something went wrong." });
}
