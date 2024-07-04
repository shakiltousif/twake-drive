import { FastifyInstance, FastifyRegisterOptions } from "fastify";
import fastifyCaching from "@fastify/caching";
import routes from "./routes";

export default (
  fastify: FastifyInstance,
  options: FastifyRegisterOptions<{ prefix: string }>,
): void => {
  // TODO: check that
  fastify.log.debug("Configure webdav routes");
  fastify.register(fastifyCaching, { expiresIn: 31536000, privacy: fastifyCaching.privacy.PUBLIC });
  fastify.register(routes, options);
};
