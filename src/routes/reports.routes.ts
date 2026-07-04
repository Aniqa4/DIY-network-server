import { Router } from 'express';
import * as controller from '../controllers/reports.controller';
import { requireAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { createReportSchema } from '../validators/schemas';

const router = Router();

// Any logged-in user can file a report.
router.post('/', requireAuth, validate(createReportSchema), controller.create);

export default router;
