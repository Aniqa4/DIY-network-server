import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as cloudinary from '../lib/cloudinary';
import ApiError from '../utils/api-error';
import { CATEGORIES, type Category } from '../validators/schemas';
import { parsePageParams, buildPage } from '../lib/pagination';
import type { Prisma } from '@prisma/client';

const POST_INCLUDE = {
  author: { select: { id: true, username: true, avatarUrl: true } },
  _count: { select: { likes: true, saves: true, comments: true } },
} as const;

// Maps a ?sort value to a Prisma orderBy. Defaults to newest first.
function postOrderBy(sort: string | undefined): Prisma.PostOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'asc' }];
    case 'most_viewed':
      return [{ views: 'desc' }, { createdAt: 'desc' }];
    case 'most_liked':
      return [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }];
  }
}

// GET /posts?category=&authorId=&sort=&page=&limit=&startDate=&endDate=
// Returns a paginated envelope: { items, page, limit, total, totalPages, hasMore }.
export async function findAll(req: Request, res: Response) {
  const category = req.query.category as string | undefined;
  const authorId = req.query.authorId as string | undefined;
  const sort = req.query.sort as string | undefined;

  if (category && !(CATEGORIES as readonly string[]).includes(category)) {
    throw ApiError.badRequest(
      `category must be one of: ${CATEGORIES.join(', ')}`,
    );
  }

  const params = parsePageParams(req);
  const where: Prisma.PostWhereInput = {
    category: (category as Category) || undefined,
    authorId: authorId || undefined,
    // Hide banned posts and posts by banned authors from public listings.
    banned: false,
    author: { banned: false },
    ...(params.createdAt ? { createdAt: params.createdAt } : {}),
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: postOrderBy(sort),
      include: POST_INCLUDE,
      skip: params.skip,
      take: params.limit,
    }),
    prisma.post.count({ where }),
  ]);

  res.json(buildPage(posts, total, params));
}

// GET /posts/:id — does NOT bump the view count; that's a separate write,
// see POST /posts/:id/view below. Banned posts (or posts by a banned author)
// return 404 to the public.
export async function findOne(req: Request<{ id: string }>, res: Response) {
  const post = await prisma.post.findFirst({
    where: { id: req.params.id, banned: false, author: { banned: false } },
    include: POST_INCLUDE,
  });
  if (!post) {
    throw ApiError.notFound('Post not found');
  }
  res.json(post);
}

// POST /posts/:id/view — call once per real view from the client. Kept
// separate from GET so that reading a resource stays side-effect free.
export async function incrementView(
  req: Request<{ id: string }>,
  res: Response,
) {
  const exists = await prisma.post.findUnique({
    where: { id: req.params.id },
  });
  if (!exists) {
    throw ApiError.notFound('Post not found');
  }
  const { views } = await prisma.post.update({
    where: { id: req.params.id },
    data: { views: { increment: 1 } },
    select: { views: true },
  });
  res.json({ views });
}

// POST /posts — multipart/form-data with up to 5 images under "images".
export async function create(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const uploaded = await Promise.all(
    files.map((file) => cloudinary.uploadImage(file, 'posts')),
  );
  const post = await prisma.post.create({
    data: {
      ...req.body,
      authorId: req.user!.userId,
      images: uploaded.map((result) => result.secure_url),
    },
  });
  res.status(201).json(post);
}

// PATCH /posts/:id — text fields via JSON or multipart. When `imageOrder` is
// present the image set is reconciled: entries are kept existing URLs or
// "__new__<i>" placeholders for newly uploaded files, removed images are
// deleted from Cloudinary.
export async function update(req: Request<{ id: string }>, res: Response) {
  const existing = await assertOwner(req.params.id, req.user!.userId);

  const { imageOrder, ...fields } = req.body as {
    imageOrder?: string[];
    [key: string]: unknown;
  };
  const data: Record<string, unknown> = { ...fields };

  if (imageOrder !== undefined) {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const uploaded = await Promise.all(
      files.map((file) => cloudinary.uploadImage(file, 'posts')),
    );

    const finalImages: string[] = [];
    for (const entry of imageOrder) {
      if (entry.startsWith('__new__')) {
        const idx = Number(entry.slice('__new__'.length));
        const url = uploaded[idx]?.secure_url;
        if (url) finalImages.push(url);
      } else if (existing.images.includes(entry)) {
        // Only keep URLs that actually belonged to this post.
        finalImages.push(entry);
      }
    }
    data.images = finalImages.slice(0, 5);

    // Best-effort cleanup of images the user removed.
    const removed = existing.images.filter((url) => !finalImages.includes(url));
    await Promise.all(removed.map((url) => cloudinary.destroyImage(url)));
  }

  const post = await prisma.post.update({
    where: { id: req.params.id },
    data,
  });
  res.json(post);
}

// DELETE /posts/:id
export async function remove(req: Request<{ id: string }>, res: Response) {
  const post = await assertOwner(req.params.id, req.user!.userId);
  await prisma.post.delete({ where: { id: req.params.id } });
  // Free the post's images from Cloudinary (best-effort).
  await Promise.all(post.images.map((url) => cloudinary.destroyImage(url)));
  res.json({ message: 'Post deleted' });
}

async function assertOwner(id: string, userId: string) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    throw ApiError.notFound('Post not found');
  }
  if (post.authorId !== userId) {
    throw ApiError.forbidden('You do not own this post');
  }
  return post;
}
