import yargs from "yargs";

import runWithPlatform from "../../lib/run-with-platform";
import type { TdrivePlatform } from "../../../core/platform/platform";
import type { DatabaseServiceAPI } from "../../../core/platform/services/database/api";
import {
  DriveFile,
  EditingSessionKeyFormat,
  TYPE as DriveFile_TYPE,
} from "../../../services/documents/entities/drive-file";
import {
  FileVersion,
  TYPE as FileVersion_TYPE,
} from "../../../services/documents/entities/file-version";
import User, { TYPE as User_TYPE } from "../../../services/user/entities/user";
import { FindOptions } from "../../../core/platform/services/database/services/orm/repository/repository";

async function makeUserCache(platform: TdrivePlatform) {
  const usersRepo = await platform
    .getProvider<DatabaseServiceAPI>("database")
    .getRepository<User>(User_TYPE, User);
  const cache: { [id: string]: User } = {};
  return async (id): Promise<[boolean, User]> => {
    if (id in cache) return [true, cache[id]];
    const user = await usersRepo.findOne({ id });
    if (user) cache[id] = user;
    return [false, user];
  };
}

interface ListArguments {
  all: boolean;
  name: string;
}

async function report(platform: TdrivePlatform, args: ListArguments) {
  const users = await makeUserCache(platform);
  async function formatUser(id) {
    const [wasKnown, user] = await users(id);
    return user?.email_canonical
      ? user.email_canonical + (wasKnown ? "" : ` (${id})`)
      : `${JSON.stringify(id)} (user id not found)`;
  }
  const drivesRepo = await platform
    .getProvider<DatabaseServiceAPI>("database")
    .getRepository<DriveFile>(DriveFile_TYPE, DriveFile);
  const versionsRepo = await platform
    .getProvider<DatabaseServiceAPI>("database")
    .getRepository<FileVersion>(FileVersion_TYPE, FileVersion);
  const filter = {};
  if (!args.all) filter["editing_session_key"] = { $ne: null };
  const opts: FindOptions = { sort: { name: "asc" } };
  if (args.name) filter["name"] = args.name;
  const editedFiles = (await drivesRepo.find(filter, opts)).getEntities();
  console.error(`DriveFiles${args.all ? "" : " with non-null editing_session_key"}:`);
  console.error("");
  for (const dfile of editedFiles) {
    console.error(`- ${dfile.name} (${dfile.id}) has key:`);
    if (dfile.editing_session_key) {
      const parsed = EditingSessionKeyFormat.parse(dfile.editing_session_key);
      console.error("  - editing_session_key:");
      console.error(`    - URL encoded:   ${encodeURIComponent(dfile.editing_session_key)}`);
      console.error(`    - applicationId: ${parsed.applicationId}`);
      console.error(`    - companyId:     ${parsed.companyId}`);
      console.error(`    - instanceId:    ${JSON.stringify(parsed.instanceId)}`);
      console.error(
        `    - userId:        ${await formatUser(parsed.userId)} (${
          parsed.userId === dfile.creator ? "same as creator ID" : "not the creator"
        })`,
      );
      console.error(
        `    - timestamp:     ${parsed.timestamp.toISOString()} (${Math.floor(
          (new Date().getTime() - parsed.timestamp.getTime()) / 1000,
        )}s ago)`,
      );
    }

    const versions = (
      await versionsRepo.find({ drive_item_id: dfile.id }, { sort: { date_added: "asc" } })
    ).getEntities();
    let previousSize = 0;
    console.error("  - Versions:");
    for (const version of versions) {
      console.error(
        `    - ${new Date(version.date_added).toISOString()} by ${await formatUser(
          version.creator_id,
        )}`,
      );
      console.error(`        - id:          ${version.id}`);
      console.error(
        `        - size:        ${version.file_metadata.size} (${
          version.file_metadata.size > previousSize ? "+" : ""
        }${version.file_metadata.size - previousSize})`,
      );
      previousSize = version.file_metadata.size;
      console.error(`        - application: ${JSON.stringify(version.application_id)}`);
    }
  }
  if (!editedFiles.length) console.error("  (no matching DriveFiles)");
}

const command: yargs.CommandModule<unknown, unknown> = {
  command: "list",
  describe: `
    List current DriveFile items that have an editing_session_key set
  `.trim(),

  builder: {
    all: {
      type: "boolean",
      alias: "a",
      describe: "Include all DriveFiles (not just the ones with editing_session_keys)",
      default: false,
    },
    name: {
      type: "string",
      alias: "n",
      describe: "Filter DriveFiles by name (must be exact)",
      default: false,
    },
  },
  handler: async argv => {
    const args = argv as unknown as ListArguments;
    await runWithPlatform("editing_session list", async ({ spinner: _spinner, platform }) => {
      console.error("\n");
      await report(platform, args);
      console.error("\n");
    });
  },
};
export default command;
