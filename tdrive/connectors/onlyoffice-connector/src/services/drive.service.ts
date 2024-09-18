import { DriveFileType, IDriveService } from '@/interfaces/drive.interface';
import apiService from './api.service';
import logger from '../lib/logger';
import { Stream } from 'stream';
import FormData from 'form-data';
import { INSTANCE_ID } from '@/config';

/** Thrown when Twake Drive returns a 404 for a key */
export class UnknownKeyInDriveError extends Error {}

/**
 * Client for Twake Drive's APIs dealing with `DriveItem`s, using {@see apiService}
 * to handle authorization
 */
class DriveService implements IDriveService {
  public get = async (params: { company_id: string; drive_file_id: string; user_token?: string }): Promise<DriveFileType> => {
    try {
      const { company_id, drive_file_id } = params;
      const resource = await apiService.get<DriveFileType>({
        url: `/internal/services/documents/v1/companies/${company_id}/item/${drive_file_id}`,
        token: params.user_token,
      });

      return resource;
    } catch (error) {
      logger.error('Failed to fetch file metadata: ', error.stack);

      return Promise.reject();
    }
  };

  public createVersion = async (params: {
    company_id: string;
    drive_file_id: string;
    file_id: string;
  }): Promise<DriveFileType['item']['last_version_cache']> => {
    try {
      const { company_id, drive_file_id, file_id } = params;
      return await apiService.post<{}, DriveFileType['item']['last_version_cache']>({
        url: `/internal/services/documents/v1/companies/${company_id}/item/${drive_file_id}/version`,
        payload: {
          drive_item_id: drive_file_id,
          provider: 'internal',
          file_metadata: {
            external_id: file_id,
            source: 'internal',
          },
        },
      });
    } catch (error) {
      logger.error('Failed to create version: ', error.stack);
      return Promise.reject();
    }
  };

  public async beginEditingSession(company_id: string, drive_file_id: string, user_token?: string) {
    try {
      const resource = await apiService.post<{}, { editingSessionKey: string }>({
        url: `/internal/services/documents/v1/companies/${company_id}/item/${drive_file_id}/editing_session`,
        token: user_token,
        payload: {
          editorApplicationId: 'tdrive_onlyoffice',
          appInstanceId: INSTANCE_ID ?? '',
        },
      });
      if (resource?.editingSessionKey) {
        return resource.editingSessionKey;
      } else {
        throw new Error(`Failed to obtain editing session key, response: ${JSON.stringify(resource)}`);
      }
    } catch (error) {
      logger.error('Failed to begin editing session: ', error.stack);
      throw error;
    }
  }

  public async cancelEditing(editing_session_key: string) {
    try {
      await apiService.delete<{}>({
        url: `/internal/services/documents/v1/editing_session/${encodeURIComponent(editing_session_key)}`,
      });
    } catch (error) {
      logger.error('Failed to begin editing session: ', error.stack);
      throw error;
      //TODO make monitoring for such kind of errors
    }
  }

  public async addEditingSessionVersion(editing_session_key: string, url: string, user_token?: string) {
    return this.updateEditing(editing_session_key, url, true, user_token);
  }

  public async endEditing(editing_session_key: string, url: string, user_token?: string) {
    return this.updateEditing(editing_session_key, url, false, user_token);
  }

  private async updateEditing(editing_session_key: string, url: string, keepEditing: boolean, user_token?: string) {
    try {
      if (!url) {
        throw Error('no url found');
      }
      //TODO: It would be better to avoid two requests for this operation
      const originalFile = await this.getByEditingSessionKey({ editing_session_key });

      if (!originalFile) {
        // TODO: Make a single request and don't require the filename at all
        //   then in POST /editing_session/... if the key is not found, just
        //   put it in a users or company "lost and found" folder.
        //   and accept without error. Because really, if backend doesn't know
        //   the key anymore, there's not much we can do, and we should get OO
        //   to clean up and stop trying to upload it.
        //   but for today:
        logger.error("Forgotten OO document that Twake Drive doesn't know the key of.", { editing_session_key, url });
        throw new UnknownKeyInDriveError(`Unknown key ${JSON.stringify(editing_session_key)}`);
        // TODO: Distinguish this case from a long disconnected browser tab waking up
      }

      const newFile = await apiService.get<Stream>({
        url,
        responseType: 'stream',
      });

      const form = new FormData();

      const filename = encodeURIComponent(originalFile.last_version_cache.file_metadata.name);

      form.append('file', newFile, {
        filename,
      });

      logger.info('Saving file version to Twake Drive: ', filename);

      const queryString = keepEditing ? '?keepEditing=true' : '';

      await apiService.post({
        url: `/internal/services/documents/v1/editing_session/${encodeURIComponent(editing_session_key)}` + queryString,
        payload: form,
        token: user_token,
        headers: form.getHeaders(),
      });
    } catch (error) {
      logger.error('Failed to end editing session: ', error.stack);
      throw error;
      //TODO make monitoring for such kind of errors
    }
  }

  /**
   * Get the document information by the editing session key. Just simple call to the drive API
   * /item/editing_session/${editing_session_key}
   * @param params
   * @returns null if the key was not found, or the api response body
   */
  public getByEditingSessionKey = async (params: { editing_session_key: string; user_token?: string }): Promise<DriveFileType['item']> => {
    try {
      const { editing_session_key } = params;
      return await apiService.get<DriveFileType['item']>({
        url: `/internal/services/documents/v1/editing_session/${encodeURIComponent(editing_session_key)}`,
        token: params.user_token,
      });
    } catch (error) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  };
}

export default new DriveService();
