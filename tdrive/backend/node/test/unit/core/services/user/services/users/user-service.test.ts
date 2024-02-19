import { jest } from "@jest/globals";
import { UserServiceImpl } from "../../../../../../../src/services/user/services/users/user-service";
import Repository from "../../../../../../../src/core/platform/services/database/services/orm/repository/repository";
import { DriveFile } from "../../../../../../../src/services/documents/entities/drive-file";
import { randomUUID } from "crypto";
import User, { UserPrimaryKey } from "../../../../../../../src/services/user/entities/user";
describe("The UsersService", () => {

  const subj: UserServiceImpl = new UserServiceImpl();

  beforeEach(async () => {
    const mockRepository = {
      save: jest.fn(() => Promise.resolve(null)),
    };

    const mockConfig = {
      get: jest.fn(() => Promise.resolve("00000")),
    }

    subj.driveFileRepository = mockRepository as unknown as Repository<DriveFile>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Test creating default folder for the user", async () => {
    //given
    const  user = { id: randomUUID()};
    let actualDoc:DriveFile = null;
    let saveSpy = jest.spyOn(subj.driveFileRepository, "save");
    saveSpy.mockImplementation(
      jest.fn(async (doc: DriveFile) => {
        actualDoc = doc;
      })
    );

    //when
    await subj.createUserRootFolder(user as User)

    //then
    expect(actualDoc).toBeDefined();
    expect(actualDoc.id).toBeDefined();
    expect(actualDoc.id.startsWith("user_")).toBeTruthy()
    expect(actualDoc.parent_id).toBeNull();

  })

});