import { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../../../../core/platform/framework";

import gr from "../../../global-resolver";
import * as xml2js from "xml2js";
import { splitn } from "@sciactive/splitn";
import { DriveExecutionContext } from "src/services/documents/types";
import { DriveFile } from "src/services/documents/entities/drive-file";

/**
 * WebDAVController handles WebDAV protocol operations for the Drive service.
 * It implements methods for parsing and rendering XML, handling PROPFIND requests,
 * and mapping DriveFile properties to WebDAV properties.
 */

export class WebDAVController {
  // XML Parser and Builder
  xmlParser = new xml2js.Parser({ xmlns: true });
  xmlBuilder = new xml2js.Builder({
    xmldec: { version: "1.0", encoding: "UTF-8" },
    renderOpts: { pretty: false },
  });

  /**
   * Parses XML content from WebDAV requests
   *
   * @param {string} xml - The XML string to parse
   * @returns {Promise<any>} Parsed XML object with namespace information
   */
  parseXml = async (xml: string): Promise<any> => {
    const parsed = await this.xmlParser.parseStringPromise(xml);
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
  };
  /**
   * Renders XML content for WebDAV responses
   *
   * @param {any} xml - The XML object to render
   * @param {Object} prefixes - Namespace prefixes to use in the rendered XML
   * @returns {string} Rendered XML string
   */
  renderXml = (xml: any, prefixes: { [k: string]: string } = {}): string => {
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
    return this.xmlBuilder.buildObject(obj);
  };

  // Helper function to get the body as a string
  getBody = async (request: FastifyRequest): Promise<string> => {
    console.log("started :: getBody()");
    const chunks: Buffer[] = [];
    for await (const chunk of request.raw) {
      console.log(chunk);
      chunks.push(chunk);
    }
    console.log(chunks);
    return Buffer.concat(chunks).toString("utf8");
  };

  /**
   * Extracts requested properties from the PROPFIND request
   *
   * @param {any} parsedRequest - The parsed PROPFIND request
   * @returns {string[]} Array of requested property names
   */
  getRequestedProps = (parsedRequest: any): string[] => {
    const propElement = parsedRequest.propfind.prop[0];
    return Object.keys(propElement);
  };

  /**
   * Handles PROPFIND requests for WebDAV
   *
   * This method processes PROPFIND requests, which are used to retrieve
   * properties of resources in the WebDAV server. It supports different
   * depth levels and returns a Multi-Status (207) response.
   *
   * @param {FastifyRequest} request - The Fastify request object
   * @param {FastifyReply} response - The Fastify response object
   * @returns {Promise<void>}
   */
  propfind = async (
    request: FastifyRequest<{ Params: { company_id: string; id: string | null } }>,
    response: FastifyReply,
  ): Promise<void> => {
    const bodyXml = request.body as string;
    const depth = (request.headers["depth"] || "0") as string;

    try {
      const { output, prefixes } = await this.parseXml(bodyXml);
      const requestedProps = this.getRequestedProps(output);
      const context = getDriveExecutionContext(request);
      // mock for user
      // context.user = {
      //   email: "admin@admin.com",
      //   id: "17fc4980-403c-11ef-b5cf-41e4aac12e4c",
      //   sid: "",
      //   identity_provider_id: "null",
      //   application_id: null,
      //   server_request: false,
      //   allow_tracking: false,
      //   public_token_document_id: null,
      // };
      const resourcePath = request.params.id ?? null;
      const responseXml = await this.buildPropfindResponse(
        requestedProps,
        resourcePath,
        context,
        depth,
      );
      const resultXml = this.renderXml(responseXml, prefixes);

      response.code(207).header("Content-Type", "application/xml; charset=utf-8").send(resultXml);
    } catch (error) {
      logger.error("Error in PROPFIND:", error);
      response.code(500).send("Internal Server Error");
    }
  };

  private async buildPropfindResponse(
    requestedProps: string[],
    resourcePath: string,
    context: DriveExecutionContext,
    depth: string,
  ): Promise<any> {
    const response: any = {
      "D:multistatus": {
        "D:response": [],
      },
    };

    const addResponse = async (path: string) => {
      const propstat = await this.buildPropstat(requestedProps, path, context);
      response["D:multistatus"]["D:response"].push({
        "D:href": path || "",
        "D:propstat": propstat,
      });
    };

    await addResponse(resourcePath);

    if (depth === "1") {
      const item = await gr.services.documents.documents.get(resourcePath, context);
      if (item.item.is_directory) {
        for (const child of item.children) {
          await addResponse(child.id);
        }
      }
    }

    return response;
  }

  private async buildPropstat(
    requestedProps: string[],
    resourcePath: string,
    context: DriveExecutionContext,
  ): Promise<any[]> {
    const item = await gr.services.documents.documents.get(resourcePath, context);
    const successPropstat: any = {
      "D:prop": {},
      "D:status": "HTTP/1.1 200 OK",
    };
    const failPropstat: any = {
      "D:prop": {},
      "D:status": "HTTP/1.1 404 Not Found",
    };

    for (const prop of requestedProps) {
      try {
        const value = await this.getPropertyValue(prop, item.item);
        if (value !== undefined) {
          successPropstat["D:prop"][`D:${prop}`] = value;
        } else {
          failPropstat["D:prop"][`D:${prop}`] = {};
        }
      } catch (error) {
        failPropstat["D:prop"][`D:${prop}`] = {};
      }
    }

    const result = [];
    if (Object.keys(successPropstat["D:prop"]).length > 0) {
      result.push(successPropstat);
    }
    if (Object.keys(failPropstat["D:prop"]).length > 0) {
      result.push(failPropstat);
    }

    return result;
  }

  private async getPropertyValue(prop: string, item: DriveFile): Promise<any> {
    switch (prop) {
      case "getlastmodified":
        return new Date(item.last_modified).toISOString();
      case "getcontentlength":
        return item.size.toString();
      case "resourcetype":
        return item.is_directory ? "D:collection /" : {};
      case "displayname":
        return item.name;
      case "getetag":
        return `"${item.id}"`;
      case "getcontenttype":
        return item.is_directory
          ? "httpd/unix-directory"
          : item.last_version_cache?.file_metadata?.mime || "application/octet-stream";
      case "creationdate":
        return new Date(item.added).toISOString();
      default:
        return undefined;
    }
  }
}
const getDriveExecutionContext = (
  req: FastifyRequest<{ Params: { company_id: string } }>,
): DriveExecutionContext => ({
  user: req.currentUser,
  company: { id: req.params.company_id },
  url: req.url,
  method: req.routeOptions.method,
  reqId: req.id,
  transport: "http",
});
