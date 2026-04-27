import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import upload from "../config/multer";
import {
  uploadAvatar,
  deleteAvatar,
  uploadListingPhotos,
  deleteListingPhoto,
} from "../controllers/upload.controller";

// ─── User Avatar Routes /users/
export const userUploadRouter = Router();
userUploadRouter.post("/:id/avatar", authenticate, upload.single("image"), uploadAvatar);
userUploadRouter.delete("/:id/avatar", authenticate, deleteAvatar);

// ─── Listing Photo Routes /listing/ 
export const listingUploadRouter = Router();
listingUploadRouter.post("/:id/photos", authenticate, upload.array("photos", 5), uploadListingPhotos);
listingUploadRouter.delete("/:id/photos/:photoId", authenticate, deleteListingPhoto);
