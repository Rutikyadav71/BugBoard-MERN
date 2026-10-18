export class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined, errorCode = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.errorCode = errorCode; // stable machine-readable code (e.g. AI_RATE_LIMITED) the UI can branch on
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(msg, details) { return new AppError(msg, 400, details); }
  static unauthorized(msg = 'Authentication required') { return new AppError(msg, 401); }
  static forbidden(msg = 'You do not have permission to perform this action') { return new AppError(msg, 403); }
  static notFound(msg = 'Resource not found') { return new AppError(msg, 404); }
  static conflict(msg) { return new AppError(msg, 409); }
  static unprocessable(msg, details) { return new AppError(msg, 422, details); }
}
