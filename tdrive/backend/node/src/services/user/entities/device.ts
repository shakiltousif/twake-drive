import { merge } from "lodash";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";
import { uuid } from "../../../utils/types";
import {generators} from "openid-client";

export const TYPE = "devices";

@Entity(TYPE, {
  primaryKey: [["id"]],
  type: TYPE,
})
export default class Device {
  @Column("id", "uuid", { generator: "uuid" })
  id: string;

  @Column("password", "string", { generator: "uuid" })
  password: string;

  @Column("user_id", "uuid")
  user_id: uuid;

  @Column("company_id", "uuid")
  company_id: string;

  @Column("type", "string")
  type: string;

  @Column("version", "string")
  version: string;

  @Column("push_notifications", "boolean")
  push_notifications: boolean;
}

export type UserDevicePrimaryKey = Pick<Device, "id">;

export function getInstance(userDevice: Partial<Device> & UserDevicePrimaryKey): Device {
  return merge(new Device(), userDevice);
}
