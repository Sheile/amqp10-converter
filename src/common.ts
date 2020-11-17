const separator = process.env.AMQP_QUEUE_SEPARATOR || '.';
const fiwareService = process.env.FIWARE_SERVICE || '';
const fiwareServicePath = process.env.FIWARE_SERVICEPATH || '/';
const idAttrName = process.env.ID_ATTR_NAME || '__id';
const upstreamDataModel = process.env.UPSTREAM_DATA_MODEL || 'dm-by-entity';
const downstreamDataModel = process.env.DOWNSTREAM_DATA_MODEL || 'dm-by-entity';
const useFullyQualifiedQueueName = (process.env.USE_FULLY_QUALIFIED_QUEUE_NAME == 'true')

export enum BackendType { iotagent, orion }

export class QueueDef {
  constructor(public type: string, public id: string = '',
              public fiwareService: string = '', public fiwareServicePath: string = '', public backend: BackendType | string = BackendType.iotagent) {

    if (backend === 'iotagent') this.backend = BackendType.iotagent
    if (backend === 'orion') this.backend = BackendType.orion
  }

  private convertFiwareServicepath(fsp: string): string {
    return ((fsp[0] === '/') ? fsp.substr(1) : fsp).replace(/\//g, '-');
  }

  private getBaseQueueName(): string {
    const fs = (this.fiwareService) ? this.fiwareService : fiwareService;
    const fsp = this.convertFiwareServicepath((this.fiwareServicePath) ? this.fiwareServicePath : fiwareServicePath);
    let queueName = '';
    if (useFullyQualifiedQueueName) {
      queueName += fs;
      if (fsp.length != 0) {
        queueName += `${separator}${fsp}`
      }
      queueName += separator;
    }
    return `${queueName}${this.type}`;
  }

  get upstreamQueue(): string {
    const idstr = (upstreamDataModel === 'dm-by-entity') ? `${separator}${this.id}` : '';
    return `${this.getBaseQueueName()}${idstr}${separator}up`;
  }

  get downstreamQueue(): string {
    const idstr = (downstreamDataModel === 'dm-by-entity') ? `${separator}${this.id}` : '';
    return `${this.getBaseQueueName()}${idstr}${separator}down`;
  }

  static isQueueDefs(x: unknown): boolean {
    return Array.isArray(x) && x.every(e => (typeof e === 'object') && 'type' in e);
  }
}

export class Entity {
  constructor(public type: string, public id: string) {}
  static fromData(queueDef: QueueDef, data: JsonType | undefined): Entity {
    let id = queueDef.id;
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      if (idAttrName in d) {
        id = d[idAttrName];
      }
    }
    return new this(queueDef.type, id);
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
