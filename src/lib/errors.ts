export type ErrorCode =
  | "AUTHENTICATION_FAILED"
  | "AUTHORIZATION_FAILED"
  | "VALIDATION_FAILED"
  | "BMC_UNAVAILABLE"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "CONFIGURATION_REQUIRED"
  | "UNSUPPORTED_OPERATION"
  | "INVALID_RESPONSE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNKNOWN_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isRetryable: boolean;
  public readonly safeMessage: string;

  constructor(
    message: string,
    code: ErrorCode = "UNKNOWN_ERROR",
    statusCode: number = 500,
    isRetryable: boolean = false,
    safeMessage?: string
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
    this.safeMessage = safeMessage || message;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, safeMessage?: string) {
    super(message, "VALIDATION_FAILED", 400, false, safeMessage);
    this.name = "ValidationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Unauthorized to perform this operation") {
    super(message, "AUTHORIZATION_FAILED", 403, false, "Access denied: insufficient permissions");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Requested resource not found") {
    super(message, "NOT_FOUND", 404, false, message);
    this.name = "NotFoundError";
  }
}

export class ConfigurationRequiredError extends AppError {
  constructor(message: string = "Verified BMC Helix 26.2 configuration is required") {
    super(message, "CONFIGURATION_REQUIRED", 501, false, message);
    this.name = "ConfigurationRequiredError";
  }
}
