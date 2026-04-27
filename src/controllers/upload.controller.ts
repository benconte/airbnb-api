import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import prisma from "../config/prisma";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";

export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    // Users can only change their own avatar
    if (req.userId !== id) {
      res.status(403).json({ message: "You can only update your own avatar" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // clean up the old file before uploading a new one
    if (user.avatarPublicId) {
      await deleteFromCloudinary(user.avatarPublicId);
    }

    const { url, publicId } = await uploadToCloudinary(req.file.buffer, "airbnb/avatars");

    const updated = await prisma.user.update({
      where: { id },
      data: { avatar: url, avatarPublicId: publicId },
    });

    const { password: _, ...userWithoutPassword } = updated;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error("[uploadAvatar] Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const deleteAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    if (req.userId !== id) {
      res.status(403).json({ message: "You can only remove your own avatar" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.avatar) {
      res.status(400).json({ message: "No avatar to remove" });
      return;
    }

    await deleteFromCloudinary(user.avatarPublicId!);

    await prisma.user.update({
      where: { id },
      data: { avatar: null, avatarPublicId: null },
    });

    res.status(200).json({ message: "Avatar removed successfully" });
  } catch (error) {
    console.error("[deleteAvatar] Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const uploadListingPhotos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      res.status(404).json({ message: "Listing not found" });
      return;
    }

    // Only the host can upload photos
    if (listing.hostId !== req.userId) {
      res.status(403).json({ message: "Only the host can upload photos for this listing" });
      return;
    }

    const existingCount = await prisma.listingPhoto.count({ where: { listingId: id } });

    if (existingCount >= 5) {
      res.status(400).json({ message: "Maximum of 5 photos allowed per listing" });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ message: "No files uploaded" });
      return;
    }

    // Only process up to the remaining slots
    const remainingSlots = 5 - existingCount;
    const filesToProcess = files.slice(0, remainingSlots);

    for (const file of filesToProcess) {
      const { url, publicId } = await uploadToCloudinary(file.buffer, "airbnb/listings");
      await prisma.listingPhoto.create({
        data: { url, publicId, listingId: id },
      });
    }

    const updatedListing = await prisma.listing.findUnique({
      where: { id },
      include: { photos: true },
    });

    res.status(201).json(updatedListing);
  } catch (error) {
    console.error("[uploadListingPhotos] Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const deleteListingPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const photoId = Number(req.params.photoId);

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      res.status(404).json({ message: "Listing not found" });
      return;
    }

    // Only the host can delete photos
    if (listing.hostId !== req.userId) {
      res.status(403).json({ message: "Only the host can delete photos for this listing" });
      return;
    }

    const photo = await prisma.listingPhoto.findUnique({ where: { id: photoId } });
    if (!photo) {
      res.status(404).json({ message: "Photo not found" });
      return;
    }

    // Prevent hosts from deleting other listings' photos
    if (photo.listingId !== id) {
      res.status(403).json({ message: "This photo does not belong to this listing" });
      return;
    }

    await deleteFromCloudinary(photo.publicId);
    await prisma.listingPhoto.delete({ where: { id: photoId } });

    res.status(200).json({ message: "Photo deleted successfully" });
  } catch (error) {
    console.error("[deleteListingPhoto] Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};
