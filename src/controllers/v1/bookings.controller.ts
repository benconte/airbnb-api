import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { Prisma, BookingStatus } from "../../../generated/prisma/client";
import prisma from "../../config/prisma";
import { sendEmail } from "../../config/email";
import { bookingConfirmationEmail, bookingCancellationEmail } from "../../templates/emails";

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

export const getBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
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

export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { listingId, checkIn, checkOut } = req.body as {
      listingId?: string;
      checkIn?: string;
      checkOut?: string;
    };

    if (!listingId || !checkIn || !checkOut) {
      res.status(400).json({
        message: "Missing required fields: listingId, checkIn, checkOut.",
      });
      return;
    }

    const guestId = req.userId;
    if (!guestId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const listing = await prisma.listing.findFirst({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ message: `Listing with id ${listingId} not found.` });
      return;
    }

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

    if (checkInDate < new Date()) {
      res.status(400).json({ message: "checkIn cannot be in the past." });
      return;
    }

    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        listingId,
        status: "CONFIRMED",
        AND: [
          { checkIn: { lt: checkOutDate } },
          { checkOut: { gt: checkInDate } },
        ],
      },
    });

    if (conflictingBooking) {
      res.status(409).json({ message: "The listing is already booked for the selected dates." });
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
        guest: { select: { name: true, email: true } },
        listing: { select: { title: true, location: true } },
      },
    });

    // Send response first, then fire email
    res.status(201).json(newBooking);

    try {
      const guest = await prisma.user.findUnique({ where: { id: guestId } });
      if (guest) {
        await sendEmail(
          guest.email,
          "Your Airbnb Booking is Confirmed!",
          bookingConfirmationEmail(
            guest.name,
            listing.title,
            listing.location,
            checkInDate.toDateString(),
            checkOutDate.toDateString(),
            totalPrice
          )
        );
      }
    } catch (emailErr) {
      console.error("[Email] Failed to send booking confirmation email:", emailErr);
    }
  } catch (err) {
    handleError(err, res, "createBooking");
  }
};

export const deleteBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.booking.findFirst({
      where: { id },
      include: {
        guest: { select: { id: true, name: true, email: true } },
        listing: { select: { title: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ message: `Booking with id ${id} not found.` });
      return;
    }

    if (existing.guestId !== req.userId && req.role !== "ADMIN") {
      res.status(403).json({ message: "You can only cancel your own bookings" });
      return;
    }

    if (existing.status === "CANCELLED") {
      res.status(400).json({ message: "Booking is already cancelled" });
      return;
    }

    const deleted = await prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    // Send response first, then fire email
    res.json({ message: "Booking cancelled successfully.", booking: deleted });

    try {
      await sendEmail(
        existing.guest.email,
        "Your Airbnb Booking has been Cancelled",
        bookingCancellationEmail(
          existing.guest.name,
          existing.listing.title,
          existing.checkIn.toDateString(),
          existing.checkOut.toDateString()
        )
      );
    } catch (emailErr) {
      console.error("[Email] Failed to send booking cancellation email:", emailErr);
    }
  } catch (err) {
    handleError(err, res, "deleteBooking");
  }
};

export const updateBookingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
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
