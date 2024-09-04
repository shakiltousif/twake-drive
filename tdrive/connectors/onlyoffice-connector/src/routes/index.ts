import { Application, Router } from 'express';

import * as Utils from '@/utils';

import { TwakeDriveBackendCallbackRoutes } from './backend-callbacks.route';
import { BrowserEditorRoutes } from './browser-editor.route';
import { OnlyOfficeRoutes } from './onlyoffice.route';

import { SERVER_ORIGIN, SERVER_PREFIX, SERVER_TDRIVE_API_PREFIX } from '@config';

export function mountRoutes(app: Application) {
  // These routes are forwarded through the Twake Drive front, back and here
  const proxiedRouter = Router();
  BrowserEditorRoutes.mount(proxiedRouter);
  OnlyOfficeRoutes.mount(proxiedRouter);
  console.log('Mounting at ' + SERVER_PREFIX);
  app.use(SERVER_PREFIX, proxiedRouter);

  // These endpoints should only be accessible to the Twake Drive backend
  const apiRouter = Router();
  console.log('Mounting at ' + SERVER_TDRIVE_API_PREFIX);
  TwakeDriveBackendCallbackRoutes.mount(apiRouter);
  app.use(SERVER_TDRIVE_API_PREFIX, apiRouter);
}

export const makeURLTo = {
  rootAbsolute: () => Utils.joinURL([SERVER_ORIGIN, SERVER_PREFIX]),
  assets: () => Utils.joinURL([SERVER_PREFIX, 'assets']),
  editorAbsolute(params: { token: string; file_id: string; editing_session_key: string; company_id: string; preview: string; office_token: string }) {
    return Utils.joinURL([SERVER_ORIGIN ?? '', SERVER_PREFIX, 'editor'], params);
  },
};

// export function makeURLToEditor2() {
//   const initResponse = await editorService.init(company_id, file_name, file_id, user, preview, drive_file_id || file_id);

//   res.render('index', {
//     ...initResponse,
//     docId: preview ? file_id : editing_session_key,
//     server: Utils.joinURL([SERVER_ORIGIN, SERVER_PREFIX]),
//     token: inPageToken,
//   });
// }
