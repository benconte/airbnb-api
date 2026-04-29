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
