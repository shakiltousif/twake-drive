import IndexController from '@/controllers/index.controller';
import { Routes } from '@/interfaces/routes.interface';
import authMiddleware from '@/middlewares/auth.middleware';
import requirementsMiddleware from '@/middlewares/requirements.middleware';
import { Router } from 'express';
import { SERVER_PREFIX } from '@config';

/**
 * When the user previews or edits a file in Twake Drive, their browser is sent to these routes
 * which return a webpage that instantiates the client side JS Only Office component.
 */
class IndexRoute implements Routes {
  public path = SERVER_PREFIX;
  public router = Router();
  public indexController: IndexController;

  constructor() {
    this.indexController = new IndexController();
    this.initRoutes();
  }

  private initRoutes = () => {
    this.router.get('/', requirementsMiddleware, authMiddleware, this.indexController.index);
    this.router.get('/editor', requirementsMiddleware, authMiddleware, this.indexController.editor);
  };
}

export default IndexRoute;
