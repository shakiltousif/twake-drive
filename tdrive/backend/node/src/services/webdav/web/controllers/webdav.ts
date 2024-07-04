import { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../../../../core/platform/framework";

import { CompanyExecutionContext } from "../../../files/web/types";
import gr from "../../../global-resolver";


export class WebDAVController {

  async get(
    request: FastifyRequest<{Params: { company_id: string; id: string }, Querystring: any}>,
    response: FastifyReply
  ): Promise<void> {
    const context = getCompanyExecutionContext(request);
    const params = request.params;

    const resource = await gr.services.files.get(params.id, context);
    console.log('WebDAVController::get() -> is called');
    return Promise.resolve();
  }

  async propfind(
    request: FastifyRequest<{Params: { company_id: string; id: string }, Querystring: any}>,
    response: FastifyReply
  ): Promise<void> {
    logger.debug('WebDAVController::propfind() -> is called');
    console.log('WebDAVController::propfind() -> is called');
    return Promise.resolve();
  }
  async delete(
    request: FastifyRequest<{Params: { company_id: string; id: string }, Querystring: any}>,
    response: FastifyReply
  ): Promise<void> {
    logger.debug('WebDAVController::delete() -> is called');
    console.log('WebDAVController::delete() -> is called');
    return Promise.resolve();
  }
  async mkcol(
    request: FastifyRequest<{Params: { company_id: string; id: string }, Querystring: any}>,
    response: FastifyReply
  ): Promise<void> {
    logger.debug('WebDAVController::mkcol() -> is called');
    console.log('WebDAVController::mkcol() -> is called');
    return Promise.resolve();
  }
  async move(
    request: FastifyRequest<{Params: { company_id: string; id: string }, Querystring: any}>,
    response: FastifyReply
  ): Promise<void> {
    logger.debug('WebDAVController::move() -> is called');
    console.log('WebDAVController::move() -> is called');
    return Promise.resolve();
  }
  async copy(
    request: FastifyRequest<{Params: { company_id: string; id: string }, Querystring: any}>,
    response: FastifyReply
  ): Promise<void> {
    logger.debug('WebDAVController::copy() -> is called');
    console.log('WebDAVController::copy() -> is called');
    return Promise.resolve();
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
// http://localhost:3000/client/internal/services/webdav/v1/webdav