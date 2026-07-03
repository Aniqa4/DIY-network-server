import { z } from 'zod';

export const CATEGORIES = [
  'COOKING',
  'CRAFTING',
  'SEWING',
  'CROCHET',
  'KNITTING',
  'OTHER',
] as const;

export type Category = (typeof CATEGORIES)[number];

// -- auth ------------------------------------------------------------------

export const registerSchema = z
  .object({
    email: z.string().email(),
    username: z.string().min(3),
    password: z.string().min(6),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string(),
  })
  .strict();

export const resendVerificationSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

// -- posts -----------------------------------------------------------------

// materials/steps arrive as JSON-encoded strings when the request is
// multipart/form-data (required for the images files to attach), but as
// plain arrays for a normal JSON request. Accept both.
const jsonArray = z.preprocess(
  (value) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value; // let the array check below produce the error message
      }
    }
    return value;
  },
  z.array(z.string()).nonempty(),
);

export const createPostSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    category: z.enum(CATEGORIES),
    materials: jsonArray,
    steps: jsonArray,
  })
  .strict();

export const updatePostSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    category: z.enum(CATEGORIES).optional(),
    materials: jsonArray.optional(),
    steps: jsonArray.optional(),
  })
  .strict();

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// -- users -----------------------------------------------------------------

export const updateUserSchema = z
  .object({
    username: z.string().min(3).optional(),
    bio: z.string().max(280).optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// -- comments / messages ---------------------------------------------------

export const createCommentSchema = z
  .object({
    postId: z.string(),
    content: z.string().min(1),
  })
  .strict();

export const createMessageSchema = z
  .object({
    receiverId: z.string(),
    content: z.string().min(1),
  })
  .strict();
