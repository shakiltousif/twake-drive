import { FastifyInstance, FastifyPluginCallback, FastifyRequest } from "fastify";
import { WebDAVController } from "./controllers/webdav";
import { logger } from "../../../core/platform/framework";

import { splitn } from "@sciactive/splitn";
import * as xml2js from "xml2js";
import { res } from "pino-std-serializers";

const xmlBodyParser = require("fastify-xml-body-parser");
const webdavUrl = "/webdav";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, options, next) => {
  const webDAVController = new WebDAVController();
  // const xmlParser = new XMLParser({ ignoreAttributes: false });
  // const xmlBuilder = new XMLBuilder({ ignoreAttributes: false });

  // async function parseXMLBody(request: FastifyRequest) {
  //   const body = (await request.body) as string;
  //   return xmlParser.parse(body);
  // }

  // XML Parser and Builder
  const xmlParser = new xml2js.Parser({ xmlns: true });
  const xmlBuilder = new xml2js.Builder({
    xmldec: { version: "1.0", encoding: "UTF-8" },
    renderOpts: { pretty: false },
  });

  // XML parsing functions (from the previous example)
  async function parseXml(xml: string) {
    const parsed = await xmlParser.parseStringPromise(xml);
    const prefixes: { [k: string]: string } = {};

    const rewriteAttributes = (
      input: {
        [k: string]: {
          name: string;
          value: string;
          prefix: string;
          local: string;
          uri: string;
        };
      },
      namespace: string,
    ): any => {
      const output: { [k: string]: string } = {};

      for (const name in input) {
        if (
          input[name].uri === "http://www.w3.org/2000/xmlns/" ||
          input[name].uri === "http://www.w3.org/XML/1998/namespace"
        ) {
          output[name] = input[name].value;
        } else if (input[name].uri === "DAV:" || (input[name].uri === "" && namespace === "DAV:")) {
          output[input[name].local] = input[name].value;
        } else {
          output[`${input[name].uri || namespace}%%${input[name].local}`] = input[name].value;
        }
      }

      return output;
    };

    const extractNamespaces = (input: {
      [k: string]: {
        name: string;
        value: string;
        prefix: string;
        local: string;
        uri: string;
      };
    }) => {
      const output: { [k: string]: string } = {};

      for (const name in input) {
        if (
          input[name].uri === "http://www.w3.org/2000/xmlns/" &&
          input[name].local !== "" &&
          input[name].value !== "DAV:"
        ) {
          output[input[name].local] = input[name].value;
        }
      }

      return output;
    };

    const recursivelyRewrite = (
      input: any,
      lang?: string,
      element = "",
      prefix: string = "",
      namespaces: { [k: string]: string } = {},
      includeLang = false,
    ): any => {
      if (Array.isArray(input)) {
        return input.map(value =>
          recursivelyRewrite(value, lang, element, prefix, namespaces, includeLang),
        );
      } else if (typeof input === "object") {
        const output: { [k: string]: any } = {};
        // Remember the xml:lang attribute, as required by spec.
        let curLang = lang;
        let curNamespaces = { ...namespaces };

        if ("$" in input) {
          if ("xml:lang" in input.$) {
            curLang = input.$["xml:lang"].value as string;
          }

          output.$ = rewriteAttributes(input.$, input.$ns.uri);
          curNamespaces = {
            ...curNamespaces,
            ...extractNamespaces(input.$),
          };
        }

        if (curLang != null && includeLang) {
          output.$ = output.$ || {};
          output.$["xml:lang"] = curLang;
        }

        if (element.includes("%%") && prefix !== "") {
          const uri = element.split("%%", 1)[0];
          if (prefix in curNamespaces && curNamespaces[prefix] === uri) {
            output.$ = output.$ || {};
            output.$[`xmlns:${prefix}`] = curNamespaces[prefix];
          }
        }

        for (const name in input) {
          if (name === "$ns" || name === "$") {
            continue;
          }

          const ns = (Array.isArray(input[name]) ? input[name][0].$ns : input[name].$ns) || {
            local: name,
            uri: "DAV:",
          };

          let prefix = "";
          if (name.includes(":")) {
            prefix = name.split(":", 1)[0];
            if (!(prefix in prefixes)) {
              prefixes[prefix] = ns.uri;
            }
          }

          const el = ns.uri === "DAV:" ? ns.local : `${ns.uri}%%${ns.local}`;
          output[el] = recursivelyRewrite(
            input[name],
            curLang,
            el,
            prefix,
            curNamespaces,
            element === "prop",
          );
        }

        return output;
      } else {
        return input;
      }
    };

    const output = recursivelyRewrite(parsed);
    return { output, prefixes };
  }

  async function renderXml(xml: any, prefixes: { [k: string]: string } = {}) {
    let topLevelObject: { [k: string]: any } | undefined = undefined;
    const prefixEntries = Object.entries(prefixes);
    const davPrefix = (prefixEntries.find(([_prefix, value]) => value === "DAV:") || [
      "",
      "DAV:",
    ])[0];

    const recursivelyRewrite = (
      input: any,
      namespacePrefixes: { [k: string]: string } = {},
      element = "",
      currentUri = "DAV:",
      addNamespace?: string,
    ): any => {
      if (Array.isArray(input)) {
        return input.map(value =>
          recursivelyRewrite(value, namespacePrefixes, element, currentUri, addNamespace),
        );
      } else if (typeof input === "object") {
        const output: { [k: string]: any } =
          element === ""
            ? {}
            : {
                $: {
                  ...(addNamespace == null ? {} : { xmlns: addNamespace }),
                },
              };

        const curNamespacePrefixes = { ...namespacePrefixes };

        if ("$" in input) {
          for (const attr in input.$) {
            // Translate uri%%name attributes to prefix:name.
            if (
              attr.includes("%%") ||
              (currentUri !== "DAV:" && !attr.includes(":") && attr !== "xmlns")
            ) {
              const [uri, name] = attr.includes("%%") ? splitn(attr, "%%", 2) : ["DAV:", attr];

              if (currentUri === uri) {
                output.$[name] = input.$[attr];
              } else {
                const xmlns = Object.entries(input.$).find(
                  ([name, value]) => name.startsWith("xmlns:") && value === uri,
                );
                if (xmlns) {
                  const [_dec, prefix] = splitn(xmlns[0], ":", 2);
                  output.$[`${prefix}:${name}`] = input.$[attr];
                } else {
                  const prefixEntry = Object.entries(curNamespacePrefixes).find(
                    ([_prefix, value]) => value === uri,
                  );

                  output.$[`${prefixEntry ? prefixEntry[0] + ":" : ""}${name}`] = input.$[attr];
                }
              }
            } else {
              if (attr.startsWith("xmlns:")) {
                // Remove excess namespace declarations.
                if (curNamespacePrefixes[attr.substring(6)] === input.$[attr]) {
                  continue;
                }

                curNamespacePrefixes[attr.substring(6)] = input.$[attr];
              }

              output.$[attr] = input.$[attr];
            }
          }
        }

        const curNamespacePrefixEntries = Object.entries(curNamespacePrefixes);
        for (const name in input) {
          if (name === "$") {
            continue;
          }

          let el = name;
          let prefix = davPrefix;
          let namespaceToAdd: string | undefined = undefined;
          let uri = "DAV:";
          let local = el;
          if (name.includes("%%")) {
            [uri, local] = splitn(name, "%%", 2);
            // Reset prefix because we're not in the DAV: namespace.
            prefix = "";

            // Look for a prefix in the current prefixes.
            const curPrefixEntry = curNamespacePrefixEntries.find(
              ([_prefix, value]) => value === uri,
            );
            if (curPrefixEntry) {
              prefix = curPrefixEntry[0];
            }

            // Look for a prefix in the children. It should override the current
            // prefix.
            const child = Array.isArray(input[name]) ? input[name][0] : input[name];
            if (typeof child === "object" && "$" in child) {
              let foundPrefix = "";
              for (const attr in child.$) {
                if (attr.startsWith("xmlns:") && child.$[attr] === uri) {
                  foundPrefix = attr.substring(6);
                  break;
                }
              }

              // Make sure every child has the same prefix.
              if (foundPrefix) {
                if (Array.isArray(input[name])) {
                  let prefixIsGood = true;
                  for (const child of input[name]) {
                    if (
                      typeof child !== "object" ||
                      !("$" in child) ||
                      child.$[`xmlns:${foundPrefix}`] !== uri
                    ) {
                      prefixIsGood = false;
                      break;
                    }
                  }
                  if (prefixIsGood) {
                    prefix = foundPrefix;
                  }
                } else {
                  prefix = foundPrefix;
                }
              }
            }

            if (prefix) {
              el = `${prefix}:${local}`;
            } else {
              // If we haven't found a prefix at all, we need to attach the
              // namespace directly to the element.
              namespaceToAdd = uri;
              el = local;
            }
          }

          let setTopLevel = false;
          if (topLevelObject == null) {
            setTopLevel = true;
          }

          output[el] = recursivelyRewrite(
            input[name],
            curNamespacePrefixes,
            el,
            uri,
            namespaceToAdd,
          );

          if (setTopLevel) {
            topLevelObject = output[el];
          }
        }

        return output;
      } else {
        if (addNamespace != null) {
          return {
            $: { xmlns: addNamespace },
            _: input,
          };
        }
        return input;
      }
    };

    const obj = recursivelyRewrite(xml, prefixes);
    if (topLevelObject != null) {
      const obj = topLevelObject as { [k: string]: any };

      // Explicitly set the top level namespace to 'DAV:'.
      obj.$.xmlns = "DAV:";

      for (const prefix in prefixes) {
        obj.$[`xmlns:${prefix}`] = prefixes[prefix];
      }
    }
    return xmlBuilder.buildObject(obj);
  }

  // Helper function to get the body as a string
  async function getBody(request: FastifyRequest): Promise<string> {
    console.log("started :: getBody()");
    const chunks: Buffer[] = [];
    for await (const chunk of request.raw) {
      console.log(chunk);
      chunks.push(chunk);
    }
    console.log(chunks);
    return Buffer.concat(chunks).toString("utf8");
  }

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

  function getRequestedProps(parsedRequest: any): string[] {
    const propElement = parsedRequest.propfind.prop[0];
    return Object.keys(propElement);
  }

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
  // GET method
  fastify.route({
    method: "GET",
    url: "",
    handler: async (request, reply) => {
      logger.debug("GET request handled");
      // const path = request.params["*"];
      // const xml_request = request.body as string;
      logger.debug(request);
      logger.debug("request:", request.raw);
      logger.debug("body:", request.body);
      logger.debug("params:", request.params);
      // logger.debug(xml_request);
      // logger.debug(validateXML(xml_request));
      // logger.debug(path);
      // logger.debug(request.body);
      // logger.debug(parseXMLBody(request));
      // const response = await webDAVController.get(path);
      // reply.type("application/xml").send(response);
    },
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
  // PROPFIND method
  fastify.route({
    method: "PROPFIND",
    url: "",
    handler: async (request, reply) => {
      logger.debug("PROPFIND request handled");

      // Get the request body as a string
      // const bodyXml = await getBody(requestquest);
      const bodyXml = request.body as string;
      console.log(request.raw);

      // Parse the XML
      const { output, prefixes } = await parseXml(bodyXml);
      const properties = getRequestedProps(output);

      // Create the response structure template
      const response: any = {
        "D:multistatus": {
          "D:response": {
            "D:href": "./user/biba",
            "D:propstat": {
              "D:prop": {},
              "D:status": "HTTP/1.1 200 OK",
            },
          },
        },
      };

      const resourcePath = request.url;
      // Map the requested properties to the response propstat
      response["D:multistatus"]["D:response"]["D:propstat"] = await webDAVController.map(
        properties,
        resourcePath,
        response["D:multistatus"]["D:response"]["D:propstat"],
      );
      const reply_xml = await renderXml(response, prefixes);

      reply
        .code(207)
        .header("Content-Type", "application/xml;charset=utf-8")
        .send(reply_xml);
    },
  });
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
  console.log(routes);
  console.log("###########################");
  next();
};
export default routes;
