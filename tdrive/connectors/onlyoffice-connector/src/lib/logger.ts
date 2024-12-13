import { Logger } from 'tslog';
import { isProductionEnv } from '../config';

export default new Logger({
  name: 'twake-onlyoffice-plugin',
  type: isProductionEnv ? 'json' : 'pretty',
});
