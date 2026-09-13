export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'internal_error') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}