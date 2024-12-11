import { useEffect, useState } from 'react';
import {
  FileTypePdfIcon,
  FolderIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckGreenIcon,
} from 'app/atoms/icons-colored';
import { PendingFileRecoilType } from 'app/features/files/types/file';

const PendingRootList = ({
  roots,
}: {
  roots: { [key: string]: PendingFileRecoilType[] };
}): JSX.Element => {
  const [modalExpanded, setModalExpanded] = useState(true);
  const keys = Object.keys(roots || {});
  const rootsInProgress = Object.keys(roots || {}).filter(key => roots[key].length > 0);
  console.log('rootsInProgress', rootsInProgress);
  const uploadingNmber = `${rootsInProgress.length}/${Object.keys(roots).length}`;
  const uploadingPercentage: number =
    Math.floor((rootsInProgress.length / Object.keys(roots).length) * 100) || 100;
  return (
    <>
      {keys.length > 0 && (
        <div className="fixed bottom-4 right-4 w-1/3 shadow-lg rounded-sm overflow-hidden p-0">
          <div className="w-full flex bg-[#45454A] text-white p-4 items-center justify-between">
            <p>
              Uploading {uploadingNmber} files... {`${uploadingPercentage}%`}
            </p>
            <button className="ml-auto flex items-center">
              {modalExpanded ? <ArrowDownIcon /> : <ArrowUpIcon />}
            </button>
          </div>
          {modalExpanded && (
            <div className="modal-body">
              <div className="bg-white px-4 py-0 pt-2">
                {keys.map(key => {
                  const root = roots[key];
                  const isFileRoot = key.includes('.');
                  const progress =
                    (root.reduce((acc, file) => {
                      const progress = file.progress || 0;
                      return acc + progress;
                    }, 0) /
                      root.length) *
                    100;

                  return (
                    <div className="root-row" key={key}>
                      <div className="root-details mt-2">
                        <div className="flex items-center">
                          {isFileRoot ? <FileTypePdfIcon /> : <FolderIcon />}
                          <p className="ml-4">{key}</p>
                          <div className="progress-check flex items-center justify-center ml-auto">
                            <CheckGreenIcon />
                          </div>
                        </div>
                        <div className="controls"></div>
                        <div className="progress-check flex items-center justify-center ml-auto">
                          <CheckGreenIcon />
                        </div>
                      </div>

                      <div className="root-progress mt-4">
                        <div className="w-full h-[3px] bg-[#F0F2F3]">
                          <div
                            className="h-full bg-[#00A029]"
                            style={{
                              width: `${progress}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="w-full flex bg-[#F0F2F3] text-black p-4 overflow-hidden items-center justify-between">
                <div className="flex space-x-4 ml-auto">
                  <button className="text-blue-500 px-4 py-2 rounded hover:bg-blue-600">
                    Resume
                  </button>
                  <button className="text-blue-500 px-4 py-2 rounded hover:bg-blue-600">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PendingRootList;
