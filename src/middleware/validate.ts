import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';

// validate(schema) parses req.body against a zod schema. Unknown fields are
// rejected (schemas use .strict()) and the parsed result replaces req.body,
// mirroring Nest's ValidationPipe with whitelist + forbidNonWhitelisted.
// Zod parse errors are turned into 400s by the global error handler.
export default function validate(schema: ZodTypeAny): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
}
