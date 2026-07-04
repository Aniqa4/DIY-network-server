import type { NextFunction, Request, Response } from 'express';

// Standard success envelope for mutating endpoints:
//   { success: true, message: string, data: <the endpoint's payload> }
// Errors (from the error handler) carry { success: false, ... } instead.
//
// Implemented as a single middleware that patches res.json for
// POST/PUT/PATCH/DELETE requests, so individual controllers don't each have
// to build the envelope. GET responses are left untouched (lists/detail keep
// returning raw data).

const DEFAULT_MESSAGE: Record<string, string> = {
  POST: 'Success',
  PUT: 'Updated successfully',
  PATCH: 'Updated successfully',
  DELETE: 'Deleted successfully',
};

export function responseEnvelope(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = (body: unknown) => {
    // Error payloads: tag with success:false, keep the Nest-style shape.
    if (
      body &&
      typeof body === 'object' &&
      'statusCode' in body &&
      'error' in body
    ) {
      return originalJson({ success: false, ...body });
    }

    // Already an envelope — don't double-wrap.
    if (body && typeof body === 'object' && 'success' in body) {
      return originalJson(body);
    }

    // Pull a message out of the payload if it provided one, else default it.
    let data: unknown = body ?? null;
    let provided: string | undefined;
    if (body && typeof body === 'object' && 'message' in body) {
      const { message, ...rest } = body as { message: unknown; [k: string]: unknown };
      if (typeof message === 'string') provided = message;
      // Don't echo a bare { message } back inside data.
      data = Object.keys(rest).length ? rest : null;
    }

    return originalJson({
      success: true,
      message: provided ?? DEFAULT_MESSAGE[req.method] ?? 'Success',
      data,
    });
  };

  next();
}
