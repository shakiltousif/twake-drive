import { NextFunction, Request, Response } from 'express';
import logger from '@/lib/logger';
import onlyofficeService, { CommandError, ErrorCode } from '@/services/onlyoffice.service';

interface RequestQuery {
  editing_session_key: string;
}

async function ignoreMissingKeyErrorButNoneElse(res: Response, call: () => Promise<void>): Promise<void> {
  try {
    await call();
  } catch (e) {
    if (e instanceof CommandError && e.errorCode == ErrorCode.KEY_MISSING_OR_DOC_NOT_FOUND) {
      return void (await res.send({ info: 'Unknown editing_session_key' }));
    }
    logger.error('Running OO command for TDrive backend', e);
    return void (await res.sendStatus(500));
  }
}

/**
 * These routes are called by Twake Drive backend, for ex. before editing or retreiving a file,
 * if it has an editing_session_key still, get the status of that and force a resolution.
 */
export default class TwakeDriveBackendCallbackController {
  /**
   * Get status of an `editing_session_key` from OO, and return a URL to get the latest version,
   * or an object with no `url` property, in which case the key is not known as forgotten by OO and should
   * be considered lost after an admin alert.
   */
  public async checkSessionStatus(req: Request<RequestQuery>, res: Response): Promise<void> {
    //TODO: Find a way to check if the key is live (`info` uses the callback url)
    await ignoreMissingKeyErrorButNoneElse(res, async () => {
      await res.send({ url: await onlyofficeService.getForgotten(req.params.editing_session_key) });
    });
  }

  /**
   * Force deletion of the provided `editing_session_key` in the OO document server.
   * If the key was succesfully deleted, the `done` property in the response body will be true.
   */
  public async deleteSessionKey(req: Request<RequestQuery>, res: Response): Promise<void> {
    await ignoreMissingKeyErrorButNoneElse(res, async () => {
      await onlyofficeService.deleteForgotten(req.params.editing_session_key);
      await res.send({ done: true });
    });
  }
}
