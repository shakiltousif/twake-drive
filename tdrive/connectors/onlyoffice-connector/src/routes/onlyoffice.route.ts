import OnlyOfficeController from '@/controllers/onlyoffice.controller';
import { Routes } from '@/interfaces/routes.interface';
import requirementsMiddleware from '@/middlewares/requirements.middleware';
import { Router } from 'express';
import { SERVER_PREFIX } from '@config';

class OnlyOfficeRoute implements Routes {
  public path = SERVER_PREFIX;
  public router = Router();
  public onlyOfficeController: OnlyOfficeController;

  constructor() {
    this.onlyOfficeController = new OnlyOfficeController();
    this.initRoutes();
  }

  private initRoutes = () => {
    this.router.get(`:mode/read`, requirementsMiddleware, this.onlyOfficeController.read);
    this.router.post(`:mode/callback`, requirementsMiddleware, this.onlyOfficeController.ooCallback);
  };
}

export default OnlyOfficeRoute;
