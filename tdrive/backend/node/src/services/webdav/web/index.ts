import { FastifyInstance, FastifyRegisterOptions } from "fastify";

import { routes } from "./routes";

export default async (
  fastify: FastifyInstance,
  options: FastifyRegisterOptions<{
    prefix: string;
  }>,
): Promise<void> => {
  fastify.log.debug("Configuring /webdav routes");
  // const routes = eval ("import('nephele').then(builder)");
  fastify.register(routes, options);
};
