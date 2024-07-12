import { FastifyInstance, FastifyPluginCallback, FastifyRequest } from "fastify";
import { WebDAVController } from "./controllers/webdav";
import { logger } from "../../../core/platform/framework";

import { splitn } from "@sciactive/splitn";
import * as xml2js from "xml2js";

// const xmlBodyParser = require("fastify-xml-body-parser");
const webdavUrl = "/companies/:company_id";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, options, next) => {
  const webDAVController = new WebDAVController();
  // const xmlParser = new XMLParser({ ignoreAttributes: false });
  // const xmlBuilder = new XMLBuilder({ ignoreAttributes: false });

  // async function parseXMLBody(request: FastifyRequest) {
  //   const body = (await request.body) as string;
  //   return xmlParser.parse(body);
  // }

  // fastify.register(xmlBodyParser);
  //
  // // Helper function to validate XML
  // const validateXML = (xml: string) => {
  //   return XMLValidator.validate(xml);
  // };
  //
  // // Helper function to parse XML response
  // const parseXMLResponse = (xmlString: string) => {
  //   return xmlParser.parse(xmlString);
  // };
  //
  // // Helper function to generate XML response
  // const generateXMLResponse = (obj: any) => {
  //   return xmlBuilder.build(obj);
  // };
  //

  fastify.addContentTypeParser("text/xml", { parseAs: "string" }, (req, body, done) => {
    try {
      console.log("PARSER:");
      console.log(body);
      if (typeof body === "string") {
        // const parsedXml = parseXml(body);
        // console.log(parsedXml);
        done(null, body);
      } else {
        console.log("Error in content  parser: body is buffer");
        done(null, undefined);
      }
    } catch (err) {
      done(err, undefined);
    }
  });
  // GET method
  // fastify.route({
  //   method: "GET",
  //   url: `${webdavUrl}/*`,
  //   handler: webDAVController.get.bind(webDAVController),
  // });
  // PROPFIND method
  fastify.route({
    method: "PROPFIND",
    url: `${webdavUrl}`,
    // preValidation: [fastify.authenticateOptional],
    handler: webDAVController.propfind.bind(webDAVController),
  });
  fastify.route({
    method: "PROPFIND",
    url: `${webdavUrl}/:id`,
    // preValidation: [fastify.authenticateOptional],
    handler: webDAVController.propfind.bind(webDAVController),
  });
  //
  // // POST method
  // fastify.route({
  //   method: "POST",
  //   url: "",
  //   handler: async (request, reply) => {
  //     logger.debug("POST request handled");
  //     const path = request.params["*"];
  //     const body = request.body;
  //     const response = await webDAVController.post(path, body);
  //     reply.type("application/xml").send(response);
  //   },
  // });
  //
  // // PROPPATCH method
  // fastify.route({
  //   method: "PROPPATCH",
  //   url: "",
  //   handler: async (request, reply) => {
  //     logger.debug("PROPPATCH request handled");
  //     const path = request.params["*"];
  //     const xmlBody = request.body as string;
  //     const response = await webDAVController.proppatch(path, xmlBody);
  //     reply.type("application/xml").send(response);
  //   },
  // });
  //
  // // MKCOL method
  // fastify.route({
  //   method: "MKCOL",
  //   url: "",
  //   handler: async (request, reply) => {
  //     logger.debug("MKCOL request handled");
  //     const path = request.params["*"];
  //     const response = await webDAVController.mkcol(path);
  //     reply.code(201).send(response);
  //   },
  // });
  //
  // // DELETE method
  // fastify.route({
  //   method: "DELETE",
  //   url: "",
  //   handler: async (request, reply) => {
  //     logger.debug("DELETE request handled");
  //     const path = request.params["*"];
  //     const response = await webDAVController.delete(path);
  //     reply.code(204).send(response);
  //   },
  // });
  //
  // // COPY method
  // fastify.route({
  //   method: "COPY",
  //   url: "",
  //   handler: async (request, reply) => {
  //     logger.debug("COPY request handled");
  //     const sourcePath = request.params["*"];
  //     const destination = request.headers["destination"] as string;
  //     const overwrite = request.headers["overwrite"] === "T";
  //     const response = await webDAVController.copy(sourcePath, destination, overwrite);
  //     reply.code(201).send(response);
  //   },
  // });
  //
  // // MOVE method
  // fastify.route({
  //   method: "MOVE",
  //   url: "",
  //   handler: async (request, reply) => {
  //     logger.debug("MOVE request handled");
  //     const sourcePath = request.params["*"];
  //     const destination = request.headers["destination"] as string;
  //     const overwrite = request.headers["overwrite"] === "T";
  //     const response = await webDAVController.move(sourcePath, destination, overwrite);
  //     reply.code(201).send(response);
  //   },
  // });
  //
  // // LOCK method
  // fastify.route({
  //   method: "LOCK",
  //   url: "",
  //   handler: async (request, reply) => {
  //     logger.debug("LOCK request handled");
  //     const path = request.params["*"];
  //     const xmlBody = request.body as string;
  //     const response = await webDAVController.lock(path, xmlBody);
  //     reply.type("application/xml").send(response);
  //   },
  // });
  //
  // // UNLOCK method
  // fastify.route({
  //   method: "UNLOCK",
  //   url: "",
  //   handler: async (request, reply) => {
  //     logger.debug("UNLOCK request handled");
  //     const path = request.params["*"];
  //     const lockToken = request.headers["lock-token"] as string;
  //     const response = await webDAVController.unlock(path, lockToken);
  //     reply.code(204).send(response);
  //   },
  // });
  //
  // // OPTIONS method
  // fastify.route({
  //   method: "OPTIONS",
  //   url: "/",
  //   handler: (request, reply) => {
  //     logger.debug("OPTIONS request handled");
  //     reply
  //       .header(
  //         "Allow",
  //         "OPTIONS, GET, HEAD, POST, PUT, DELETE, TRACE, COPY, MOVE, MKCOL, PROPFIND, PROPPATCH, LOCK, UNLOCK",
  //       )
  //       .header("DAV", "1, 2")
  //       .header("MS-Author-Via", "DAV")
  //       .code(200)
  //       .send();
  //   },
  // });

  // fastify.options(, async (request, reply) => {
  //   reply
  //     .header("DAV", "1, 2")
  //     .header("MS-Author-Via", "DAV")
  //     .header(
  //       "Allow",
  //       "OPTIONS, GET, HEAD, POST, PUT, DELETE, TRACE, COPY, MOVE, MKCOL, PROPFIND, PROPPATCH, LOCK, UNLOCK",
  //     )
  //     .send();
  // });

  const routes = fastify.printRoutes();
  return next();
};
export default routes;
