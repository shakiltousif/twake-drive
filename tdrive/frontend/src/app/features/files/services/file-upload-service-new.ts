/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import { v1 as uuid } from 'uuid';

import JWTStorage from '@features/auth/jwt-storage-service';
import { FileType, PendingFileType } from '@features/files/types/file';
import Resumable from '@features/files/utils/resumable';
import Logger from '@features/global/framework/logger-service';
import RouterServices from '@features/router/services/router-service';
import _ from 'lodash';
import FileUploadAPIClient from '../api/file-upload-api-client';
import { isPendingFileStatusPending } from '../utils/pending-files';
import { FileTreeObject } from 'components/uploads/file-tree-utils';
import { DriveApiClient } from 'features/drive/api-client/api-client';
import { ToasterService } from 'app/features/global/services/toaster-service';
import Languages from 'app/features/global/services/languages-service';
import { DriveItem, DriveItemVersion } from 'app/features/drive/types';

export enum Events {
  ON_CHANGE = 'notify',
}

const logger = Logger.getLogger('Services/FileUploadService');
class FileUploadService {
  private isPaused = false;
  private isCancelled = false;
  private pendingFiles: PendingFileType[] = [];
  private GroupedPendingFiles: { [key: string]: PendingFileType[] } = {};
  private RootSizes: { [key: string]: number } = {};
  private GroupIds: { [key: string]: string } = {};
  public currentTaskId = '';
  private recoilHandler: Function = () => undefined;
  private rootRecoilHandler: Function = () => undefined;
  private logger: Logger.Logger = Logger.getLogger('FileUploadService');

  setRecoilHandler(handler: Function, rootHandler: Function) {
    this.recoilHandler = handler;
    this.rootRecoilHandler = rootHandler;
  }

  /**
   * Helper method to pause execution when `isPaused` is true.
   * @private
   */
  async _waitWhilePaused() {
    while (this.isPaused) {
      if (this.isCancelled) return;
      await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
    }
  }

  /**
   * Helper method to cancel execution when `isCancelled` is true.
   * @private
   */
  private async checkCancellation() {
    if (this.isCancelled) {
      logger.warn('Operation cancelled.');
      throw new Error('Upload process cancelled.');
    }
  }

  notify() {
    const updatedState = this.pendingFiles.map((f: PendingFileType) => {
      return {
        id: f.id,
        status: f.status,
        progress: f.progress,
        file: f.originalFile?.type,
      };
    });
    const updatedRootState = Object.keys(this.GroupedPendingFiles).reduce(
      (acc: any, key: string) => {
        // uploaded size
        const uploadedSize = this.GroupedPendingFiles[key]
          .map((f: PendingFileType) => {
            // if the file is successful and originalFile exists, add the size to the accumulator
            if (f.status === 'success' && f.originalFile?.size) {
              return f.originalFile.size;
            }
            return 0;
          })
          .reduce((acc: number, size: number) => acc + size, 0);
        // Add to the accumulator object
        acc[key] = {
          size: this.RootSizes[key],
          status: this.isPaused,
          items: [],
          uploadedSize,
        };
        return acc;
      },
      {},
    );
    this.recoilHandler(_.cloneDeep(updatedState));
    this.rootRecoilHandler(_.cloneDeep(updatedRootState));
  }

  public async createDirectories(
    root: FileTreeObject['tree'],
    context: { companyId: string; parentId: string },
  ) {
    // loop through the tree and determine root sizes and set it to the rootSizes object
    const traverser = (tree: FileTreeObject['tree']) => {
      for (const directory of Object.keys(tree)) {
        const root = tree[directory].root as string;
        if (tree[directory].file instanceof File) {
          // if root is not in the rootSizes object, add it
          if (!this.RootSizes[root] && !this.isCancelled) {
            this.RootSizes[root] = 0;
          }
          this.RootSizes[root] += (tree[directory].file as File).size;
        } else {
          traverser(tree[directory] as FileTreeObject['tree']);
        }
      }
    };
    traverser(root);
    // Create all directories
    const filesPerParentId: { [key: string]: { root: string; file: File }[] } = {};
    filesPerParentId[context.parentId] = [];
    const idsToBeRestored: string[] = [];

    const traverserTreeLevel = async (
      tree: FileTreeObject['tree'],
      parentId: string,
      tmp = false,
    ) => {
      // cancel upload
      if (this.isCancelled) return;

      // check if upload is paused
      await this._waitWhilePaused();

      // start descending the tree
      for (const directory of Object.keys(tree)) {
        await this.checkCancellation();
        await this._waitWhilePaused();
        if (tree[directory].file instanceof File && !this.isCancelled) {
          logger.trace(`${directory} is a file, save it for future upload`);
          filesPerParentId[parentId].push({
            root: tree[directory].root as string,
            file: tree[directory].file as File,
          });
        } else {
          logger.debug(`Create directory ${directory}`);

          const item = {
            company_id: context.companyId,
            parent_id: parentId,
            name: directory,
            is_directory: true,
          };

          if (!this.pendingFiles.some(f => isPendingFileStatusPending(f.status))) {
            //New upload task when all previous task is finished
            this.currentTaskId = uuid();
          }
          const pendingFile: PendingFileType = {
            id: uuid(),
            status: 'pending',
            progress: 0,
            lastProgress: new Date().getTime(),
            speed: 0,
            uploadTaskId: this.currentTaskId,
            originalFile: null,
            backendFile: null,
            resumable: null,
            label: directory,
            type: 'file',
            pausable: false,
          };

          try {
            const driveItem = await DriveApiClient.create(context.companyId, {
              item: item,
              version: {},
              tmp,
            });
            this.GroupIds[directory] = driveItem.id;
            this.logger.debug(`Directory ${directory} created`);
            pendingFile.status = 'success';
            this.notify();
            if (driveItem?.id) {
              filesPerParentId[driveItem.id] = [];
              if (tmp && idsToBeRestored.includes(driveItem.id)) idsToBeRestored.push(driveItem.id);
              await traverserTreeLevel(tree[directory] as FileTreeObject['tree'], driveItem.id);
            }
          } catch (e) {
            this.logger.error(e);
            throw new Error('Could not create directory');
          }
        }
      }
      // uploading the files goes here
      await this.upload(filesPerParentId[parentId], {
        context: {
          companyId: context.companyId,
          parentId: parentId,
        },
        callback: async (file, context) => {
          if (file) {
            const item = {
              company_id: context.companyId,
              workspace_id: 'drive', //We don't set workspace ID for now
              parent_id: context.parentId,
              name: file.metadata?.name,
              size: file.upload_data?.size,
            } as Partial<DriveItem>;
            const version = {
              provider: 'internal',
              application_id: '',
              file_metadata: {
                name: file.metadata?.name,
                size: file.upload_data?.size,
                mime: file.metadata?.mime,
                thumbnails: file?.thumbnails,
                source: 'internal',
                external_id: file.id,
              },
            } as Partial<DriveItemVersion>;
            const driveFile = await DriveApiClient.create(context.companyId, { item, version });
          }
        },
      });
    };

    // split the tree per root
    const rootKeys = Object.keys(root);
    const rootTrees = rootKeys.map(key => {
      return { [key]: root[key] };
    });

    // tree promises
    const treePromises = rootTrees.map(tree => {
      return traverserTreeLevel(tree, context.parentId, true);
    });

    try {
      await Promise.all(treePromises);
    } catch (error) {
      if (!this.isCancelled) {
        console.error('An error occurred while processing treePromises:', error);
        // Optionally, handle the error or rethrow it
        throw error; // Re-throw the error if necessary
      } else {
        console.warn('Operation was cancelled. Error ignored.');
      }
    }

    // await traverserTreeLevel(root, context.parentId, true);

    return { filesPerParentId, idsToBeRestored };
  }

  public async upload(
    fileList: { root: string; file: File }[],
    options?: {
      context?: any;
      callback?: (file: FileType | null, context: any) => void;
    },
  ): Promise<PendingFileType[]> {
    const { companyId } = RouterServices.getStateFromRoute();

    if (!fileList || !companyId) {
      this.logger.log('FileList or companyId is undefined', [fileList, companyId]);
      return [];
    }

    if (!this.pendingFiles.some(f => isPendingFileStatusPending(f.status))) {
      //New upload task when all previous task is finished
      this.currentTaskId = uuid();
    }

    for (const file of fileList) {
      if (!file.file) continue;

      const pendingFile: PendingFileType = {
        id: uuid(),
        status: 'pending',
        progress: 0,
        lastProgress: new Date().getTime(),
        speed: 0,
        uploadTaskId: this.currentTaskId,
        originalFile: file.file,
        backendFile: null,
        resumable: null,
        type: 'file',
        label: null,
        pausable: true,
      };

      this.pendingFiles.push(pendingFile);
      if (!this.GroupedPendingFiles[file.root]) {
        this.GroupedPendingFiles[file.root] = [];
      }
      this.GroupedPendingFiles[file.root].push(pendingFile);
      this.notify();

      // First we create the file object
      const resource = (
        await FileUploadAPIClient.upload(file.file, { companyId, ...(options?.context || {}) })
      )?.resource;

      if (!resource) {
        throw new Error('A server error occured');
      }

      pendingFile.backendFile = resource;
      this.notify();

      // Then we overwrite the file object with resumable
      pendingFile.resumable = this.getResumableInstance({
        target: FileUploadAPIClient.getRoute({
          companyId,
          fileId: pendingFile.backendFile.id,
          fullApiRouteUrl: true,
        }),
        query: {
          thumbnail_sync: 1,
        },
        headers: {
          Authorization: JWTStorage.getAutorizationHeader(),
        },
      });

      pendingFile.resumable.addFile(file.file);

      pendingFile.resumable.on('fileAdded', () => pendingFile.resumable.upload());

      pendingFile.resumable.on('fileProgress', (f: any) => {
        const bytesDelta =
          (f.progress() - pendingFile.progress) * (pendingFile?.originalFile?.size || 0);
        const timeDelta = new Date().getTime() - pendingFile.lastProgress;

        // To avoid jumping time ?
        if (timeDelta > 1000) {
          pendingFile.speed = bytesDelta / timeDelta;
        }

        pendingFile.backendFile = f;
        pendingFile.lastProgress = new Date().getTime();
        pendingFile.progress = f.progress();
        this.notify();
      });

      pendingFile.resumable.on('fileSuccess', (_f: any, message: string) => {
        try {
          pendingFile.backendFile = JSON.parse(message).resource;
          pendingFile.status = 'success';
          options?.callback?.(pendingFile.backendFile, options?.context || {});
          this.notify();
        } catch (e) {
          logger.error(`Error on fileSuccess Event`, e);
        }
      });

      pendingFile.resumable.on('fileError', () => {
        pendingFile.status = 'error';
        pendingFile.resumable.cancel();
        const intendedFilename =
          (pendingFile.originalFile || {}).name ||
          (pendingFile.backendFile || { metadata: {} }).metadata.name;
        ToasterService.error(
          Languages.t(
            'services.file_upload_service.toaster.upload_file_error',
            [intendedFilename],
            'Error uploading file ' + intendedFilename,
          ),
        );
        options?.callback?.(null, options?.context || {});
        this.notify();
      });
    }

    return this.pendingFiles.filter(f => f.uploadTaskId === this.currentTaskId);
  }

  public cancelUpload() {
    this.isCancelled = true;

    // pause or resume the resumable tasks
    const fileToCancel = this.pendingFiles;

    if (!fileToCancel) {
      console.error(`No files found for id`);
      return;
    }

    for (const file of fileToCancel) {
      if (file.status === 'success') continue;

      try {
        if (file.resumable) {
          file.resumable.cancel();
          if (file.backendFile)
            this.deleteOneFile({
              companyId: file.backendFile.company_id,
              fileId: file.backendFile.id,
            });
        } else {
          console.warn('Resumable object is not available for file', file);
        }
      } catch (error) {
        console.error('Error while pausing or resuming file', file, error);
      }
    }

    // clean everything
    this.pendingFiles = [];
    this.GroupedPendingFiles = {};
    this.RootSizes = {};
    this.GroupIds = {};

    this.notify();
  }

  public pauseOrResume() {
    // pause or resume the curent upload task
    this.isPaused = !this.isPaused;

    // pause or resume the resumable tasks
    const fileToCancel = this.pendingFiles;

    if (!fileToCancel) {
      console.error(`No files found for id`);
      return;
    }

    for (const file of fileToCancel) {
      if (file.status === 'success') continue;

      try {
        if (file.resumable) {
          if (file.status !== 'pause') {
            file.status = 'pause';
            file.resumable.pause();
          } else {
            file.status = 'pending';
            file.resumable.upload();
          }
        } else {
          console.warn('Resumable object is not available for file', file);
        }
      } catch (error) {
        console.error('Error while pausing or resuming file', file, error);
      }
    }

    this.notify();
  }

  private getResumableInstance({
    target,
    headers,
    chunkSize,
    testChunks,
    simultaneousUploads,
    maxChunkRetries,
    query,
  }: {
    target: string;
    headers: { Authorization: string };
    chunkSize?: number;
    testChunks?: number;
    simultaneousUploads?: number;
    maxChunkRetries?: number;
    query?: { [key: string]: any };
  }) {
    return new Resumable({
      target,
      headers,
      chunkSize: chunkSize || 5000000,
      testChunks: testChunks || false,
      simultaneousUploads: simultaneousUploads || 5,
      maxChunkRetries: maxChunkRetries || 2,
      query,
    });
  }

  public async deleteOneFile({
    companyId,
    fileId,
  }: {
    companyId: string;
    fileId: string;
  }): Promise<void> {
    const response = await FileUploadAPIClient.delete({ companyId, fileId });

    if (response.status === 'success') {
      this.pendingFiles = this.pendingFiles.filter(f => f.backendFile?.id !== fileId);
      this.notify();
    } else {
      logger.error(`Error while processing delete for file`, fileId);
    }
  }

  public getPauseStatus() {
    return this.isPaused;
  }
}

export default new FileUploadService();
