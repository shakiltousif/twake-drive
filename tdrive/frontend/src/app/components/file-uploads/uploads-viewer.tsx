import { useUpload } from '@features/files/hooks/use-upload';
import PendingRootList from './pending-root-components/pending-root-list';
const ChatUploadsViewer = (): JSX.Element => {
  const { currentTask } = useUpload();
  const roots = currentTask.roots || {};
  const keys = Object.keys(roots);
  return <>{keys.length > 0 && <PendingRootList roots={roots} />}</>;
};

export default ChatUploadsViewer;
