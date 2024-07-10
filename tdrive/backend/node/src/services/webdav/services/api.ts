// File: src/services/webdav/services/api.ts
import WebDAVServiceAPI from "../api";

/*
 * 
 */
export class WebDAVServiceImpl implements WebDAVServiceAPI {
  version = "1";

  async syncFolder(localPath: string): Promise<void> {
    console.log('WebDAVServiceImpl::syncFolder() -> is called');
    return Promise.resolve();
  }
}
