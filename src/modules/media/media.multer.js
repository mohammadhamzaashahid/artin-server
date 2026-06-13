import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { getUploadsDir } from "../../config/storage.js";
import ApiError from "../../utils/ApiError.js";

const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB ceiling (per-kind checked in service)

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const tempDir = path.join(getUploadsDir(), "temp");
    // sync mkdir is acceptable in a callback context; keeps error propagation simple
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      cb(null, tempDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const random = crypto.randomBytes(16).toString("hex");
    cb(null, `${random}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 1,
  },
}).single("file");

// Wraps the multer callback-style middleware so multer errors become ApiErrors
// that flow into the project's standard error handler.
export const handleMediaUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new ApiError(400, "File exceeds the maximum allowed size (2 GB)"));
      }
      return next(new ApiError(400, `Upload error: ${err.message}`));
    }

    next(err);
  });
};
