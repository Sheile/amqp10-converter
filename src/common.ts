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
type JsonObject = {
  [key: string]: JsonPrimitive | JsonObject | JsonArray;
};
export type JsonType = JsonPrimitive | JsonArray | JsonObject;

export enum MessageType { attrs, cmd, cmdexe }

export class DeviceMessage {
  messageType: MessageType | undefined;
  data: JsonType | undefined;

  constructor(rawMessage: string) {
    const rawJson = JSON.parse(rawMessage);
    const keys = Object.keys(rawJson).filter((key) => key in MessageType);
    if (keys.length > 0) {
      this.messageType = MessageType[keys[0] as keyof typeof MessageType];
      this.data = rawJson[keys[0]];
    }
  }
}
