import yargs from "yargs";

import runWithPlatform from "../../lib/run-with-platform";
import gr from "../../../services/global-resolver";
import { ConsoleController } from "../../../services/console/web/controller";

type CLIArgs = {
  email: string;
  password: string;
};

export default {
  command: "set_local_user <email> <password>",
  describe: "Create or update a local account user and password",
  builder: {
    email: {
      demandOption: true,
      type: "string",
    },
    password: {
      demandOption: true,
      type: "string",
    },
  },
  handler: async (argv: CLIArgs) => {
    await runWithPlatform("set_local_user", async ({ spinner: _spinner, platform: _platform }) => {
      // Validation copied from tdrive/frontend/src/app/views/login/internal/signin/signin.jsx
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(argv.email))
        throw new Error(`Invalid e-mail ${JSON.stringify(argv.email)}`);
      if (!(argv.password.length >= 8))
        throw new Error(`Invalid password ${JSON.stringify(argv.password)}`);
      await gr.services.users.init();
      const existingUser = await gr.services.users.getByEmail(argv.email);
      if (existingUser) {
        _spinner.info(
          `Setting password of user ${existingUser.id} (${existingUser.email_canonical})`,
        );
        await gr.services.users.setPassword({ id: existingUser.id }, argv.password);
      } else {
        _spinner.info(`Creating user with email: ${argv.email}`);
        await new ConsoleController().signup({
          body: {
            email: argv.email,
            password: argv.password,
            first_name: "set_local_user firstname",
            last_name: "set_local_user lastname",
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
    });
  },
} as yargs.CommandModule<object, CLIArgs>;
