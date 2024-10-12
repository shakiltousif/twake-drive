import { FastifyPluginCallback } from "fastify";
import * as express from "express";
import fastifyExpress from "@fastify/express";
import { adapterServiceReady, getAdapterService } from "./adapter";
import gr from "../../global-resolver";
import { executionStorage } from "../../../core/platform/framework/execution-storage";
import { DeviceTypesEnum } from "../../user/entities/device";
import {
  INepheleAuthenticator,
  INepheleAuthResponse,
  INepheleUser,
  NepheleModule,
  NephelePromise,
} from "../nephele/loader";

const webdavUrl = "webdav";
function builder(nephele: NepheleModule): FastifyPluginCallback {
  const routes: FastifyPluginCallback = async (fastify, options, next) => {
    const authenticator = {
      authenticate: async (
        request: express.Request,
        response: INepheleAuthResponse,
      ): Promise<INepheleUser> => {
        if (request.headers.authorization) {
          try {
            const [, ...base64CredentialsParts] = request.headers.authorization.split(" ");
            const base64Credentials = base64CredentialsParts.join(" ");
            const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
            const [deviceId, ...devicePasswordParts] = credentials.split(":");
            const devicePassword = devicePasswordParts.join(":");
            const device = await gr.services.users.getDevice({
              id: deviceId,
              password: devicePassword,
            });
            if (device.type !== DeviceTypesEnum.WebDAV)
              throw new Error(`Invalid device ${deviceId} type, expected WebDAV`);
            response.locals.user = {
              username: device.user_id,
              groupname: device.company_id,
            } as INepheleUser;
            executionStorage.getStore().user_id = device.user_id;
            executionStorage.getStore().company_id = device.company_id;
            response.setHeader("WWW-Authenticate", "Basic");
            return response.locals.user;
          } catch (error) {
            throw new nephele.UnauthorizedError("Error while authorising");
          }
        } else {
          response.statusCode = 401;
          response.setHeader("WWW-Authenticate", "Basic");
          throw new nephele.UnauthorizedError("Unauthorized user!");
        }
      },
      cleanAuthentication: async (
        _request: express.Request,
        response: INepheleAuthResponse,
      ): Promise<void> => {
        // TODO: think about cleaning the user
        response.set("WWW-Authenticate", "Basic");
      },
    } as INepheleAuthenticator;

    await adapterServiceReady;
    const adapter = getAdapterService();
    fastify.register(fastifyExpress).after(() => {
      const server = nephele.createServer({
        adapter: adapter, // You need to define this
        authenticator: authenticator, // You need to define this
        plugins: {},
      });

      const webdavMiddleware = express.Router();
      webdavMiddleware.use(express.urlencoded({ extended: true }));
      webdavMiddleware.use((req, res, next) => {
        server(req, res, err => {
          if (err) {
            fastify.log.error("Nephele error:", err);
            res.status(500).send("Internal Server Error");
          } else {
            next();
          }
        });
      });
      fastify.use(`${webdavUrl}`, webdavMiddleware);
    });

    // DO NOT REMOVE THESE ROUTES
    // I think fastify doesn't run the middleware if there isn't a matching route
    fastify.all("webdav/*", (request, reply) => {
      reply.send({ error: "Unexpected route" });
    });
    fastify.all("webdav", (request, reply) => {
      reply.send({ error: "Unexpected route" });
    });
    next();
  };

  return routes;
}
export const routes = NephelePromise.then(builder);
