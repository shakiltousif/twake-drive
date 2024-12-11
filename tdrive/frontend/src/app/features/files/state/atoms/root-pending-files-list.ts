import { atom } from 'recoil';
import { PendingFileRecoilType } from '@features/files/types/file';

export const RootPendingFilesListState = atom<
  { [key: string]: PendingFileRecoilType[] } | undefined
>({
  key: 'RootPendingFilesListState',
  default: {},
});
