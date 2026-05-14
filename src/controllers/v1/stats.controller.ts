import { Request, Response } from "express";
import prisma from "../../config/prisma";
import { getCache, setCache } from "../../config/cache";

export const getListingsStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = "stats_listings";
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    const [totalListings, averagePriceAgg, byLocation, byType] = await Promise.all([
      prisma.listing.count(),
      prisma.listing.aggregate({
        _avg: { pricePerNight: true },
      }),
      prisma.listing.groupBy({
        by: ["location"],
        _count: { location: true },
      }),
      prisma.listing.groupBy({
        by: ["type"],
        _count: { type: true },
      }),
    ]);

    const averagePrice = averagePriceAgg._avg.pricePerNight || 0;

    const responseData = {
      totalListings,
      averagePrice,
      byLocation,
      byType,
    };

    setCache(cacheKey, responseData, 300); // 5 minutes

    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong." });
  }
};

export const getUsersStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = "stats_users";
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    const [totalUsers, byRole] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ["role"],
        _count: { role: true },
      }),
    ]);

    const responseData = {
      totalUsers,
      byRole,
    };

    setCache(cacheKey, responseData, 300); // 5 minutes

    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong." });
  }
};

export const getAdminStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = "stats_admin";
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    const [
      totalUsers,
      totalListings,
      totalBookings,
      totalRevenue,
      bookingsByStatus,
      disputesByStatus,
      recentBookings,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.listing.count(),
      prisma.booking.count(),
      prisma.booking.aggregate({ _sum: { totalPrice: true } }),
      prisma.booking.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.dispute.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          guest: { select: { id: true, name: true, email: true, avatar: true } },
          listing: { select: { id: true, title: true, location: true } },
        },
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
      }),
    ]);

    // Build monthly revenue/bookings for last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const allBookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: twelveMonthsAgo },
        status: { not: "CANCELLED" },
      },
      select: { totalPrice: true, createdAt: true },
    });

    const monthlyMap: Record<string, { revenue: number; bookings: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: 0, bookings: 0 };
    }

    for (const b of allBookings) {
      const d = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyMap[key]) {
        monthlyMap[key].revenue += b.totalPrice;
        monthlyMap[key].bookings += 1;
      }
    }

    const monthlyData = Object.entries(monthlyMap).map(([key, val]) => {
      const [year, month] = key.split("-");
      const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", { month: "short" });
      return { month: monthName, year: Number(year), revenue: val.revenue, bookings: val.bookings };
    });

    const responseData = {
      totalUsers,
      totalListings,
      totalBookings,
      totalRevenue: totalRevenue._sum.totalPrice ?? 0,
      bookingsByStatus,
      disputesByStatus,
      recentBookings,
      recentUsers,
      monthlyData,
    };

    setCache(cacheKey, responseData, 120); // 2 minutes

    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong." });
  }
};
