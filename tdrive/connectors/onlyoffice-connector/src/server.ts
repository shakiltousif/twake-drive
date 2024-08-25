import App from '@/app';
import IndexRoute from './routes/index.route';
import OnlyOfficeRoute from './routes/onlyoffice.route';
import TwakeDriveBackendCallbacksRoutes from './routes/backend-callbacks.route';

const app = new App([new IndexRoute(), new OnlyOfficeRoute(), new TwakeDriveBackendCallbacksRoutes()]);

app.listen();
