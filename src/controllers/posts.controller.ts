import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as cloudinary from '../lib/cloudinary';
import ApiError from '../utils/api-error';
import { CATEGORIES, type Category } from '../validators/schemas';

const POST_INCLUDE = {
  author: { select: { id: true, username: true } },
  _count: { select: { likes: true, saves: true, comments: true } },
} as const;

// GET /posts?category=CROCHET&authorId=xxx (both optional)
export async function findAll(req: Request, res: Response) {
  const category = req.query.category as string | undefined;
  const authorId = req.query.authorId as string | undefined;

  if (category && !(CATEGORIES as readonly string[]).includes(category)) {
    throw ApiError.badRequest(
      `category must be one of: ${CATEGORIES.join(', ')}`,
    );
  }
  const posts = await prisma.post.findMany({
    where: {
      category: (category as Category) || undefined,
      authorId: authorId || undefined,
    },
    orderBy: { createdAt: 'desc' },
    include: POST_INCLUDE,
  });
  res.json(posts);
}

// GET /posts/:id — does NOT bump the view count; that's a separate write,
// see POST /posts/:id/view below.
export async function findOne(req: Request<{ id: string }>, res: Response) {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
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

// PATCH /posts/:id
export async function update(req: Request<{ id: string }>, res: Response) {
  await assertOwner(req.params.id, req.user!.userId);
  const post = await prisma.post.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(post);
}

// DELETE /posts/:id
export async function remove(req: Request<{ id: string }>, res: Response) {
  await assertOwner(req.params.id, req.user!.userId);
  await prisma.post.delete({ where: { id: req.params.id } });
  res.status(204).end();
}

async function assertOwner(id: string, userId: string) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    throw ApiError.notFound('Post not found');
  }
  if (post.authorId !== userId) {
    throw ApiError.forbidden('You do not own this post');
  }
}
