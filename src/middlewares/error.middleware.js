import ApiError from "../utils/ApiError.js";

export const errorMiddleware = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;

    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message || "Internal server error";

    error = new ApiError(statusCode, message, error.errors || []);
  }

  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
    errors: error.errors,
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
    }),
  });
};