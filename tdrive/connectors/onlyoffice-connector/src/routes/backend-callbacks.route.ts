import TwakeDriveBackendCallbackController from '@/controllers/backend-callbacks.controller';
import { Routes } from '@/interfaces/routes.interface';
import authMiddleware from '@/middlewares/auth.middleware';
import { Router } from 'express';

/**
 * These routes are called by Twake Drive backend, for ex. before editing or retreiving a file,
 * if it has an editing_session_key still, get the status of that and force a resolution.
 */
export default class TwakeDriveBackendCallbackRoutes implements Routes {
  public readonly router = Router();
  public readonly path = '/tdriveApi/1';
  private readonly controller: TwakeDriveBackendCallbackController;

  constructor() {
    this.controller = new TwakeDriveBackendCallbackController();
    // Why post ? to garantee it is never cached and always ran
    this.router.post('/session/:editing_session_key/check', authMiddleware, this.controller.checkSessionStatus);
    this.router.delete('/session/:editing_session_key', authMiddleware, this.controller.deleteSessionKey);
  }
}
