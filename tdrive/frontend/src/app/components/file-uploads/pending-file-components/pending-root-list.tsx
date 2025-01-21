import classNames from 'classnames';
import { Layout, Row, Col, Typography } from 'antd';
import PerfectScrollbar from 'react-perfect-scrollbar';

import Languages from '@features/global/services/languages-service';
import { PendingFileRecoilType } from '@features/files/types/file';
import { useUpload } from '@features/files/hooks/use-upload';

import './styles.scss';

type PropsType = {
  rootPendingFilesState: { [key: string]: PendingFileRecoilType[] };
  visible: boolean;
};

const { Text } = Typography;
const { Header, Content } = Layout;
export default ({ rootPendingFilesState, visible }: PropsType) => {
  const { currentTask } = useUpload();

  return Object.keys(rootPendingFilesState || {}).length > 0 ? (
    <Layout className={'pending-files-list-layout ' + (visible ? 'visible' : '')}>
      <Header className={classNames('pending-files-list-header')}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text style={{ color: 'var(--white)' }}>
              {currentTask.total > 0 && `${currentTask.uploaded}/${currentTask.total} `}
              {Languages.t('components.drive_dropzone.uploading')}
            </Text>
          </Col>
        </Row>
      </Header>
      {Object.keys(rootPendingFilesState || {}) && (
        <Content className="pending-files-list-content">
          <PerfectScrollbar
            options={{ suppressScrollX: true, suppressScrollY: false }}
            component="div"
            style={{ width: '100%', height: 114 }}
          >
            <Row justify="start" align="middle" style={{ background: '#DFE7FE' }}>
              <Col className="small-left-margin">
                <Text style={{ color: '#6C6C6D' }}> -- </Text>
              </Col>
            </Row>
          </PerfectScrollbar>
        </Content>
      )}
    </Layout>
  ) : (
    <></>
  );
};
