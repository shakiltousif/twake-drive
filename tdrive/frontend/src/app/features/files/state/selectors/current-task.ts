import FileUploadService from '@features/files/services/file-upload-service';
import { selector } from 'recoil';
import { PendingFilesListState } from '../atoms/pending-files-list';
import { RootPendingFilesListState } from '../atoms/root-pending-files-list';

export const CurrentTaskSelector = selector({
  key: 'CurrentTaskFilesSelector',
  get: ({ get }) => {
    const list = get(PendingFilesListState);
    const rootList = get(RootPendingFilesListState) || {};

    const currentTaskFiles = list
      ? list.filter(
          f =>
            FileUploadService.getPendingFile(f.id)?.uploadTaskId ===
              FileUploadService.currentTaskId || f.status === 'error',
        )
      : [];

    return {
      parentId: FileUploadService.parentId,
      roots: rootList,
      files: currentTaskFiles,
      total: currentTaskFiles.length,
      status: FileUploadService.uploadStatus,
      uploaded: currentTaskFiles.filter(f => f.status === 'success').length,
      completed: currentTaskFiles.every(f => f.status === 'success'),
    };
  },
});
