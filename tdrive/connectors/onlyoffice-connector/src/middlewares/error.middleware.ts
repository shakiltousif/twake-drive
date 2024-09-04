import logger from '@/lib/logger';
import { NextFunction, Request, Response } from 'express';
import { makeURLTo } from '@/routes';

export default (error: Error & { status?: number }, req: Request, res: Response, next: NextFunction): void => {
  try {
    const status: number = error.status || 500;
    const message: string = error.message || 'Something went wrong';

    logger.error(`[${req.method}] ${req.path} >> StatusCode:: ${status}, Message:: ${message}`, error.stack);

    res.status(status);
    res.render('error', {
      server: makeURLTo.rootAbsolute(),
      errorMessage: message,
    });
  } catch (error) {
    next(error);
  }
};
