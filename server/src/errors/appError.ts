export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'این بازه زمانی قبلاً رزرو شده است. لطفاً ساعت یا تاریخ دیگری را انتخاب کنید.') {
    super(message, 409);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'مورد درخواست‌شده یافت نشد.') {
    super(message, 404);
  }
}
