import { FastifyRequest } from "fastify";
import { logger } from "../../../../core/platform/framework";

import { CompanyExecutionContext } from "../../../files/web/types";
import * as webdav from "webdav";
// import gr from "../../../global-resolver";


export class WebDAVController {

  propertyMap: Record<string, (resourcePath: string) => Promise<any>> = {
    'getlastmodified': this.getLastModified,
    'getcontentlength': this.getContentLength,
    'creationdate': this.getCreationDate,
    'resourcetype': this.getResourceType,
    // Add more properties as needed
  };

  async map(requests: any, resourcePath: string, response: any): Promise<any> {
    for (const request of requests) {
      if (this.propertyMap[request]) {
        try {
          // TODO: modify this
          response["D:prop"][`D:${request}`] = await this.propertyMap[request](resourcePath);
        } catch (error) {
          // Handle property-specific errors
          response["D:status"] = "HTTP/1.1 404 Not Found";
        }
      } else {
        // Handle unknown properties
        response["D:status"] = "HTTP/1.1 404 Not Found";
      }
    }
    if (response["D:status"] == undefined) {
      response["D:status"] = "HTTP/1.1 200 OK";
    }
    return Promise.resolve(response);
  }

  async getLastModified(localPath: string): Promise<string> {
    logger.debug("WebDAVController::getLastModified() -> is called");
    console.log("WebDAVController::getLastModified() -> is called");
    return Promise.resolve("getLastModified response");
  }

  async getContentLength(localPath: string): Promise<string> {
    logger.debug("WebDAVController::getLastModified() -> is called");
    console.log("WebDAVController::getLastModified() -> is called");
    return Promise.resolve("getLastModified response");
  }

  async getCreationDate(localPath: string): Promise<string> {
    logger.debug("WebDAVController::getLastModified() -> is called");
    console.log("WebDAVController::getLastModified() -> is called");
    return Promise.resolve("getLastModified response");
  }

  async getResourceType(localPath: string): Promise<string> {
    logger.debug("WebDAVController::getLastModified() -> is called");
    console.log("WebDAVController::getLastModified() -> is called");
    return Promise.resolve("getLastModified response");
  }


  async get(path: string, depth: string): Promise<string> {
    logger.debug("WebDAVController::get() -> is called");
    console.log("WebDAVController::get() -> is called");
    return Promise.resolve("GET response");
  }

  async post(path: string, body: any): Promise<string> {
    logger.debug("WebDAVController::post() -> is called");
    console.log("WebDAVController::post() -> is called");
    return Promise.resolve("POST response");
  }

  async propfind(path: string, depth: string): Promise<string> {
    logger.debug("WebDAVController::propfind() -> is called");
    console.log("WebDAVController::propfind() -> is called");
    return Promise.resolve("PROPFIND response");
  }

  async proppatch(path: string, xmlBody: string): Promise<string> {
    logger.debug("WebDAVController::proppatch() -> is called");
    console.log("WebDAVController::proppatch() -> is called");
    return Promise.resolve("PROPPATCH response");
  }

  async mkcol(path: string): Promise<string> {
    logger.debug("WebDAVController::mkcol() -> is called");
    console.log("WebDAVController::mkcol() -> is called");
    return Promise.resolve("MKCOL response");
  }

  async delete(path: string): Promise<string> {
    logger.debug("WebDAVController::delete() -> is called");
    console.log("WebDAVController::delete() -> is called");
    return Promise.resolve("DELETE response");
  }

  async copy(sourcePath: string, destination: string, overwrite: boolean): Promise<string> {
    logger.debug("WebDAVController::copy() -> is called");
    console.log("WebDAVController::copy() -> is called");
    return Promise.resolve("COPY response");
  }

  async move(sourcePath: string, destination: string, overwrite: boolean): Promise<string> {
    logger.debug("WebDAVController::move() -> is called");
    console.log("WebDAVController::move() -> is called");
    return Promise.resolve("MOVE response");
  }

  async lock(path: string, xmlBody: string): Promise<string> {
    logger.debug("WebDAVController::lock() -> is called");
    console.log("WebDAVController::lock() -> is called");
    return Promise.resolve("LOCK response");
  }

  async unlock(path: string, lockToken: string): Promise<string> {
    logger.debug("WebDAVController::unlock() -> is called");
    console.log("WebDAVController::unlock() -> is called");
    return Promise.resolve("UNLOCK response");
  }
}

function getCompanyExecutionContext(
  request: FastifyRequest<{
    Params: { company_id: string };
  }>,
): CompanyExecutionContext {
  return {
    user: request.currentUser,
    company: { id: request.params.company_id },
    url: request.url,
    method: request.routeOptions.method,
    reqId: request.id,
    transport: "http",
  };
}
