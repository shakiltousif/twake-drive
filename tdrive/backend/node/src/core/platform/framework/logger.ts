import pino from "pino";
import { Configuration } from "./configuration";
import { executionStorage } from "./execution-storage";

const config = new Configuration("logger");

export type TdriveLogger = pino.Logger;

export const logger = pino({
  name: "TdriveApp",
  level: config.get("level", "info") || "info",
  mixin() {
    return executionStorage.getStore() ? executionStorage.getStore() : {};
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  },
});

export const getLogger = (name?: string): TdriveLogger =>
  logger.child({ name: `tdrive${name ? "." + name : ""}` });
