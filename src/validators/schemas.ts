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

const otpCode = z.string().regex(/^\d{6}$/, 'Code must be 6 digits');

// Verify an email address with the 6-digit code sent on registration/login.
export const verifyOtpSchema = z
  .object({
    email: z.string().email(),
    code: otpCode,
  })
  .strict();

// Request a fresh code (verification or reset). Same shape as resend.
export const requestOtpSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    email: z.string().email(),
    code: otpCode,
    newPassword: z.string().min(6),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    // Optional for Google-only accounts that have never set a password.
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6),
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

// Like jsonArray but may be empty — used for imageOrder, where an empty list
// means "the post now has no images".
const jsonStringArray = z.preprocess((value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}, z.array(z.string()));

export const updatePostSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    category: z.enum(CATEGORIES).optional(),
    materials: jsonArray.optional(),
    steps: jsonArray.optional(),
    // Desired final image sequence. Each entry is either an existing image
    // URL (kept) or "__new__<i>" referencing the i-th newly uploaded file.
    imageOrder: jsonStringArray.optional(),
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
    // When present, this comment is a reply to another comment on the post.
    parentId: z.string().optional(),
  })
  .strict();

export const updateCommentSchema = z
  .object({
    content: z.string().min(1),
  })
  .strict();

export const createMessageSchema = z
  .object({
    receiverId: z.string(),
    content: z.string().min(1),
  })
  .strict();

// -- moderation ------------------------------------------------------------

// A report targets exactly one of a post or a user.
export const createReportSchema = z
  .object({
    postId: z.string().optional(),
    reportedUserId: z.string().optional(),
    reason: z.string().min(1).max(500),
  })
  .strict()
  .refine(
    (data) => Boolean(data.postId) !== Boolean(data.reportedUserId),
    { message: 'Provide exactly one of postId or reportedUserId' },
  );

export const resolveReportSchema = z
  .object({
    status: z.enum(['RESOLVED', 'DISMISSED']),
  })
  .strict();

const STAFF_ROLES = ['MODERATOR', 'ADMIN'] as const;

// Invite a user to the staff team by username.
export const createInviteSchema = z
  .object({
    username: z.string().min(1),
    role: z.enum(STAFF_ROLES),
  })
  .strict();

// Change an existing member's role (USER demotes them off the team).
export const changeRoleSchema = z
  .object({
    role: z.enum(['USER', 'MODERATOR', 'ADMIN']),
  })
  .strict();
