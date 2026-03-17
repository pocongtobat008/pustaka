import express from 'express';
import { checkAuth } from '../middleware/auth.js';
import {
    getNotifications,
    createNotification,
    markNotificationRead,
    markAllNotificationsRead
} from '../controllers/notificationController.js';

const router = express.Router();
router.use(checkAuth);

router.get('/notifications', getNotifications);
router.post('/notifications', createNotification);
router.post('/notifications/read-all', markAllNotificationsRead);
router.post('/notifications/:id/read', markNotificationRead);

export default router;
