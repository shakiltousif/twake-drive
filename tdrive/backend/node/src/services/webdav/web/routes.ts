import { FastifyInstance, FastifyPluginCallback } from "fastify";
import { WebDAVController } from "./controllers/webdav";
import { logger } from "../../../core/platform/framework";

const xmlBodyParser = require("fastify-xml-body-parser");

const webdavUrl = "/webdav";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, options, next) => {
  const webDAVController = new WebDAVController();
 
  fastify.register(xmlBodyParser);
  fastify.route({
    method: "POST",
    url: "",
    handler: function (request, reply) {
      logger.debug("post is handled");
      reply.send({ hello: "taks" });
    },
  });

  fastify.route({
    method: "GET",
    url: "",
    handler: (request, reply) => {
      logger.debug("get is handled");
      reply.send({ hello: "world" });
    },
  });
  fastify.route({
    method: "HEAD",
    url: "",
    handler: (request, reply) => {
      logger.debug("head is handled");
      logger.info(request);
    },
  });
  fastify.route({
    method: "OPTIONS",
    url: "/",
    handler: (request, reply) => {
      logger.debug("options is handled");
      logger.info(request.body);
      reply.header('Expires', 'Thu, 01 Jan 1970 00:00:00 GMT')
      .header('Access-Control-Allow-Origin', '*')
      .header('Access-Control-Allow-Credentials', 'true')
      .header('Access-Control-Allow-Methods', 'PROPFIND, PROPPATCH, COPY, MOVE, DELETE, MKCOL, LOCK, UNLOCK, PUT, GETLIB, VERSION-CONTROL, CHECKIN, CHECKOUT, UNCHECKOUT, REPORT, UPDATE, CANCELUPLOAD, HEAD, OPTIONS, GET, POST')
      .header('Access-Control-Allow-Headers', 'Overwrite, Destination, Content-Type, Depth, User-Agent, Translate, Range, Content-Range, Timeout, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control, Location, Lock-Token, If')
      .header('Access-Control-Expose-Headers', 'DAV, content-length, Allow')
      .header('Access-Control-Max-Age', '2147483647')
      .header('X-Engine', 'IT Hit WebDAV Server v7.2.10512 (Evaluation License)')
      .header('DASL', '<DAV:basicsearch>')
      .header('DAV', '1, 2, 3, resumable-upload, paging, bind')
      .header('Allow', 'OPTIONS, PROPFIND, PROPPATCH, COPY, MOVE, DELETE, MKCOL, LOCK, UNLOCK, SEARCH')
      .header('Public', 'OPTIONS, PROPFIND, PROPPATCH, COPY, MOVE, DELETE, MKCOL, LOCK, UNLOCK, SEARCH')
      .header('Accept-Ranges', 'bytes')
      .header('MS-Author-Via', 'DAV')
      .header('Content-Length', '0')
      .header('Date', 'Thu, 04 Jul 2024 09:42:44 GMT')
      .header('Connection', 'close')
      .send()
    },
  });

  fastify.route({
    method: "PROPFIND",
    url: "/",
    handler: function (request, reply) {
      logger.debug("propfind is handled");
      logger.debug(request);
      console.log(request.body);
      const responseXml =`<?xml version="1.0" encoding="utf-8" ?>
                          <D:multistatus xmlns:D="DAV:">
                            <D:response>
                              <D:href>/example/file1.txt</D:href>
                              <D:propstat>
                                <D:prop>
                                  <D:getlastmodified>Tue, 03 Jul 2024 12:34:56 GMT</D:getlastmodified>
                                  <D:getcontentlength>1024</D:getcontentlength>
                                  <D:creationdate>2023-06-15T11:22:33Z</D:creationdate>
                                  <D:resourcetype/>
                                </D:prop>
                                <D:status>HTTP/1.1 200 OK</D:status>
                              </D:propstat>
                            </D:response>
                          </D:multistatus>
                          `
      
      reply
        .code(207)
        .header('Cache-Control', 'private')
        .header('Expires', 'Thu, 01 Jan 1970 00:00:00 GMT')
        .header('Access-Control-Allow-Origin', '*')
        .header('Access-Control-Allow-Credentials', 'true')
        .header('Access-Control-Allow-Methods', 'PROPFIND, PROPPATCH, COPY, MOVE, DELETE, MKCOL, LOCK, UNLOCK, PUT, GETLIB, VERSION-CONTROL, CHECKIN, CHECKOUT, UNCHECKOUT, REPORT, UPDATE, CANCELUPLOAD, HEAD, OPTIONS, GET, POST')
        .header('Access-Control-Allow-Headers', 'Overwrite, Destination, Content-Type, Depth, User-Agent, Translate, Range, Content-Range, Timeout, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control, Location, Lock-Token, If')
        .header('Access-Control-Expose-Headers', 'DAV, content-length, Allow')
        .header('Access-Control-Max-Age', '2147483647')
        .header('X-Engine', 'IT Hit WebDAV Server v7.2.10512 (Evaluation License)')
        .header('Content-Type', 'application/xml;charset=utf-8')
        .header('Content-Length', '524')
        .header('Date', 'Thu, 04 Jul 2024 09:46:05 GMT')
        .send(`<?xml version="1.0" ?>
<d:multistatus xmlns:d="DAV:">
    <d:response>
        <d:href>https://localhost:4000/webdav/internal/services/v1</d:href>
        <d:propstat>
            <d:prop>
                <d:getlastmodified>Thu, 04 Jul 2024 09:36:52 GMT</d:getlastmodified>
                <d:creationdate>2024-07-04T09:35:44Z</d:creationdate>
                <d:resourcetype>
                    <d:collection />
                </d:resourcetype>
            </d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
        </d:propstat>
        <d:propstat>
            <d:prop>
                <d:getcontentlength></d:getcontentlength>
            </d:prop>
            <d:status>HTTP/1.1 404 Not Found</d:status>
        </d:propstat>
    </d:response>
</d:multistatus>`);
//      reply
//        .code(207) // Multistatus status code
//        .header("Content-Type", 'text/xml; charset="utf-8"')
//        .header("Connection", "keep-alive")
//        .send(responseXml);
    },
  });

  // fastify.route({
  //   method: 'GET',
  //   url: '/internal/services/webdav',
  //   schema: {
  //     querystring: {
  //       name: { type: 'string' },
  //       excitement: { type: 'integer' }
  //     },
  //     response: {
  //       200: {
  //         type: 'object',
  //         properties: {
  //           hello: { type: 'string' }
  //         }
  //       }
  //     }
  //   },
  //   handler: function (request, reply) {
  //     reply.send({ hello: 'world' })
  //   }
  // })

  // fastify.route({
  //   method: 'OPTIONS',
  //   url: '',
  //   // preValidation: [fastify.authenticate],
  //   // handler: webDAVController.connect.bind(webDAVController)
  //   schema: {
  //     response: {
  //       200: {
  //         type: 'object',
  //         properties: {
  //           host: { type: 'string' }
  //         }
  //       }
  //     }
  //   },
  //   handler: function (request, reply) {
  //       logger.debug('connection is established');
  //       console.log('connection is established');
  //       reply.send({ host: 'Connection is made' });
  //   }
  // });

  // fastify.route({
  //   method: 'PROPPATCH',
  //   url: filesUrl,
  //   preValidation: [fastify.authenticate],
  //   handler: webDAVController.get.bind(webDAVController),
  // });

  // fastify.route({
  //   method: 'DELETE',
  //   url: `${filesUrl}/:id`,
  //   preValidation: [fastify.authenticate],
  //   handler: webDAVController.delete.bind(webDAVController),
  // });

  // fastify.route({
  //   method: 'MKCOL',
  //   url: filesUrl,
  //   preValidation: [fastify.authenticate],
  //   handler: webDAVController.mkcol.bind(webDAVController),
  // });

  // fastify.route({
  //   method: 'MOVE',
  //   url: filesUrl,
  //   preValidation: [fastify.authenticate],
  //   handler: webDAVController.move.bind(webDAVController),
  // });
  // // TODO: check if all commands are called

  const routes = fastify.printRoutes();
  //  logger.debug(routes);
  console.log(routes);
  next();
};

export default routes;


//<?xml version="1.0" encoding="utf-8" ?> \
//<D:propfind xmlns:D="DAV:"> \
//  <D:prop> \
//    <D:getlastmodified/> \
//    <D:getcontentlength/> \
//    <D:creationdate/> \
//    <D:resourcetype/> \
//  </D:prop> \
//</D:propfind>
//curl -X PROPFIND "http://localhost:4000/internal/services/webdav/v1/" \
//  -H "Host: localhost:4000" \
//  -H "Content-Type: text/xml" \
//  -H "Depth: 0" \
//  -H "Accept: */*" \
//  -H "User-Agent: WebDAVFS/3.0.0 (03008000) Darwin/23.2.0 (arm64)" \
//  -H "Content-Length: 179" \
//  -H "Connection: keep-alive" \
//  --data '<?xml version="1.0" encoding="utf-8" ?>
//<D:propfind xmlns:D="DAV:">
//  <D:prop>
//    <D:getlastmodified/>
//    <D:getcontentlength/>
//    <D:creationdate/>
//    <D:resourcetype/>
//  </D:prop>
//</D:propfind>'