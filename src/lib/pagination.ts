import type { Request } from 'express';

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
  // Inclusive createdAt range, when provided via ?startDate / ?endDate.
  createdAt?: { gte?: Date; lte?: Date };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

// Parses ?page, ?limit, ?startDate, ?endDate from a request into safe values.
export function parsePageParams(req: Request): PageParams {
  const page = Math.max(1, Number(req.query.page) || 1);
  const rawLimit = Number(req.query.limit) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));

  let createdAt: PageParams['createdAt'];
  const start = req.query.startDate as string | undefined;
  const end = req.query.endDate as string | undefined;
  const gte = start ? new Date(start) : undefined;
  const lte = end ? new Date(end) : undefined;
  if ((gte && !isNaN(gte.getTime())) || (lte && !isNaN(lte.getTime()))) {
    createdAt = {};
    if (gte && !isNaN(gte.getTime())) createdAt.gte = gte;
    // Make the end date inclusive of the whole day.
    if (lte && !isNaN(lte.getTime())) {
      lte.setHours(23, 59, 59, 999);
      createdAt.lte = lte;
    }
  }

  return { page, limit, skip: (page - 1) * limit, createdAt };
}

export function buildPage<T>(
  items: T[],
  total: number,
  { page, limit }: PageParams,
): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}
