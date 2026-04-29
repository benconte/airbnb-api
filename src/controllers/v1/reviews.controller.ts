import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import prisma from "../../config/prisma";
import { getCache, setCache, clearCachePrefix } from "../../config/cache";

export const getListingReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const listingId = req.params.id as string;
    
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "10", 10) || 10);
    const skip = (page - 1) * limit;

    const cacheKey = `reviews_${listingId}_page_${page}_limit_${limit}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ message: "Listing not found." });
      return;
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { listingId },
        skip,
        take: limit,
        include: {
          user: { select: { name: true, avatar: true } },
        },
      }),
      prisma.review.count({ where: { listingId } }),
    ]);

    const responseData = {
      data: reviews,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    setCache(cacheKey, responseData, 30);

    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong." });
  }
};

export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const listingId = req.params.id as string;
    const { rating, comment } = req.body as { rating?: number; comment?: string };

    if (!rating || !comment) {
      res.status(400).json({ message: "Rating and comment are required." });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ message: "Rating must be between 1 and 5." });
      return;
    }

    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ message: "Listing not found." });
      return;
    }

    const review = await prisma.review.create({
      data: {
        rating,
        comment,
        listingId,
        userId,
      },
    });

    clearCachePrefix(`reviews_${listingId}`);

    res.status(201).json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong." });
  }
};

export const deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      res.status(404).json({ message: "Review not found." });
      return;
    }

    if (review.userId !== req.userId && req.role !== "ADMIN") {
      res.status(403).json({ message: "You can only delete your own reviews." });
      return;
    }

    await prisma.review.delete({ where: { id } });

    clearCachePrefix(`reviews_${review.listingId}`);

    res.json({ message: "Review deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong." });
  }
};
