import { atom } from 'recoil';
import { PendingFileRecoilType } from '@features/files/types/file';

export const RootPendingFilesListState = atom<
  | {
      [key: string]: {
        size: number;
        uploadedSize: number;
        status: string;
        items: PendingFileRecoilType[];
      };
    }
  | undefined
>({
  key: 'RootPendingFilesListState',
  default: {},
});
