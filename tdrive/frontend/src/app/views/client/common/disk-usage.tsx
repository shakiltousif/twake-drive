import { Base, Title } from '@atoms/text';
import { useDriveItem } from '@features/drive/hooks/use-drive-item';
import { formatBytes } from '@features/drive/utils';
import Languages from "features/global/services/languages-service";
import { useUserQuota } from "@features/users/hooks/use-user-quota";


export default () => {
  const { access, item } = useDriveItem('root');
  const { item: trash } = useDriveItem('trash');
  // const { quota } = useUserQuota()
  // console.log("QUOTA::" + quota);
  const style = {
    // width: Math.round(quota.used / quota.total) * 100 +  '%'
  };
  return (
    <>
      {access !== 'read' && (
        <div className="bg-zinc-500 dark:bg-zinc-800 bg-opacity-10 rounded-md p-4 w-auto max-w-md">
          <div className="w-full">
            <div className="bg-blue-600 h-1.5 rounded-full dark:bg-blue-500" style={style}></div>
            <Title>
              {formatBytes(item?.size || 0)}
              <Base> { Languages.t('components.disk_usage.used')} </Base> <Base>{formatBytes(trash?.size || 0)} {Languages.t('components.disk_usage.in_trash')}</Base>
            </Title>
          </div>
        </div>
      )}
    </>
  );
};