// The JWT payload that requireAuth puts on req.user.
export interface AuthPayload {
  userId: string;
  username: string;
  jti: string;
  exp: number;
}

// Make req.user known to Express everywhere (multer already augments
// req.file / req.files the same way).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
