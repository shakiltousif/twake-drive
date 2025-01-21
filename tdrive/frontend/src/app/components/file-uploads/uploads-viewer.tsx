import { useUpload } from '@features/files/hooks/use-upload';
import PendingRootList from './pending-root-components/pending-root-list';

const UploadsViewer = (): JSX.Element => {
  const { currentTask } = useUpload();

  // Destructure and provide default values for safety
  const { roots = {}, status, parentId } = currentTask || {};
  const rootKeys = Object.keys(roots);

  // Early return for clarity
  if (rootKeys.length === 0) {
    return <></>;
  }

  return <PendingRootList roots={roots} status={status} parentId={parentId} />;
};

export default UploadsViewer;
