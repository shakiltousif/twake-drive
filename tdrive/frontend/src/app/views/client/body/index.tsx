// eslint-disable-next-line @typescript-eslint/no-use-before-define
import { FC, useEffect, useState } from 'react';

import useRouterChannel from '@features/router/hooks/use-router-channel';
import useRouterCompany from '@features/router/hooks/use-router-company';
import useRouterWorkspace from '@features/router/hooks/use-router-workspace';
import Drive from './drive';

type PropsType = {
  className?: string;
};

const MainView: FC<PropsType> = ({ className }) => {
  const companyId = useRouterCompany();
  const workspaceId = useRouterWorkspace();
  const channelId = useRouterChannel();

  return (
    <div className={'grow min-h-full relative overflow-x-hidden ' + (className ? className : '')}>
      <MainContentWrapper key={companyId + workspaceId + channelId} />
    </div>
  );
};

//This is used to delay render and make rest of UI faster
export const MainContentWrapper = () => {
  const [delayed, setDelayed] = useState(true);
  const companyId = useRouterCompany();
  const workspaceId = useRouterWorkspace();

  //This delay make the app superfast
  useEffect(() => {
    setTimeout(() => setDelayed(false), 50);
  }, []);

  if (delayed) {
    return <></>;
  }

  return (
    <Drive
      context={{
        companyId,
        workspaceId,
      }}
    />
  );
};

export default ({ className }: PropsType) => {
  return <MainView className={className} />;
};
