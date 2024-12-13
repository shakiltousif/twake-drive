import { TdriveService, Consumes, Prefix, ServiceName } from "../../framework";
import web from "./web";
import DiagnosticsServiceAPI from "./service-provider";
import DiagnosticsServiceImpl from "./service";
import WebServerAPI from "../webserver/provider";
import registerBasicProviders from "./providers";
import diagnostics, {
  getConfig as getDiagnosticsGetConfig,
  TDiagnosticTag,
} from "../../framework/api/diagnostics";
import registerFastifyRoutesDiagnosticsProvider from "./web/provider";

/**
 * The diagnostics service exposes endpoint that are of use for operational reasons.
 *
 */
@Prefix("/diagnostics")
@Consumes(["webserver"])
@ServiceName("diagnostics")
export default class DiagnosticsService extends TdriveService<DiagnosticsServiceAPI> {
  name = "diagnostics";
  service: DiagnosticsServiceAPI;
  private runningIntervalStatsLog?: ReturnType<typeof setInterval>;
  private runningIntervalStatsFullLog?: ReturnType<typeof setInterval>;

  api(): DiagnosticsServiceAPI {
    return this.service;
  }

  public async doInit(): Promise<this> {
    this.service = new DiagnosticsServiceImpl();
    const fastify = this.context.getProvider<WebServerAPI>("webserver").getServer();

    registerBasicProviders();
    registerFastifyRoutesDiagnosticsProvider(fastify);

    fastify.register((instance, _opts, next) => {
      web(instance, { prefix: this.prefix });
      next();
    });

    const config = getDiagnosticsGetConfig();
    const printStatsToLog = (tag: TDiagnosticTag) => () => diagnostics.get(tag, true);
    const startLoggingStats = (tag, periodMs) =>
      periodMs && periodMs > 0 ? setInterval(printStatsToLog(tag), periodMs) : undefined;
    this.runningIntervalStatsLog = startLoggingStats("stats", config.statsLogPeriodMs);
    this.runningIntervalStatsFullLog = startLoggingStats(
      "stats-full",
      config.statsFullStatsLogPeriodMs,
    );

    return this;
  }

  public async doStop(): Promise<this> {
    if (this.runningIntervalStatsLog) {
      clearInterval(this.runningIntervalStatsLog);
      this.runningIntervalStatsLog = null;
    }
    if (this.runningIntervalStatsFullLog) {
      clearInterval(this.runningIntervalStatsFullLog);
      this.runningIntervalStatsFullLog = null;
    }
    return this;
  }
}
