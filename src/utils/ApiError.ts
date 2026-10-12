export default class ApiError extends Error {
  statusCode: number;
  errors: string[];
  isOperational: boolean;
  code?: string;

  constructor(
    statusCode: number,
    message: string,
    errors: string[] = [],
    code?: string,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(
    message: string,
    errors?: string[],
    code?: string,
  ): ApiError {
    return new ApiError(400, message, errors, code);
  }

  static unauthorized(message = "Unauthorized", code?: string): ApiError {
    return new ApiError(401, message, [], code);
  }

  static forbidden(message = "Forbidden", code?: string): ApiError {
    return new ApiError(403, message, [], code);
  }

  static notFound(message = "Resource not found", code?: string): ApiError {
    return new ApiError(404, message, [], code);
  }

  static conflict(message: string, code?: string): ApiError {
    return new ApiError(409, message, [], code);
  }

  static paymentRequired(message: string, code?: string): ApiError {
    return new ApiError(402, message, [], code);
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(500, message);
  }
}
