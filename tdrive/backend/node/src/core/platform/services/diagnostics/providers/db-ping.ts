import diagnostics, { TServiceDiagnosticDepth } from "../../../framework/api/diagnostics";
import globalResolver from "../../../../../services/global-resolver";

export default () =>
  diagnostics.registerProviders({
    key: "db-ping",
    tags: ["startup", "live", "ready"],
    get: () => globalResolver.database.getDiagnostics(TServiceDiagnosticDepth.critical),
  });
