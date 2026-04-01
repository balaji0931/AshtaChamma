/**
 * Custom Error class for Ashta Chamma
 * isPublic: If true, the message is safe to show to the client.
 * If false, the client gets a generic error message, while the full error is logged.
 */
export class AppError extends Error {
  public code: string;
  public isPublic: boolean;

  constructor(code: string, message: string, isPublic = true) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.isPublic = isPublic;
  }
}
