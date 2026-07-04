import { Router } from 'express';
import * as admin from '../controllers/admin.controller';
import * as reports from '../controllers/reports.controller';
import { requireAuth, requireStaff, requireAdmin } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  createInviteSchema,
  changeRoleSchema,
  resolveReportSchema,
} from '../validators/schemas';

const router = Router();

// Everything here requires a logged-in staff member at minimum.
router.use(requireAuth, requireStaff);

// Staff roster — visible to all staff.
router.get('/staff', admin.listStaff);

// Reports queue — staff can view and resolve.
router.get('/reports', reports.findAll);
router.patch('/reports/:id', validate(resolveReportSchema), reports.resolve);

// Ban / unban content and profiles — staff.
router.post('/posts/:id/ban', admin.setPostBanned(true));
router.post('/posts/:id/unban', admin.setPostBanned(false));
router.post('/users/:id/ban', admin.setUserBanned(true));
router.post('/users/:id/unban', admin.setUserBanned(false));

// Member management — admin only.
router.get('/invites', requireAdmin, admin.listInvites);
router.post('/invites', requireAdmin, validate(createInviteSchema), admin.createInvite);
router.delete('/invites/:id', requireAdmin, admin.cancelInvite);
router.patch('/staff/:userId/role', requireAdmin, validate(changeRoleSchema), admin.changeRole);
router.delete('/staff/:userId', requireAdmin, admin.removeMember);

export default router;
