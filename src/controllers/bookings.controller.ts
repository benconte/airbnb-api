import { Request, Response } from "express";
import { Prisma, BookingStatus } from "../../generated/prisma/client";
import prisma from "../config/prisma";

// ─── GET /bookings ────────────────────────────────────────────────────────────
export const getAllBookings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        guest: { select: { name: true } },
        listing: { select: { title: true } },
      },
    });
    res.json(bookings);
  } catch (err) {
    handleError(err, res, "getAllBookings");
  }
};

// ─── GET /bookings/:id ────────────────────────────────────────────────────────
export const getBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        guest: true,
        listing: true,
      },
    });

    if (!booking) {
      res.status(404).json({ message: `Booking with id ${id} not found.` });
      return;
    }

    res.json(booking);
  } catch (err) {
    handleError(err, res, "getBookingById");
  }
};

// ─── POST /bookings ───────────────────────────────────────────────────────────
export const createBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { guestId, listingId, checkIn, checkOut } = req.body as {
      guestId?: number;
      listingId?: number;
      checkIn?: string;
      checkOut?: string;
    };

    if (!guestId || !listingId || !checkIn || !checkOut) {
      res.status(400).json({
        message: "Missing required fields: guestId, listingId, checkIn, checkOut.",
      });
      return;
    }

    // Verify guest exists
    const guest = await prisma.user.findFirst({ where: { id: guestId } });
    if (!guest) {
      res.status(404).json({ message: `Guest user with id ${guestId} not found.` });
      return;
    }

    // Verify listing exists
    const listing = await prisma.listing.findFirst({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ message: `Listing with id ${listingId} not found.` });
      return;
    }

    // Calculate totalPrice server-side — never trust the client
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      res.status(400).json({ message: "Invalid date format for checkIn or checkOut." });
      return;
    }

    if (checkOutDate <= checkInDate) {
      res.status(400).json({ message: "checkOut must be after checkIn." });
      return;
    }

    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalPrice = nights * listing.pricePerNight;

    const newBooking = await prisma.booking.create({
      data: {
        guestId,
        listingId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalPrice,
        status: "PENDING",
      },
      include: {
        guest: { select: { name: true } },
        listing: { select: { title: true } },
      },
    });

    res.status(201).json(newBooking);
  } catch (err) {
    handleError(err, res, "createBooking");
  }
};

// ─── DELETE /bookings/:id ─────────────────────────────────────────────────────
export const deleteBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.booking.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: `Booking with id ${id} not found.` });
      return;
    }

    const deleted = await prisma.booking.delete({ where: { id } });
    res.json({ message: "Booking cancelled successfully.", booking: deleted });
  } catch (err) {
    handleError(err, res, "deleteBooking");
  }
};

// ─── PATCH /bookings/:id/status ───────────────────────────────────────────────
export const updateBookingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body as { status?: string };

    if (!status || !Object.values(BookingStatus).includes(status as BookingStatus)) {
      res.status(400).json({
        message: `Invalid status. Must be one of: ${Object.values(BookingStatus).join(", ")}.`,
      });
      return;
    }

    const existing = await prisma.booking.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: `Booking with id ${id} not found.` });
      return;
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: status as BookingStatus },
    });

    res.json(updated);
  } catch (err) {
    handleError(err, res, "updateBookingStatus");
  }
};

// ─── Error Handler ────────────────────────────────────────────────────────────
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
