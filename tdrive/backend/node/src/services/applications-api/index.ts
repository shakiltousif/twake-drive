import axios from "axios";
import config from "config";
import _ from "lodash";
import { Prefix, TdriveService } from "../../core/platform/framework";
import WebServerAPI from "../../core/platform/services/webserver/provider";
import Application from "../applications/entities/application";
import web from "./web/index";
import { logger } from "../../core/platform/framework/logger";
import { EditingSessionKeyFormat } from "../documents/entities/drive-file";
import jwt from "jsonwebtoken";

@Prefix("/api")
export default class ApplicationsApiService extends TdriveService<undefined> {
  version = "1";
  name = "applicationsapi";

  private static default: ApplicationsApiService;
  public static getDefault() {
    return this.default;
  }

  public async doInit(): Promise<this> {
    const fastify = this.context.getProvider<WebServerAPI>("webserver").getServer();
    fastify.register((instance, _opts, next) => {
      web(instance, { prefix: this.prefix });
      next();
    });

    //Redirect requests from /plugins/* to the plugin server (if installed)
    const apps = config.get<Application[]>("applications.plugins") || [];
    for (const app of apps) {
      const domain = app.internal_domain.replace(/(\/$|^\/)/gm, "");
      const prefix = app.external_prefix.replace(/(\/$|^\/)/gm, "");
      if (domain && prefix) {
        try {
          fastify.all("/" + prefix + "/*", async (req, rep) => {
            logger.info(`Proxying ${req.method} ${req.url} to ${domain}`);
            try {
              const response = await axios.request({
                url: domain + req.url,
                method: req.method as any,
                headers: _.omit(req.headers, "host", "content-length") as {
                  [key: string]: string;
                },
                data: req.body as any,
                responseType: "stream",
                maxRedirects: 0,
                validateStatus: null,
              });

              // Headers
              for (const key in response.headers) {
                rep.header(key, response.headers[key]);
              }
              rep.statusCode = response.status;

              // Redirects
              if (response.status === 301 || response.status === 302) {
                rep.redirect(response.headers.location);
                return;
              }

              await rep.send(response.data);
            } catch (err) {
              logger.error(err);
              if (err.errors) err.errors.forEach(err => logger.error(err));
              rep.raw.statusCode = 500;
              rep.raw.end(JSON.stringify({ error: err.message }));
            }
          });
          logger.info("Listening at /" + prefix + "/*");
        } catch (e) {
          logger.error(e);
          logger.info("Can't listen to /" + prefix + "/*");
        }
      }
    }
    ApplicationsApiService.default = this;
    return this;
  }

  /** Get the configuration of a given `appId` or `undefined` if unknown */
  public getApplicationConfig(appId: string) {
    const apps = config.get<Application[]>("applications.plugins") || [];
    return apps.find(app => app.id === appId);
  }

  /** Get the configuration of a given `appId` or throw an error if unknown */
  public requireApplicationConfig(appId: string) {
    const app = this.getApplicationConfig(appId);
    if (!app) throw new Error(`Unknown application.id ${JSON.stringify(appId)}`);
    return app;
  }

  /** Send a request to the plugin by its application id
   * @param url Full URL that doesn't start with a `/`
   */
  private async requestFromApplication(
    method: "GET" | "POST" | "DELETE",
    url: string,
    appId: string,
  ) {
    const app = this.requireApplicationConfig(appId);
    if (!app.internal_domain)
      throw new Error(`application.id ${JSON.stringify(appId)} missing an internal_domain`);
    const signature = jwt.sign(
      {
        ts: new Date().getTime(),
        type: "tdriveToApplication",
        application_id: appId,
      },
      app.api.private_key,
    );
    const domain = app.internal_domain.replace(/(\/$|^\/)/gm, "");
    const finalURL = `${domain}/${url}${
      url.indexOf("?") > -1 ? "&" : "?"
    }token=${encodeURIComponent(signature)}`;
    return axios.request({
      url: finalURL,
      method: method,
      headers: {
        Authorization: signature,
      },
      maxRedirects: 0,
    });
  }

  /**
   * Check status of `editing_session_key` in the corresponding application.
   * @param editingSessionKey {@see DriveFile.editing_session_key} to check
   * @returns a URL string if there is a pending version to add, `null`
   * if the key is unknown.
   */
  async checkPendingEditingStatus(editingSessionKey: string): Promise<string | null> {
    const parsedKey = EditingSessionKeyFormat.parse(editingSessionKey);
    const response = await this.requestFromApplication(
      "POST",
      "tdriveApi/1/session/" + encodeURIComponent(editingSessionKey) + "/check",
      parsedKey.applicationId,
    );
    return (response.data.url as string) || null;
  }

  /**
   * Remove any reference to the `editing_session_key` in the plugin
   * @param editingSessionKey {@see DriveFile.editing_session_key} to delete
   * @returns `true` if the key was deleted
   */
  async deleteEditingKey(editingSessionKey: string): Promise<boolean> {
    const parsedKey = EditingSessionKeyFormat.parse(editingSessionKey);
    const response = await this.requestFromApplication(
      "DELETE",
      "tdriveApi/1/session/" + encodeURIComponent(editingSessionKey),
      parsedKey.applicationId,
    );
    return !!response.data.done as boolean;
  }

  // TODO: remove
  api(): undefined {
    return undefined;
  }
}
