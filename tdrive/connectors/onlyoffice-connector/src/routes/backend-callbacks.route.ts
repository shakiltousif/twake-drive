import TwakeDriveBackendCallbackController from '@/controllers/backend-callbacks.controller';
import authMiddleware from '@/middlewares/auth.middleware';
import type { Router } from 'express';

/**
 * These routes are called by Twake Drive backend, for ex. before editing or retreiving a file,
 * if it has an editing_session_key still, get the status of that and force a resolution.
 */
export const TwakeDriveBackendCallbackRoutes = {
  mount(router: Router) {
    const controller = new TwakeDriveBackendCallbackController();
    // Why post ? to garantee it is never cached and always ran
    router.post('/session/:editing_session_key/check', authMiddleware, controller.checkSessionStatus);
    router.delete('/session/:editing_session_key', authMiddleware, controller.deleteSessionKey);
  },
};
