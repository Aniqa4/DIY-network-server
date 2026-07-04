// OpenAPI 3 document served by swagger-ui-express at /api/v1/docs.
// Hand-maintained: when you add or change an endpoint, update it here too
// (the zod schemas in validators/schemas.ts stay the source of truth for
// actual request validation).

const bearerAuth = [{ bearerAuth: [] }];

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
});

const jsonResponse = (description: string, schema: object) => ({
  description,
  content: { 'application/json': { schema } },
});

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (name: string) => ({ type: 'array', items: ref(name) });

const idParam = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description,
});

const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'DIY Tutorials API',
    description:
      'API for sharing DIY tutorials (cooking, crafting, sewing, crochet, knitting...). ' +
      'Authenticate via POST /auth/login, then click "Authorize" and paste the accessToken.',
    version: '1.0',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'auth' },
    { name: 'users' },
    { name: 'posts' },
    { name: 'comments' },
    { name: 'likes' },
    { name: 'saves' },
    { name: 'follows' },
    { name: 'messages' },
    { name: 'notifications' },
    { name: 'reports' },
    { name: 'admin', description: 'Staff-only: moderation, bans, member management' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          statusCode: { type: 'integer', example: 404 },
          message: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          error: { type: 'string', example: 'Not Found' },
        },
      },
      Message_: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      AuthToken: {
        type: 'object',
        properties: { accessToken: { type: 'string' } },
      },
      Category: {
        type: 'string',
        enum: ['COOKING', 'CRAFTING', 'SEWING', 'CROCHET', 'KNITTING', 'OTHER'],
      },
      RegisterInput: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          username: { type: 'string', minLength: 3 },
          password: { type: 'string', minLength: 6 },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      UserSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          avatarUrl: { type: 'string', nullable: true },
        },
      },
      PublicUser: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          avatarUrl: { type: 'string', nullable: true },
          bio: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          _count: {
            type: 'object',
            properties: { posts: { type: 'integer' } },
          },
        },
      },
      Me: {
        allOf: [
          { $ref: '#/components/schemas/PublicUser' },
          {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              role: { $ref: '#/components/schemas/Role' },
            },
          },
        ],
      },
      Role: {
        type: 'string',
        enum: ['USER', 'MODERATOR', 'ADMIN'],
      },
      UpdateUserInput: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3 },
          bio: { type: 'string', maxLength: 280 },
        },
      },
      Post: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          category: { $ref: '#/components/schemas/Category' },
          materials: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
          images: { type: 'array', items: { type: 'string' } },
          views: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          authorId: { type: 'string' },
          author: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
            },
          },
          _count: {
            type: 'object',
            properties: {
              likes: { type: 'integer' },
              saves: { type: 'integer' },
              comments: { type: 'integer' },
            },
          },
        },
      },
      UpdatePostInput: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          category: { $ref: '#/components/schemas/Category' },
          materials: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          content: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          authorId: { type: 'string' },
          postId: { type: 'string' },
          author: { $ref: '#/components/schemas/UserSummary' },
        },
      },
      Save: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          userId: { type: 'string' },
          postId: { type: 'string' },
          post: { $ref: '#/components/schemas/Post' },
        },
      },
      ChatMessage: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          content: { type: 'string' },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          senderId: { type: 'string' },
          receiverId: { type: 'string' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['LIKE', 'COMMENT', 'FOLLOW'] },
          read: { type: 'boolean' },
          post: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
          },
          actors: { type: 'array', items: ref('UserSummary') },
          actorCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      StaffMember: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          avatarUrl: { type: 'string', nullable: true },
          role: { $ref: '#/components/schemas/Role' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Invite: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          role: { $ref: '#/components/schemas/Role' },
          status: {
            type: 'string',
            enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
          },
          user: { $ref: '#/components/schemas/UserSummary' },
          invitedBy: { $ref: '#/components/schemas/UserSummary' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Report: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          reason: { type: 'string' },
          status: {
            type: 'string',
            enum: ['PENDING', 'RESOLVED', 'DISMISSED'],
          },
          reporter: { $ref: '#/components/schemas/UserSummary' },
          post: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              banned: { type: 'boolean' },
              authorId: { type: 'string' },
            },
          },
          reportedUser: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
              avatarUrl: { type: 'string', nullable: true },
              banned: { type: 'boolean' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateReportInput: {
        type: 'object',
        required: ['reason'],
        properties: {
          postId: { type: 'string', description: 'Report a post (content)' },
          reportedUserId: { type: 'string', description: 'Report a user (profile)' },
          reason: { type: 'string', minLength: 1, maxLength: 500 },
        },
        description: 'Provide exactly one of postId or reportedUserId.',
      },
      CreateInviteInput: {
        type: 'object',
        required: ['username', 'role'],
        properties: {
          username: { type: 'string' },
          role: { type: 'string', enum: ['MODERATOR', 'ADMIN'] },
        },
      },
      ChangeRoleInput: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { $ref: '#/components/schemas/Role' },
        },
      },
      BannedState: {
        type: 'object',
        properties: { banned: { type: 'boolean' } },
      },
    },
  },
  paths: {
    // -- auth ---------------------------------------------------------------
    '/auth/register': {
      post: {
        tags: ['auth'],
        summary: 'Register a new account (sends a verification email)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('RegisterInput') } },
        },
        responses: {
          201: jsonResponse('Registered', ref('Message_')),
          400: errorResponse('Validation failed'),
          409: errorResponse('Email or username already in use'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Log in with email + password',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('LoginInput') } },
        },
        responses: {
          200: jsonResponse('Logged in', ref('AuthToken')),
          401: errorResponse('Invalid credentials'),
          403: errorResponse('Email not verified yet'),
        },
      },
    },
    '/auth/verify-email': {
      get: {
        tags: ['auth'],
        summary: 'Verify an email address using the emailed token',
        parameters: [
          {
            name: 'token',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: jsonResponse('Verified', ref('Message_')),
          400: errorResponse('Invalid or expired verification link'),
        },
      },
    },
    '/auth/resend-verification': {
      post: {
        tags: ['auth'],
        summary: 'Request a fresh verification email',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Generic acknowledgement', ref('Message_')),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['auth'],
        summary: 'Revoke the current access token',
        security: bearerAuth,
        responses: {
          204: { description: 'Logged out' },
          401: errorResponse('Unauthorized'),
        },
      },
    },
    '/auth/google': {
      get: {
        tags: ['auth'],
        summary: 'Start the Google OAuth flow (redirects to Google)',
        responses: { 302: { description: 'Redirect to Google consent page' } },
      },
    },
    '/auth/google/callback': {
      get: {
        tags: ['auth'],
        summary: 'Google OAuth callback (Google redirects here)',
        parameters: [
          {
            name: 'code',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: jsonResponse('Logged in via Google', ref('AuthToken')),
          401: errorResponse('OAuth exchange failed'),
        },
      },
    },

    // -- users --------------------------------------------------------------
    '/users/me': {
      get: {
        tags: ['users'],
        summary: "Current user's own profile",
        security: bearerAuth,
        responses: {
          200: jsonResponse('Profile', ref('Me')),
          401: errorResponse('Unauthorized'),
        },
      },
      patch: {
        tags: ['users'],
        summary: 'Update username / bio',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('UpdateUserInput') } },
        },
        responses: {
          200: jsonResponse('Updated profile', ref('Me')),
          409: errorResponse('Username already taken'),
        },
      },
      delete: {
        tags: ['users'],
        summary: 'Delete the account and all its content',
        security: bearerAuth,
        responses: { 204: { description: 'Account deleted' } },
      },
    },
    '/users/me/avatar': {
      post: {
        tags: ['users'],
        summary: 'Upload a profile picture',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  avatar: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Updated profile', ref('Me')),
          400: errorResponse('Missing or invalid image'),
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['users'],
        summary: "A user's public profile",
        parameters: [idParam('id', 'User id')],
        responses: {
          200: jsonResponse('Profile', ref('PublicUser')),
          404: errorResponse('User not found'),
        },
      },
    },

    // -- posts --------------------------------------------------------------
    '/posts': {
      get: {
        tags: ['posts'],
        summary: 'List posts (optionally filtered)',
        parameters: [
          {
            name: 'category',
            in: 'query',
            required: false,
            schema: ref('Category'),
          },
          {
            name: 'authorId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: { 200: jsonResponse('Posts, newest first', arrayOf('Post')) },
      },
      post: {
        tags: ['posts'],
        summary: 'Publish a tutorial (multipart with up to 5 images)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'category', 'materials', 'steps'],
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: ref('Category'),
                  materials: {
                    type: 'string',
                    description: 'JSON array, e.g. ["yarn","hook"]',
                  },
                  steps: {
                    type: 'string',
                    description: 'JSON array, e.g. ["Chain 20","..."]',
                  },
                  images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'category', 'materials', 'steps'],
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: ref('Category'),
                  materials: { type: 'array', items: { type: 'string' } },
                  steps: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Created post', ref('Post')),
          400: errorResponse('Validation failed'),
          401: errorResponse('Unauthorized'),
        },
      },
    },
    '/posts/{id}': {
      get: {
        tags: ['posts'],
        summary: 'Post detail (does not bump the view counter)',
        parameters: [idParam('id', 'Post id')],
        responses: {
          200: jsonResponse('Post', ref('Post')),
          404: errorResponse('Post not found'),
        },
      },
      patch: {
        tags: ['posts'],
        summary: 'Edit a post (owner only)',
        security: bearerAuth,
        parameters: [idParam('id', 'Post id')],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('UpdatePostInput') } },
        },
        responses: {
          200: jsonResponse('Updated post', ref('Post')),
          403: errorResponse('Not the owner'),
          404: errorResponse('Post not found'),
        },
      },
      delete: {
        tags: ['posts'],
        summary: 'Delete a post (owner only)',
        security: bearerAuth,
        parameters: [idParam('id', 'Post id')],
        responses: {
          204: { description: 'Deleted' },
          403: errorResponse('Not the owner'),
          404: errorResponse('Post not found'),
        },
      },
    },
    '/posts/{id}/view': {
      post: {
        tags: ['posts'],
        summary: 'Count one view of a post',
        parameters: [idParam('id', 'Post id')],
        responses: {
          200: jsonResponse('New total', {
            type: 'object',
            properties: { views: { type: 'integer' } },
          }),
          404: errorResponse('Post not found'),
        },
      },
    },

    // -- comments -----------------------------------------------------------
    '/comments': {
      get: {
        tags: ['comments'],
        summary: 'Comments on a post, oldest first',
        parameters: [
          {
            name: 'postId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { 200: jsonResponse('Comments', arrayOf('Comment')) },
      },
      post: {
        tags: ['comments'],
        summary: 'Comment on a post',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['postId', 'content'],
                properties: {
                  postId: { type: 'string' },
                  content: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Created comment', ref('Comment')),
          404: errorResponse('Post not found'),
        },
      },
    },
    '/comments/{id}': {
      delete: {
        tags: ['comments'],
        summary: 'Delete a comment (owner only)',
        security: bearerAuth,
        parameters: [idParam('id', 'Comment id')],
        responses: {
          204: { description: 'Deleted' },
          403: errorResponse('Not the owner'),
          404: errorResponse('Comment not found'),
        },
      },
    },

    // -- likes / saves ------------------------------------------------------
    '/likes/{postId}': {
      get: {
        tags: ['likes'],
        summary: 'Who liked a post',
        parameters: [idParam('postId', 'Post id')],
        responses: { 200: jsonResponse('Users', arrayOf('UserSummary')) },
      },
      post: {
        tags: ['likes'],
        summary: 'Toggle like / unlike',
        security: bearerAuth,
        parameters: [idParam('postId', 'Post id')],
        responses: {
          200: jsonResponse('New state', {
            type: 'object',
            properties: { liked: { type: 'boolean' } },
          }),
          404: errorResponse('Post not found'),
        },
      },
    },
    '/saves/mine': {
      get: {
        tags: ['saves'],
        summary: "The current user's saved posts",
        security: bearerAuth,
        responses: { 200: jsonResponse('Saves', arrayOf('Save')) },
      },
    },
    '/saves/{postId}': {
      post: {
        tags: ['saves'],
        summary: 'Toggle save / unsave',
        security: bearerAuth,
        parameters: [idParam('postId', 'Post id')],
        responses: {
          200: jsonResponse('New state', {
            type: 'object',
            properties: { saved: { type: 'boolean' } },
          }),
          404: errorResponse('Post not found'),
        },
      },
    },

    // -- follows ------------------------------------------------------------
    '/follows/{userId}': {
      post: {
        tags: ['follows'],
        summary: 'Toggle follow / unfollow',
        security: bearerAuth,
        parameters: [idParam('userId', 'User to (un)follow')],
        responses: {
          200: jsonResponse('New state', {
            type: 'object',
            properties: { following: { type: 'boolean' } },
          }),
          400: errorResponse('Cannot follow yourself'),
          404: errorResponse('User not found'),
        },
      },
    },
    '/follows/{userId}/followers': {
      get: {
        tags: ['follows'],
        summary: 'Who follows this user',
        parameters: [idParam('userId', 'User id')],
        responses: { 200: jsonResponse('Users', arrayOf('UserSummary')) },
      },
    },
    '/follows/{userId}/following': {
      get: {
        tags: ['follows'],
        summary: 'Who this user follows',
        parameters: [idParam('userId', 'User id')],
        responses: { 200: jsonResponse('Users', arrayOf('UserSummary')) },
      },
    },

    // -- messages -----------------------------------------------------------
    '/messages': {
      get: {
        tags: ['messages'],
        summary: 'Inbox — latest message per conversation',
        security: bearerAuth,
        responses: { 200: jsonResponse('Messages', arrayOf('ChatMessage')) },
      },
      post: {
        tags: ['messages'],
        summary: 'Send a direct message',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['receiverId', 'content'],
                properties: {
                  receiverId: { type: 'string' },
                  content: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Sent message', ref('ChatMessage')),
          400: errorResponse('Cannot message yourself'),
          404: errorResponse('Recipient not found'),
        },
      },
    },
    '/messages/{userId}': {
      get: {
        tags: ['messages'],
        summary: 'Full thread with one user',
        security: bearerAuth,
        parameters: [idParam('userId', 'The other user')],
        responses: { 200: jsonResponse('Messages', arrayOf('ChatMessage')) },
      },
    },

    // -- notifications --------------------------------------------------------
    '/notifications': {
      get: {
        tags: ['notifications'],
        summary: "The current user's notifications (aggregated)",
        security: bearerAuth,
        responses: {
          200: jsonResponse('Notifications', arrayOf('Notification')),
        },
      },
    },
    '/notifications/{id}/read': {
      patch: {
        tags: ['notifications'],
        summary: 'Mark one notification read',
        security: bearerAuth,
        parameters: [idParam('id', 'Notification id')],
        responses: {
          204: { description: 'Marked read' },
          403: errorResponse('Not your notification'),
          404: errorResponse('Notification not found'),
        },
      },
    },
    '/notifications/read-all': {
      post: {
        tags: ['notifications'],
        summary: 'Mark all notifications read',
        security: bearerAuth,
        responses: { 204: { description: 'All marked read' } },
      },
    },

    // -- reports (any logged-in user) ---------------------------------------
    '/reports': {
      post: {
        tags: ['reports'],
        summary: 'Report a post or a profile',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('CreateReportInput') } },
        },
        responses: {
          201: jsonResponse('Report submitted', ref('Message_')),
          400: errorResponse('Must target exactly one of post/profile'),
          404: errorResponse('Target not found'),
        },
      },
    },

    // -- staff invites, from the invitee's side -----------------------------
    '/users/me/invite': {
      get: {
        tags: ['admin'],
        summary: "The current user's pending staff invite (or null)",
        security: bearerAuth,
        responses: { 200: jsonResponse('Invite or null', ref('Invite')) },
      },
    },
    '/users/me/invite/accept': {
      post: {
        tags: ['admin'],
        summary: 'Accept the pending invite and adopt the offered role',
        security: bearerAuth,
        responses: {
          200: jsonResponse('New role', {
            type: 'object',
            properties: { role: ref('Role') },
          }),
          404: errorResponse('No pending invite'),
        },
      },
    },
    '/users/me/invite/reject': {
      post: {
        tags: ['admin'],
        summary: 'Decline the pending invite',
        security: bearerAuth,
        responses: {
          204: { description: 'Declined' },
          404: errorResponse('No pending invite'),
        },
      },
    },

    // -- admin / moderation (staff only) ------------------------------------
    '/admin/staff': {
      get: {
        tags: ['admin'],
        summary: 'List the staff team (admins + moderators) — staff',
        security: bearerAuth,
        responses: {
          200: jsonResponse('Staff', arrayOf('StaffMember')),
          403: errorResponse('Staff only'),
        },
      },
    },
    '/admin/reports': {
      get: {
        tags: ['admin'],
        summary: 'List reports — staff',
        security: bearerAuth,
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['PENDING', 'RESOLVED', 'DISMISSED'] },
          },
        ],
        responses: { 200: jsonResponse('Reports', arrayOf('Report')) },
      },
    },
    '/admin/reports/{id}': {
      patch: {
        tags: ['admin'],
        summary: 'Resolve or dismiss a report — staff',
        security: bearerAuth,
        parameters: [idParam('id', 'Report id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['RESOLVED', 'DISMISSED'] },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Updated report', ref('Report')),
          404: errorResponse('Report not found'),
        },
      },
    },
    '/admin/posts/{id}/ban': {
      post: {
        tags: ['admin'],
        summary: 'Ban (hide) a post — staff',
        security: bearerAuth,
        parameters: [idParam('id', 'Post id')],
        responses: {
          200: jsonResponse('New state', ref('BannedState')),
          404: errorResponse('Post not found'),
        },
      },
    },
    '/admin/posts/{id}/unban': {
      post: {
        tags: ['admin'],
        summary: 'Unban (restore) a post — staff',
        security: bearerAuth,
        parameters: [idParam('id', 'Post id')],
        responses: {
          200: jsonResponse('New state', ref('BannedState')),
          404: errorResponse('Post not found'),
        },
      },
    },
    '/admin/users/{id}/ban': {
      post: {
        tags: ['admin'],
        summary: 'Ban (suspend) a profile — staff; only admins may ban a moderator',
        security: bearerAuth,
        parameters: [idParam('id', 'User id')],
        responses: {
          200: jsonResponse('New state', ref('BannedState')),
          403: errorResponse('Cannot ban that user'),
          404: errorResponse('User not found'),
        },
      },
    },
    '/admin/users/{id}/unban': {
      post: {
        tags: ['admin'],
        summary: 'Unban (restore) a profile — staff',
        security: bearerAuth,
        parameters: [idParam('id', 'User id')],
        responses: {
          200: jsonResponse('New state', ref('BannedState')),
          404: errorResponse('User not found'),
        },
      },
    },
    '/admin/invites': {
      get: {
        tags: ['admin'],
        summary: 'List pending invites — admin',
        security: bearerAuth,
        responses: { 200: jsonResponse('Invites', arrayOf('Invite')) },
      },
      post: {
        tags: ['admin'],
        summary: 'Invite a user to the staff team — admin',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('CreateInviteInput') } },
        },
        responses: {
          201: jsonResponse('Invite created', ref('Invite')),
          404: errorResponse('No user with that username'),
          409: errorResponse('Already has that role'),
        },
      },
    },
    '/admin/invites/{id}': {
      delete: {
        tags: ['admin'],
        summary: 'Cancel a pending invite — admin',
        security: bearerAuth,
        parameters: [idParam('id', 'Invite id')],
        responses: {
          204: { description: 'Cancelled' },
          404: errorResponse('Invite not found'),
        },
      },
    },
    '/admin/staff/{userId}/role': {
      patch: {
        tags: ['admin'],
        summary: "Change a member's role — admin",
        security: bearerAuth,
        parameters: [idParam('userId', 'User id')],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('ChangeRoleInput') } },
        },
        responses: {
          200: jsonResponse('Updated member', ref('StaffMember')),
          400: errorResponse('Cannot change your own role'),
          404: errorResponse('User not found'),
        },
      },
    },
    '/admin/staff/{userId}': {
      delete: {
        tags: ['admin'],
        summary: 'Remove a member from the team (demote to user) — admin',
        security: bearerAuth,
        parameters: [idParam('userId', 'User id')],
        responses: {
          204: { description: 'Removed' },
          400: errorResponse('Cannot remove yourself'),
          404: errorResponse('User not found'),
        },
      },
    },
  },
};

export default openapiDocument;
