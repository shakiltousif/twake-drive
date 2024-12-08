import registerDBPingProvider from "./database-service";
import registerPlatformProvider from "./platform-started";
import registerProcessProvider from "./process";

export default () => {
  registerDBPingProvider();
  registerPlatformProvider();
  registerProcessProvider();
};
