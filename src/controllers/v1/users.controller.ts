import { Request, Response } from "express";
import { Prisma } from "../../../generated/prisma/client";
import prisma from "../../config/prisma";
import bcrypt from "bcrypt";

export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: { listings: true },
        },
      },
    });
    res.json(users);
  } catch (err) {
    handleError(err, res, "getAllUsers");
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
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

    res.status(201).json(userWithoutPassword);
  } catch (err) {
    handleError(err, res, "createUser");
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

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
    const id = Number(req.params.id);

    const existing = await prisma.user.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: `User with id ${id} not found.` });
      return;
    }

    const deleted = await prisma.user.delete({ where: { id } });
    res.json({ message: "User deleted successfully.", user: deleted });
  } catch (err) {
    handleError(err, res, "deleteUser");
  }
};

export const getUserListings = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = Number(req.params.id);

    const host = await prisma.user.findFirst({ where: { id: hostId } });
    if (!host) {
      res.status(404).json({ message: `User with id ${hostId} not found.` });
      return;
    }

    const listings = await prisma.listing.findMany({ where: { hostId } });
    res.json(listings);
  } catch (err) {
    handleError(err, res, "getUserListings");
  }
};

export const getUserBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const guestId = Number(req.params.id);

    const guest = await prisma.user.findFirst({ where: { id: guestId } });
    if (!guest) {
      res.status(404).json({ message: `User with id ${guestId} not found.` });
      return;
    }

    const bookings = await prisma.booking.findMany({
      where: { guestId },
      include: { listing: true },
    });

    res.json(bookings);
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
