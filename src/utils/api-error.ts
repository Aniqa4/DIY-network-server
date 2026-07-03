// Throwable HTTP error. Controllers throw these; the global error handler
// turns them into JSON responses shaped like NestJS's, so the frontend
// sees identical error payloads from either server:
//   { "statusCode": 404, "message": "Post not found", "error": "Not Found" }
const STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

class ApiError extends Error {
  readonly statusCode: number;
  // Kept as-is (string or array) so validation errors can stay arrays,
  // like Nest's ValidationPipe.
  readonly payloadMessage: string | string[];
  readonly errorName: string;

  constructor(statusCode: number, message: string | string[]) {
    super(Array.isArray(message) ? message.join(', ') : message);
    this.statusCode = statusCode;
    this.payloadMessage = message;
    this.errorName = STATUS_NAMES[statusCode] ?? 'Error';
  }

  static badRequest(message: string | string[]) {
    return new ApiError(400, message);
  }
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Not Found') {
    return new ApiError(404, message);
  }
  static conflict(message: string) {
    return new ApiError(409, message);
  }
}

export default ApiError;
