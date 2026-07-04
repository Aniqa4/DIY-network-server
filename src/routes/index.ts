import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import openapiDocument from '../docs/openapi';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import postsRoutes from './posts.routes';
import commentsRoutes from './comments.routes';
import likesRoutes from './likes.routes';
import savesRoutes from './saves.routes';
import followsRoutes from './follows.routes';
import messagesRoutes from './messages.routes';
import notificationsRoutes from './notifications.routes';
import reportsRoutes from './reports.routes';
import adminRoutes from './admin.routes';

const router = Router();

// Friendly landing response for the bare base URL.
router.get('/', (req, res) => {
  res.json({
    name: 'DIY Network API',
    docs: '/api/v1/docs',
    health: '/api/v1/health',
    resources: [
      '/api/v1/auth',
      '/api/v1/users',
      '/api/v1/posts',
      '/api/v1/comments',
      '/api/v1/likes',
      '/api/v1/saves',
      '/api/v1/follows',
      '/api/v1/messages',
      '/api/v1/notifications',
    ],
  });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Interactive API docs (Swagger UI) + the raw OpenAPI document.
router.get('/docs.json', (req, res) => {
  res.json(openapiDocument);
});
router.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiDocument, { customSiteTitle: 'DIY Network API Docs' }),
);

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/posts', postsRoutes);
router.use('/comments', commentsRoutes);
router.use('/likes', likesRoutes);
router.use('/saves', savesRoutes);
router.use('/follows', followsRoutes);
router.use('/messages', messagesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/reports', reportsRoutes);
router.use('/admin', adminRoutes);

export default router;
