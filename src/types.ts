import type { Role } from '@prisma/client';

// What requireAuth puts on req.user — JWT claims plus the freshly-loaded role.
export interface AuthPayload {
  userId: string;
  username: string;
  jti: string;
  exp: number;
  role: Role;
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
