import { Request, Response } from "express";
import { Prisma } from "../../../generated/prisma/client";
import prisma from "../../config/prisma";
import bcrypt from "bcrypt";
import { clearCachePrefix } from "../../config/cache";

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "10", 10) || 10);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        include: {
          _count: {
            select: { listings: true },
          },
        },
      }),
      prisma.user.count(),
    ]);

    res.json({
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleError(err, res, "getAllUsers");
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        listings: true,
        bookings: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: `User with id ${id} not found.` });
      return;
    }

    res.json(user);
  } catch (err) {
    handleError(err, res, "getUserById");
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, username, phone, password, role, avatar, bio } = req.body as {
      name?: string;
      email?: string;
      username?: string;
      phone?: string;
      password?: string;
      role?: "HOST" | "GUEST";
      avatar?: string;
      bio?: string;
    };

    if (!name || !email || !username || !phone || !password) {
      res.status(400).json({
        message: "Missing required fields: name, email, username, phone, password.",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        username,
        phone,
        password: hashedPassword,
        ...(role && { role }),
        ...(avatar !== undefined && { avatar }),
        ...(bio !== undefined && { bio }),
      },
    });

    const { password: _, ...userWithoutPassword } = newUser;

    clearCachePrefix("stats_users");

    res.status(201).json(userWithoutPassword);
  } catch (err) {
    handleError(err, res, "createUser");
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.user.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: `User with id ${id} not found.` });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: req.body as Prisma.UserUpdateInput,
    });

    res.json(updated);
  } catch (err) {
    handleError(err, res, "updateUser");
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.user.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: `User with id ${id} not found.` });
      return;
    }

    const deleted = await prisma.user.delete({ where: { id } });
    
    clearCachePrefix("stats_users");
    
    res.json({ message: "User deleted successfully.", user: deleted });
  } catch (err) {
    handleError(err, res, "deleteUser");
  }
};

export const getUserListings = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = req.params.id as string;

    const host = await prisma.user.findFirst({ where: { id: hostId } });
    if (!host) {
      res.status(404).json({ message: `User with id ${hostId} not found.` });
      return;
    }

    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "10", 10) || 10);
    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({ 
        where: { hostId },
        skip,
        take: limit
      }),
      prisma.listing.count({ where: { hostId } })
    ]);

    res.json({
      data: listings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleError(err, res, "getUserListings");
  }
};

export const getUserBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const guestId = req.params.id as string;

    const guest = await prisma.user.findFirst({ where: { id: guestId } });
    if (!guest) {
      res.status(404).json({ message: `User with id ${guestId} not found.` });
      return;
    }

    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
    const limit = Math.max(1, parseInt((req.query.limit as string) ?? "10", 10) || 10);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: { guestId },
        skip,
        take: limit,
        include: { listing: { select: { title: true, location: true } } },
      }),
      prisma.booking.count({ where: { guestId } })
    ]);

    res.json({
      data: bookings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleError(err, res, "getUserBookings");
  }
};

function handleError(err: unknown, res: Response, operation: string): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[${operation}] Prisma error ${err.code}: ${err.message}`);

    if (err.code === "P2002") {
      res.status(409).json({ message: "A user with that email or username already exists." });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ message: "Record not found." });
      return;
    }
  }

  console.error(`[${operation}] Unexpected error:`, err);
  res.status(500).json({ message: "Something went wrong." });
}
