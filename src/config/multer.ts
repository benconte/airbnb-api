import multer from "multer";

const upload = multer({
  // Files stay as Buffers in RAM — no disk writes needed before uploading to Cloudinary
  storage: multer.memoryStorage(),

  // Always check MIME type, not file extension
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only jpeg, png, webp allowed"));
    }
  },

  // 5MB max — without this, large uploads can exhaust RAM
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default upload;
