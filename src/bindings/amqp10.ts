import { readFileSync } from 'fs';
import { Connection, ConnectionOptions, Receiver, ReceiverOptions, ReceiverEvents, EventContext, Message, SenderOptions } from 'rhea-promise';
import Ajv from 'ajv';
import log4js from 'log4js';
import { sendAttributes } from '@/bindings/iotagent-json';
import { activate, setCommandResult, deactivate } from '@/bindings/iotagent-lib';
import { QueueDef, Entity, DeviceMessage, MessageType, JsonType } from '@/common';

const host = process.env.AMQP_HOST || 'localhost';
const port = parseInt(process.env.AMQP_PORT || '5672');
const username = process.env.AMQP_USERNAME || 'ANONYMOUS';
const useTLS = (process.env.AMQP_USE_TLS == 'true');
const password = process.env.AMQP_PASSWORD;
const queueDefsStr = process.env.QUEUE_DEFS || '[{"type":"type0","id":"id0"}]';
const upstreamDataModel = process.env.UPSTREAM_DATA_MODEL || 'dm-by-entity';
const schemaPathsStr = process.env.SCHEMA_PATHS || '[]';

const logger = log4js.getLogger('amqp10');

let connection: Connection | undefined;

export class AMQPBase {
  private connectionOptions: ConnectionOptions;
  private _queueDefs: QueueDef[];

  get queueDefs(): QueueDef[] {
    return this._queueDefs;
  }

  constructor() {
    this.connectionOptions = {
      hostname: host,
      host: host,
      port: port,
      username: username,
      // eslint-disable-next-line @typescript-eslint/camelcase
      reconnect_limit: 100,
    };
    if (useTLS) {
      this.connectionOptions.transport = "tls";
    }
    if (password) {
      this.connectionOptions.password = password;
    }

    const rawQueueDefs = JSON.parse(queueDefsStr);
    if (!QueueDef.isQueueDefs(rawQueueDefs)) {
      logger.error(`invalid QUEUE_DEFS (${rawQueueDefs}`);
      throw new Error(`invalid QUEUE_DEFS (${rawQueueDefs})`);
    }

    this._queueDefs = rawQueueDefs.map((e: {type: string; id: string | undefined; fiwareService: string | undefined; fiwareServicePath: string | undefined}) => {
      return new QueueDef(e.type, e.id, e.fiwareService, e.fiwareServicePath);
    });
  }

  async getConnection(): Promise<Connection> {
    if (!connection) {
      const c = new Connection(this.connectionOptions);
      await c.open();
      logger.debug(`connected to ${host}:${port} ${(useTLS) ? 'with TLS': 'without TLS'}`);
      connection = c;
    }
    return connection;
  }

  async close(): Promise<void> {
    if (connection) logger.info(`close connection: id=${connection.id}`);
    await connection?.close();
  }
}

export class Consumer extends AMQPBase {
  private receivers: Receiver[] = [];
  private validators: Function[] = [];

  constructor() {
    super();
    this.createValidator();
  }

  private createValidator(): void {
    const ajv = Ajv();
    try {
      const rawSchemaPaths = JSON.parse(schemaPathsStr);
      if (!Array.isArray(rawSchemaPaths)) {
        logger.warn(`SCHEMA_PATHS (${schemaPathsStr}) is not array`);
        this.validators = [];
        return;
      }
      this.validators = rawSchemaPaths.map((path: string) => {
        return ajv.compile(JSON.parse(readFileSync(path, 'utf-8')));
      });
      logger.info(`create validators from ${schemaPathsStr}`);
    } catch (err) {
      logger.warn('invalid SCHEMA_PATHS, so ignore it', err);
      this.validators = [];
    }
  }

  hasValidator(): boolean {
    return this.validators.length > 0;
  }

  async consume(): Promise<string> {
    const connection = await this.getConnection();
    await this.receive(connection);
    await activate();
    return `${host}:${port}`;
  }

  private async receive(connection: Connection): Promise<void> {
    const DELIMITER = String.fromCharCode(31);
    const makeKey = (o: QueueDef): string => {
      let key = `${o.fiwareService}${DELIMITER}${o.fiwareServicePath}${DELIMITER}${o.type}`;
      if (upstreamDataModel === 'dm-by-entity') {
        key += `${DELIMITER}${o.id}`;
      }
      return  key;
    };
    const qd = Array.from(new Map(this.queueDefs.map(o => [makeKey(o), o])).values());
    await Promise.all(qd.map(async (queueDef: QueueDef) => {
      await this.createReceiver(connection, queueDef);
    }));
  }

  private async createReceiver(connection: Connection, queueDef: QueueDef): Promise<void> {
    const receiverOptions: ReceiverOptions = {
      source: {
        address: queueDef.upstreamQueue,
      },
      autoaccept: false,
    };
    const receiver = await connection.createReceiver(receiverOptions);
    logger.info(`consume message from Queue: ${queueDef.upstreamQueue}`);
    receiver.on(ReceiverEvents.message, (context: EventContext) => {
      if (context.message) {
        try {
          const msg = this.messageBody2String(context.message);
          logger.debug(`received message: ${msg}`);
          const deviceMessage = new DeviceMessage(msg);
          const valid = this.validators.length == 0 ? true : this.validators.some((validate) => validate(deviceMessage.rawJson));
          if (!valid) {
            logger.warn(`no json schema matched this msg: msg=${msg}, schemas=${schemaPathsStr}`);
            context.delivery?.reject();
          } else {
            const entity = (upstreamDataModel === 'dm-by-entity-type') ? Entity.fromData(queueDef, deviceMessage.data)
                                                                       : new Entity(queueDef.type, queueDef.id);
            switch (deviceMessage.messageType) {
              case MessageType.attrs:
                sendAttributes(queueDef, entity, deviceMessage.data)
                  .then(() => {
                    logger.debug('sent attributes: %o', deviceMessage.data);
                    context.delivery?.accept();
                  })
                  .catch((err) => {
                    logger.error('failed sending attributes', err);
                    context.delivery?.release();
                  })
                break;
              case MessageType.cmdexe:
                setCommandResult(queueDef, entity, deviceMessage.data)
                  .then(() => {
                    logger.debug('sent command result: %o', deviceMessage.data);
                    context.delivery?.accept();
                  })
                  .catch((err) => {
                    logger.error('failed sending command result', err);
                    context.delivery?.release();
                  })
                break;
              default:
                logger.warn('unexpected message type', deviceMessage.messageType && MessageType[deviceMessage.messageType]);
                context.delivery?.reject();
            }
          }
        } catch (err) {
          logger.error('failed when receiving message', err);
          context.delivery?.reject();
        }
      } else {
        logger.error('no message found in this context');
        context.delivery?.reject();
      }
    });
    this.receivers.push(receiver);
  }

  async close(): Promise<void> {
    await deactivate();
    await Promise.all(this.receivers.map(async (r: Receiver) => {
      logger.info(`close receiver: address=${r.address}`);
      await r.close();
    }));
    await super.close();
  }

  private messageBody2String(message: Message): string {
    if (typeof message.body === 'string') return message.body;
    if (message.body && message.body.content) return message.body.content.toString("utf-8");
    if (message.body && Buffer.isBuffer(message.body)) return message.body.toString("utf-8");
    throw new Error('Unknown message format');
  }
}

export class Producer extends AMQPBase {

  async produce(queueDef: QueueDef, data: JsonType): Promise<number> {
    const connection = await this.getConnection();
    return await this.send(queueDef, data, connection);
  }

  private async send(queueDef: QueueDef, data: JsonType, connection: Connection): Promise<number> {
    const senderOptions: SenderOptions = {
      target: {
        address: queueDef.downstreamQueue,
      }
    };
    const sender = await connection.createAwaitableSender(senderOptions);
    const cmd: JsonType = {};
    cmd[MessageType[MessageType.cmd]] = data
    const msg = {
      body: JSON.stringify(cmd)
    };
    const delivery = await sender.send(msg);
    logger.debug('sent message to device:', msg);
    await sender.close();
    return delivery.id;
  }

  async close(): Promise<void> {
    await super.close();
  }
}