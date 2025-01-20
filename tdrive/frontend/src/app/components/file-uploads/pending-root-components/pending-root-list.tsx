import { useState, useMemo, useCallback } from 'react';
import { useUpload } from '@features/files/hooks/use-upload';
import { ArrowDownIcon, ArrowUpIcon } from 'app/atoms/icons-colored';
import { UploadRootListType } from 'app/features/files/types/file';
import PendingRootRow from './pending-root-row';

const getFilteredRoots = (keys: string[], roots: UploadRootListType) => {
  const inProgress = keys.filter(key => roots[key].status === 'uploading');
  const completed = keys.filter(key => roots[key].status === 'completed');
  return { inProgress, completed };
};

interface ModalHeaderProps {
  uploadingCount: number;
  totalRoots: number;
  uploadingPercentage: number;
  toggleModal: () => void;
  modalExpanded: boolean;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({
  uploadingCount,
  totalRoots,
  uploadingPercentage,
  toggleModal,
  modalExpanded,
}) => (
  <div className="w-full flex bg-[#45454A] text-white p-4 items-center justify-between">
    <p>
      Uploading {uploadingCount}/{totalRoots} files... {uploadingPercentage}%
    </p>
    <button className="ml-auto flex items-center" onClick={toggleModal}>
      {modalExpanded ? <ArrowDownIcon /> : <ArrowUpIcon />}
    </button>
  </div>
);

interface ModalFooterProps {
  pauseOrResumeUpload: () => void;
  cancelUpload: () => void;
  isPaused: () => boolean;
}

const ModalFooter: React.FC<ModalFooterProps> = ({
  pauseOrResumeUpload,
  cancelUpload,
  isPaused,
}) => (
  <div className="w-full flex bg-[#F0F2F3] text-black p-4 items-center justify-between">
    <div className="flex space-x-4 ml-auto">
      <button
        className="text-blue-500 px-4 py-2 rounded hover:bg-blue-600"
        onClick={pauseOrResumeUpload}
      >
        {isPaused() ? 'Resume' : 'Pause'}
      </button>
      <button className="text-blue-500 px-4 py-2 rounded hover:bg-blue-600" onClick={cancelUpload}>
        Cancel
      </button>
    </div>
  </div>
);

const PendingRootList = ({ roots }: { roots: UploadRootListType }): JSX.Element => {
  const [modalExpanded, setModalExpanded] = useState(true);
  const { pauseOrResumeUpload, isPaused, cancelUpload } = useUpload();
  const keys = useMemo(() => Object.keys(roots || {}), [roots]);

  const { inProgress: rootsInProgress } = useMemo(
    () => getFilteredRoots(keys, roots),
    [keys, roots],
  );

  const totalRoots = keys.length;
  const uploadingCount = rootsInProgress.length;
  const uploadingPercentage = Math.floor((uploadingCount / totalRoots) * 100) || 100;

  const toggleModal = useCallback(() => setModalExpanded(prev => !prev), []);

  return (
    <>
      {totalRoots > 0 && (
        <div className="fixed bottom-4 right-4 w-1/3 shadow-lg rounded-sm overflow-hidden">
          <ModalHeader
            uploadingCount={uploadingCount}
            totalRoots={totalRoots}
            uploadingPercentage={uploadingPercentage}
            toggleModal={toggleModal}
            modalExpanded={modalExpanded}
          />

          {modalExpanded && (
            <div className="modal-body">
              <div className="bg-white px-4 py-2">
                {keys.map(key => (
                  <PendingRootRow key={key} rootKey={key} root={roots[key]} />
                ))}
              </div>
              <ModalFooter
                pauseOrResumeUpload={pauseOrResumeUpload}
                cancelUpload={cancelUpload}
                isPaused={isPaused}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PendingRootList;
