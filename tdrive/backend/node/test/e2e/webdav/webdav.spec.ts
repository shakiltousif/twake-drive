import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import {TestDbService, uuid} from "../utils.prepare.db";
import {v1 as uuidv1} from "uuid";
import UserApi from "../common/user-api";

describe("The /webdav API", () => {
    const url = "/internal/services/webdav/v1";
    let platform: TestPlatform;
    let currentUser: UserApi;
    let companyId: uuid;

    let testDbService: TestDbService;


    afterEach(async () => {
        await platform?.tearDown();
        platform = null;
    });

    beforeEach(async () => {
        platform = await init({
            services: [
                "webserver",
                "database",
                "search",
                "message-queue",
                "applications",
                "webserver",
                "user",
                "auth",
                "storage",
                "counter",
                "console",
                "workspaces",
                "statistics",
                "platform-services",
                "webdav",
                "files",
                "messages",
                "channels",
                "documents",
            ],
        });
        currentUser = await UserApi.getInstance(platform);
        testDbService = await TestDbService.getInstance(platform);
        companyId = (await testDbService.createCompany()).id;
    });

    const deviceToken = "testDeviceToken";
    const password = "testPassword";

    // TODO[GK]: create it instead of pasting
    const credentials = 'dGVzdERldmljZVRva2VuOnRlc3RQYXNzd29yZA==';

    it("Creating device for the user", async () => {
        const device_mock = {
            id: deviceToken,
            password: password,
            user_id: currentUser.user.id,
            company_id: companyId,
            type: "FCM",
            version: "1",
            push_notifications: false,
        }
        await testDbService.createDevice(device_mock);
    })

    it("Should return 401 Unauthorized", async () => {
        const response = await platform.app.inject({
            method: "GET",
            url: `${url}/webdav/`,
        })

        expect(response.statusCode).toBe(401);
        expect(response.headers["www-authenticate"]).toBe("Basic");
    })

    // Checking PUT file
    it("Creating file", async () => {
        const response = await platform.app.inject({
            method: "PUT",
            url: `${url}/webdav/My%20Drive/hello-world.md`,
            headers: {
                'Authorization': "Basic " + Buffer.from(`${deviceToken}:${password}`).toString('base64'),
                'content-type': 'text/markdown',
            },
            body: '## Hello-world!',
        })
        const resp = response.json();
        console.log(resp);
    })
});