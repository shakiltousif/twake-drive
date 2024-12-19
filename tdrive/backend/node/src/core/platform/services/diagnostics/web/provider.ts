import diagnostics from "../../../framework/api/diagnostics";

export default fastify => {
  // TODO: registering @fastify/routes-stats creates errors (performance mark not found)
  // on the request performance marks, the hook doesn't seem to be called for every route
  // and some of the more important ones like browse start failing...
  // Version tested had to be 3.4.0 because 4+ needs Fastify 5.
  return;
  // Don't require it at all until it's fixed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  fastify.register(require("@fastify/routes-stats"), {
    printInterval: 4000, // milliseconds
    decoratorName: "performanceMarked", // decorator is set to true if a performace.mark was called for the request
  });
  diagnostics.registerProviders({
    key: "fastify-routes",
    tags: ["stats", "stats-full"],
    async get() {
      fastify.measurements();
      return { ok: true, ...fastify.stats() };
    },
  });
};
