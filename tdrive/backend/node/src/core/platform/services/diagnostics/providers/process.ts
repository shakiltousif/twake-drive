import diagnostics from "../../../framework/api/diagnostics";

export default () =>
  diagnostics.registerProviders({
    key: "process",
    tags: ["live", "ready"],
    async get() {
      return {
        ok: true,
        gc: !!global.gc,
        mem: process.memoryUsage(),
        pid: process.pid,
        res: process.resourceUsage(),
      };
    },
  });
