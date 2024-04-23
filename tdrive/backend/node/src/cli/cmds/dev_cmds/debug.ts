import { CommandModule } from "yargs";
import runWithPlatform from "../../lib/run-with-platform";
import Repository from "src/core/platform/services/database/services/orm/repository/repository";
import { DatabaseServiceAPI } from "src/core/platform/services/database/api";
import {
  EntityTarget,
  FindFilter,
  FindOptions,
  SearchServiceAPI,
} from "src/core/platform/services/search/api";
import { TdrivePlatform } from "src/core/platform/platform";
import SearchRepository from "src/core/platform/services/search/repository";
import { IndentedPrinter } from "../../utils/text";

const waitForFlush = (stream: NodeJS.WriteStream) =>
  new Promise<void>((resolve, reject) =>
    stream.write("\r\n", err => (err ? reject(err) : resolve())),
  );

interface EntityWithID {
  id: string;
}

const repoKinds = {};
class EntityRepositoryKind<Entity> {
  private readonly fields?: string[];
  constructor(
    private readonly tableName: string,
    private readonly entity: EntityTarget<Entity>,
    private readonly entityType: string,
    private readonly fieldNames?: string,
  ) {
    this.fields = fieldNames ? fieldNames.split(/\s+/g) : undefined;
    repoKinds[tableName] = this;
  }
  get name() {
    return this.tableName;
  }
  labelFor(item: Entity) {
    return `${this.entityType}  ${(item as EntityWithID).id} - ${this.fieldNames!.split(" ")
      .map(f => `${f}: ${JSON.stringify(item[f])}`)
      .join(" ")}`;
  }
  async databaseRepo(platform: TdrivePlatform): Promise<Repository<Entity>> {
    return platform
      .getProvider<DatabaseServiceAPI>("database")
      .getRepository<Entity>(this.tableName, this.entity);
  }
  async searchRepo(platform: TdrivePlatform): Promise<SearchRepository<Entity>> {
    return platform
      .getProvider<SearchServiceAPI>("search")
      .getRepository<Entity>(this.tableName, this.entity);
  }
  print(entities: Entity[]) {
    if (entities.length) console.log("Total fields:", Object.keys(entities[0]).sort().join(" "));
    console.table(entities, this.fields);
    console.log(`--- ${entities.length} ${this.tableName}`);
  }

  async getAll(
    platform: TdrivePlatform,
    repoType: "database" | "search",
    findFilter: FindFilter = {},
    findOptions: FindOptions = {},
  ): Promise<Entity[]> {
    switch (repoType) {
      case "database":
        const dbRepo = await this.databaseRepo(platform);
        return (await dbRepo.find(findFilter, findOptions, undefined)).getEntities();
      case "search":
        const searchRepo = await this.searchRepo(platform);
        const mergedFindOptions: FindOptions = {
          ...findOptions,
          $text: { $search: "", ...findOptions.$text },
          // $sort: { id: 'asc' }, // id is created as text, not keyword, so needs inverted index: set fielddata=true on [id]
          pagination: { ...findOptions.pagination },
        };

        return (await searchRepo.search(findFilter, mergedFindOptions, undefined)).getEntities();
      default:
        throw new Error("Unknown repoType: " + repoType);
    }
  }
}

// Fields: _status_icon cache creation_date deleted devices email_canonical first_name id identity_provider identity_provider_id language last_activity last_name mail_verified notification_preference password phone picture preferences salt thumbnail_id timezone token_login type username_canonical
import User, { TYPE as UserTYPE } from "../../../services/user/entities/user";
const UserRepoKind = new EntityRepositoryKind<User>(
  UserTYPE,
  User,
  "👨",
  "email_canonical first_name last_name type",
);

// access_info added company_id content_keywords creator description extension id is_directory is_in_trash last_modified last_version_cache name parent_id scope size tags
import { DriveFile, TYPE as DriveFileTYPE } from "../../../services/documents/entities/drive-file";
const DriveFileRepoKind = new EntityRepositoryKind<DriveFile>(
  DriveFileTYPE,
  DriveFile,
  "📄",
  "company_id id creator name size content_keywords",
);
// 'access_info',   'added',
// 'company_id',    'content_keywords',
// 'creator',       'description',
// 'extension',     'id',
// 'is_directory',  'is_in_trash',
// 'last_modified', 'last_version_cache',
// 'name',          'parent_id',
// 'scope',         'size',
// 'tags'

// group_usercompany
// applications dateAdded group_id id lastUpdateDay nbWorkspaces role user_id
import CompanyUser, { TYPE as CompanyUserTYPE } from "../../../services/user/entities/company_user";
const CompanyUserRepoKind = new EntityRepositoryKind<CompanyUser>(
  CompanyUserTYPE,
  CompanyUser,
  "👨🏻‍💼",
);

// group_entity
// dateAdded displayName id identity_provider identity_provider_id logo logofile memberCount name onCreationData plan stats
import Company, { TYPE as CompanyTYPE } from "../../../services/user/entities/company";
const CompanyRepoKind = new EntityRepositoryKind<Company>(CompanyTYPE, Company, "🏛️", "name plan");

// // Seems empty/unused:
// import Device, { TYPE as DeviceTYPE } from "../../../services/user/entities/device";
// const DeviceRepoKind = new EntityRepositoryKind<Device>(DeviceTYPE, Device, "💻");

interface JoinedEntity<Entity> extends EntityWithID {
  id: string;
  db?: Entity;
  search?: Entity;
}

async function getAllJoined<Entity extends EntityWithID>(
  platform: TdrivePlatform,
  repoKind: EntityRepositoryKind<Entity>,
) {
  async function getAllOrEmpty(repoType: "database" | "search") {
    try {
      return await repoKind.getAll(platform, repoType);
    } catch (e) {
      return [];
    }
  }
  const db = await getAllOrEmpty("database");
  const search = await getAllOrEmpty("search");
  const result = new Map<string, JoinedEntity<Entity>>();
  db.forEach((entity: EntityWithID) => {
    const entry = result.get(entity.id);
    if (!entry) result.set(entity.id, { id: entity.id, db: entity as Entity });
    else entry.db = entity as Entity;
  });
  search.forEach((entity: EntityWithID) => {
    const entry = result.get(entity.id);
    if (!entry) result.set(entity.id, { id: entity.id, search: entity as Entity });
    else entry.search = entity as Entity;
  });
  return result;
}

async function _printDBAndSearch<Entity>(
  platform: TdrivePlatform,
  kind: EntityRepositoryKind<Entity>,
) {
  console.log(`\n\t${kind.name} from database`);
  kind.print(await kind.getAll(platform, "database"));
  console.log(`\n\t${kind.name} from search`);
  try {
    kind.print(await kind.getAll(platform, "search"));
  } catch (e) {
    console.error(e);
  }
  await waitForFlush(process.stdout);
  await waitForFlush(process.stderr);
}

async function report(platform: TdrivePlatform) {
  let companyUsers = await CompanyUserRepoKind.getAll(platform, "database");
  const companies = await CompanyRepoKind.getAll(platform, "database");
  const users = await getAllJoined(platform, UserRepoKind);
  const usersAll = new Map(users);
  const files = await getAllJoined(platform, DriveFileRepoKind);
  const printer = new IndentedPrinter();

  const shortCompanyLabel = (id: string) => {
    const company = companies.find(({ id: companyID }) => companyID == id);
    return `🏛️  ${company ? `${company.name} (${id})` : id}`;
  };
  const shortUserLabel = (id: string) => {
    const user = usersAll.get(id)?.db;
    if (!user) return `👨 ${id}`;
    return `👨 ${user.first_name} ${user.last_name} (${user.email_canonical} - ${id})`;
  };
  function describeAccessInfoEntities(file: DriveFile, creatorUserID: string, companyID: string) {
    function pluck<T>(list: T[], filter: (entity: T) => boolean): T {
      let foundIndex = undefined;
      list.forEach((item, index) => {
        if (filter(item)) {
          if (foundIndex !== undefined) throw new Error(`Pluck failed in ${JSON.stringify(list)}`);
          foundIndex = index;
        }
      });
      return foundIndex === undefined ? undefined : list.splice(foundIndex, 1)[0];
    }
    const entities = file.access_info.entities;
    const creatorPerm = pluck(entities, ({ type, id }) => type === "user" && id === creatorUserID);
    const parentFolderPerm = pluck(
      entities,
      ({ type, id }) => type === "folder" && id === "parent",
    );
    const companyPerm = pluck(entities, ({ type, id }) => type === "company" && id === companyID);
    const result = [];
    if (creatorPerm) result.push(`👨 ${creatorPerm.level}`);
    if (parentFolderPerm) result.push(`📁 ${parentFolderPerm.level}`);
    if (companyPerm && companyPerm.level != "none") result.push(`🏛️  ${companyPerm.level}`);
    if (file.access_info.public && file.access_info.public.level != "none") {
      let description = `🔗 ${file.access_info.public.level}`;
      if (file.access_info.public.password)
        description += ` password: ${JSON.stringify(file.access_info.public.password)}`;
      if (file.access_info.public.expiration)
        description += ` expires: ${new Date(file.access_info.public.expiration).toISOString()}`;
      result.push(description);
    }
    return ` (${result.join(" - ")})`;
  }
  const fileLabel = (file: DriveFile) =>
    `${file.is_directory ? "📁" : "📄"}${file.is_in_trash ? "🗑" : ""} ${file.name} - ${(
      file.size / 1024
    ).toFixed(0)}kb`;
  function filePrintDetails(file: JoinedEntity<DriveFile>, userID: string, companyID: string) {
    const db = file.db!;
    if (!db.is_directory && !file.search) printer.appendToPrevious(" (⚠️  not indexed)");
    if (!db.is_directory && !db.content_keywords) printer.appendToPrevious(" (⚠️ 🔎 no keywords)");
    if (db.access_info) {
      printer.appendToPrevious(describeAccessInfoEntities(db, userID, companyID));
      for (const permitted of db.access_info.entities) {
        const prefix = `• 🔑 ${permitted.level} `;
        if (permitted.type == "user") printer.push(`${prefix}for ${shortUserLabel(permitted.id)}`);
        else if (permitted.type == "company")
          printer.push(`${prefix}for ${shortCompanyLabel(permitted.id)}`);
        else if (permitted.type == "folder" && permitted.id == "parent")
          printer.push(`${prefix}from parent 📂`);
        else printer.push(`${prefix}for ${permitted.type}: ${permitted.id}`);
      }
    }
    if (db.is_directory) return;
    if (db.content_keywords) printer.push("• 🔎", db.content_keywords);
  }
  for (const company of companies) {
    await printer.inside("    ", [CompanyRepoKind.labelFor(company)], async () => {
      const userIDs = companyUsers
        .filter(({ group_id }) => group_id === company.id)
        .map(e => e.user_id);
      companyUsers = companyUsers.filter(entity => entity.group_id !== company.id);
      printer.appendToPrevious(` (${userIDs.length} user(s))`);
      for (const userID of userIDs) {
        const user = users.get(userID);
        users.delete(userID);
        await printer.inside("    ", [shortUserLabel(user.id)], async () => {
          const filesOfUser = [...files.values()].filter(file => file.db!.creator === userID);
          if (!user.search) printer.appendToPrevious(" (⚠️  not indexed)");
          printer.appendToPrevious(` (${filesOfUser.length} file(s))`);
          filesOfUser.forEach(file => files.delete(file.id));
          async function printFilesUnder(parentId: string) {
            const indicesToDelete = [];
            const filesWithParent = filesOfUser.filter((f, i) => {
              if (f.db!.parent_id === parentId) {
                indicesToDelete.push(i);
                return true;
              }
              return false;
            });
            indicesToDelete.reverse().forEach(i => filesOfUser.splice(i, 1));
            for (const file of filesWithParent) {
              await printer.inside("     ", [fileLabel(file.db!)], async () => {
                filePrintDetails(file, userID, company.id);
                if (file.db!.is_directory) await printFilesUnder(file.db!.id);
              });
            }
          }
          await printFilesUnder("user_" + userID);
          if (filesOfUser.length)
            await printer.inside("     ", ["⚠️  Files with unknown parent:"], async () => {
              for (const file of filesOfUser)
                await printer.inside("     ", [fileLabel(file.db!)], async () => {
                  filePrintDetails(file, userID, company.id);
                });
            });
        });
      }
    });
  }

  if (companyUsers.length)
    printer.push("Warning: company_users with unknown company: ", companyUsers);
  if (users.size) printer.push("Warning: users with unknown company: ", users);
  if (files.size) printer.push("Warning: files with unknown creator: ", files);

  return printer.toString();
}

const command: CommandModule = {
  describe:
    "Debug command used by developers to run against platform by editing " +
    __filename +
    "." +
    "In current state loads everything to memory then prints it. Probably usefull only in debug.",
  command: "debug",
  builder: {},
  handler: async _argv => {
    let result;
    await runWithPlatform("Debug command", async ({ spinner: _spinner, platform }) => {
      result = await report(platform);
    });
    console.log(result);
  },
};

export default command;
