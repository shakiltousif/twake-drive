// File src/services/synchronization/api.ts
import { TdriveServiceProvider } from "../../core/platform/framework/api";

export default interface WebDAVServiceAPI extends TdriveServiceProvider {
  /**
   * Sync a local folder with the server
   */
  syncFolder(localPath: string): Promise<void>;
}
