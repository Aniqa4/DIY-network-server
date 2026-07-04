import type { ErrorRequestHandler, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import ApiError from '../utils/api-error';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Cannot ${req.method} ${req.path}`,
    error: 'Not Found',
  });
}

// Global error handler — must be registered last and keep all 4 params so
// Express recognises it as an error middleware. All error payloads carry
// success:false to match the success envelope on mutating routes.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      message: err.payloadMessage,
      error: err.errorName,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: err.issues.map(
        (issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`,
      ),
      error: 'Bad Request',
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: err.message,
      error: 'Bad Request',
    });
    return;
  }

  // Fallbacks for Prisma errors that slip past explicit checks.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        statusCode: 409,
        message: 'A record with that value already exists',
        error: 'Conflict',
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Record not found',
        error: 'Not Found',
      });
      return;
    }
  }

  console.error(err);
  res.status(500).json({
    success: false,
    statusCode: 500,
    message: 'Internal server error',
    error: 'Internal Server Error',
  });
};
