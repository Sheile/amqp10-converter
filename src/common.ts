const separator = process.env.AMQP_QUEUE_SEPARATOR || '.';

export class Entity {
  constructor(public type: string, public id: string) {
  }

  get upstreamQueue(): string {
    return `${this.type}${separator}${this.id}${separator}up`;
  }

  get downstreamQueue(): string {
    return `${this.type}${separator}${this.id}${separator}down`;
  }
}

type JsonPrimitive = boolean | number  | string  | null;
type JsonArray = JsonPrimitive[] | JsonObject[];
export type JsonObject = {
  [key: string]: JsonPrimitive | JsonObject | JsonArray;
};
export type JsonType = JsonPrimitive | JsonArray | JsonObject;

export const isObject = (x: unknown): boolean => x !== null && (typeof x === 'object' || typeof x === 'function');

export enum MessageType { attrs, cmd, cmdexe }

export class DeviceMessage {
  messageType: MessageType | undefined;
  data: JsonType | undefined;
  rawJson: JsonType;

  constructor(rawMessage: string) {
    const rawJson = JSON.parse(rawMessage);
    this.rawJson = rawJson;
    if (isObject(rawJson) && !Array.isArray(rawJson)) {
      const keys = Object.keys(rawJson).filter((key) => key in MessageType);
      if (keys.length > 0) {
        this.messageType = MessageType[keys[0] as keyof typeof MessageType];
        this.data = rawJson[keys[0]];
      }
    }
  }
}

export interface ServiceType {
  _id: string;
  resource: string;
  apikey: string;
  service: string;
  subservice: string;
  entity_type: string;
}

export interface DeviceType {
  device_id: string;
  service: string;
  service_path: string;
  entity_name: string;
  entity_type: string;
  attributes: JsonType;
  lazy: JsonType;
  commands: JsonType;
  static_attributes: JsonType;
}