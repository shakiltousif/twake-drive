import registerDBPingProvider from "./db-ping";
import registerPlatformProvider from "./platform-started";
import registerProcessProvider from "./process";

export default () => {
  registerDBPingProvider();
  registerPlatformProvider();
  registerProcessProvider();
};
