import { CommandModule } from "yargs";

const command: CommandModule = {
  describe: false, // "Tools for Tdrive developers",
  command: "dev <command>",
  builder: yargs =>
    yargs.commandDir("dev_cmds", {
      visit: commandModule => commandModule.default,
    }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handler: () => {},
};

export default command;
