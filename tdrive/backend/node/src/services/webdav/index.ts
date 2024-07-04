// File src/services/webdav/index.ts
import { TdriveService, logger, Prefix } from "../../core/platform/framework";
import WebDAVServiceAPI from "./api";
import WebServerAPI from "../../core/platform/services/webserver/provider";
import { WebDAVServiceImpl } from "./services/api";
import web from './web'

@Prefix("/internal/services/webdav/v1")
export default class WebDAVService extends TdriveService<WebDAVServiceAPI> {
  version = "1";
  name = "webdav";
  service: WebDAVServiceAPI;

  api(): WebDAVServiceAPI {
    return this.service;
  }

  public async doInit(): Promise<this> {
    const fastify = this.context.getProvider<WebServerAPI>("webserver").getServer();
    fastify.register((instance, _opts, next) => {
      web(instance, { prefix: this.prefix });
      next();
    });

    // Request Sniffer Hook
    // Request handling hooks
//    fastify.addHook('onRequest', async (request, reply) => {
//      // Log incoming request details
//      fastify.log.debug(`Incoming request: ${request.method} ${request.url}`);
//      fastify.log.debug(`Headers: ${JSON.stringify(request.headers, null, 2)}`);
//      fastify.log.debug(`Content-Type: ${request.headers['content-type']}`);
//      fastify.log.debug(`Authorization: ${request.headers.authorization}`);
//      fastify.log.debug(`Content-Length: ${request.headers['content-length']}`);
//      fastify.log.debug(`User-Agent: ${request.headers['user-agent']}`);
//      fastify.log.debug(`Depth: ${request.headers.depth}`);
//      // Add more headers as needed
//    });

//    fastify.addHook('preHandler', async (request, reply) => {
//      logger.debug(`Handling request: ${request.method} ${request.url}`);
//    });
//
//    fastify.addHook('onResponse', async (request, reply) => {
//      logger.debug(`Response for request: ${request.method} ${request.url} with status: ${reply.statusCode}`);
//    });

    return this;
  }
}
