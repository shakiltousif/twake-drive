import { Request, Response } from 'express';
import logger from '@/lib/logger';
import onlyofficeService, { Callback, CommandError, ErrorCode } from '@/services/onlyoffice.service';
import driveService from '@/services/drive.service';

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
   *
   * @returns
   *   - `{ status: 'updated' }`: the key needed updating but is now invalid
   *   - `{ status: 'expired' }`: the key can't be used (it is verified unknown)
   *   - `{ status: 'live' }`:    the key is valid and current and should be used again for the same file
   *   - `{ error: number }`:     there was an error retreiving the status of the key, http status `!= 200`
   */
  public async checkSessionStatus(req: Request<RequestQuery>, res: Response): Promise<void> {
    //TODO: check there is auth from backend before this is ran

    // have to get forgotten first, if it's there it's definitive,
    // but if we paralelise it risks calling the callback
    try {
      const forgottenURL = await onlyofficeService.getForgotten(req.params.editing_session_key);
      // Run upload before returning
      return void res.send({ status: 'updated' });
    } catch (e) {
      if (!(e instanceof CommandError && e.errorCode == ErrorCode.KEY_MISSING_OR_DOC_NOT_FOUND)) {
        logger.error(`getForgotten failed`, e);
        return void res.status(e instanceof CommandError ? 502 : 500).send({ error: -51 });
      }
    }
    const info = await onlyofficeService.getInfoAndWaitForCallbackUnsafe(req.params.editing_session_key);
    if (info.error === ErrorCode.KEY_MISSING_OR_DOC_NOT_FOUND) {
      // just cancel it
      return void res.send({ status: 'expired' });
    }
    if (info.error !== undefined) {
      logger.error(`getInfo failed`, { error: info });
      return void res.status(502).send({ error: -52 });
    }
    switch (info.result.status) {
      case Callback.Status.BEING_EDITED:
      case Callback.Status.BEING_EDITED_BUT_IS_SAVED:
        // use it as is
        return void res.send({ status: 'live' });

      case Callback.Status.CLOSED_WITHOUT_CHANGES:
        // just cancel it
        return void res.send({ status: 'expired' });

      case Callback.Status.ERROR_FORCE_SAVING:
      case Callback.Status.ERROR_SAVING:
        return void res.status(502).send({ error: info.result.status });

      case Callback.Status.READY_FOR_SAVING:
        // upload it, have to do it here for correct user stored in url in OO
        //TODO: Need to fix so company_id is not needed by ooconnector but parsed from key server side
        await driveService.endEditing(req.params.editing_session_key, info.result.url);
        return void res.send({ status: 'updated' });

      default:
        throw new Error(`Unexpected callback status: ${JSON.stringify(info.result)}`);
    }
  }
}
