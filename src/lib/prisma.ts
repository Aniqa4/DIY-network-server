import { PrismaClient } from '@prisma/client';

// One shared client for the whole process — Prisma manages its own
// connection pool underneath.
const prisma = new PrismaClient();

export default prisma;
