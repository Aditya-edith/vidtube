import { mongoose } from "mongoose";
import { ApiError } from "../utils/ApiError.js";

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Check if the error is not an instance of ApiError
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || (error instanceof mongoose.Error ? 400 : 500);
    const message = error.message || "Some unknown error occurred";
    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }

  // Prepare the response object
  const response = {
    success: false,
    message: error.message,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }), // Include stack trace only in development
  };

  // Send the response
  return res.status(error.statusCode).json(response);
};

export { errorHandler };
