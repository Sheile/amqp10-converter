import { readFileSync } from 'fs';
import { Connection, ConnectionOptions, ConnectionEvents, Receiver, ReceiverOptions, ReceiverEvents, EventContext, Message, SenderOptions } from 'rhea-promise';
import Ajv from 'ajv';
import log4js from 'log4js';
import { sendAttributes } from '@/bindings/iotagent-json';
import { activate, setCommandResult, deactivate } from '@/bindings/iotagent-lib';
import { sendNgsiMessage } from '@/bindings/orion';
import { BackendType, QueueDef, Entity, DeviceMessage, MessageType, JsonType, isObject, sleep } from '@/common';

const host = process.env.AMQP_HOST || 'localhost';
const port = parseInt(process.env.AMQP_PORT || '5672');
const username = process.env.AMQP_USERNAME || 'ANONYMOUS';
const useTLS = (process.env.AMQP_USE_TLS == 'true');
const password = process.env.AMQP_PASSWORD;
const idleTimeOut = parseInt(process.env.IDLE_TIME_OUT || '10000')
const queueDefsStr = process.env.QUEUE_DEFS || '[{"type":"type0","id":"id0"}]';
const upstreamDataModel = process.env.UPSTREAM_DATA_MODEL || 'dm-by-entity';
const schemaPathsStr = process.env.SCHEMA_PATHS || '{}';
const reconnectLimit = parseInt(process.env.RECONNECT_LIMIT || '100');
const backoffWaitMs = parseFloat(process.env.BACKOFF_WAIT_MS || '100.0');
const backoffExpBase = Math.max(parseFloat(process.env.BACKOFF_EXP_BASE || '2'), 1.0);

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
      idle_time_out: idleTimeOut,
      reconnect: false
    };
    if (useTLS) {
      this.connectionOptions.transport = "tls";
    }
    if (password) {
      this.connectionOptions.password = password;
    }
    logger.debug(`connectionOptions=${JSON.stringify(this.connectionOptions)}`);

    const rawQueueDefs = JSON.parse(queueDefsStr);
    if (!QueueDef.isQueueDefs(rawQueueDefs)) {
      logger.error(`invalid QUEUE_DEFS (${rawQueueDefs}`);
      throw new Error(`invalid QUEUE_DEFS (${rawQueueDefs})`);
    }

    this._queueDefs = rawQueueDefs.map((e: {type: string; id: string | undefined; fiwareService: string | undefined; fiwareServicePath: string | undefined; backend: string |undefined}) => {
      return new QueueDef(e.type, e.id, e.fiwareService, e.fiwareServicePath, e.backend);
    });
  }

  async getConnection(): Promise<Connection> {
    if (!connection) {
      const c = new Connection(this.connectionOptions);
      this.onConnectionEvent(c);
      await c.open();
      logger.info(`connected to ${host}:${port} ${(useTLS) ? 'with TLS': 'without TLS'}`);
      connection = c;
    }
    return connection;
  }

  async reconnected(): Promise<void> {
    logger.info(`reconnected to ${host}:${port} ${(useTLS) ? 'with TLS': 'without TLS'}`);
  }

  async close(): Promise<void> {
    if (connection) logger.info(`close connection: id=${connection.id}`);
    await connection?.close();
  }

  private onConnectionEvent(c: Connection): void {
    c.on(ConnectionEvents.connectionOpen, async () => {
      logger.info(`the connection was opened`);
    });
    c.on(ConnectionEvents.connectionClose, async () => {
      logger.info(`the connection was closed`);
    });
    c.on(ConnectionEvents.connectionError, async (event) => {
      logger.error(`the connection error occured, message=${event.message} error=${event.error}`);
    });
    c.on(ConnectionEvents.disconnected, async (event) => {
      logger.warn(`the connection was disconnected, message=${event.message} error=${event.error}`);
      await c.close();

      let rc: Connection | undefined;
      for (let retryCount = 1; retryCount <= reconnectLimit; retryCount++) {
        await sleep((Math.pow(backoffExpBase, retryCount) + Math.random()) * backoffWaitMs);
        logger.info(`try reconnecting to ${host}:${port}, retryCount=${retryCount}`);

        rc = new Connection(this.connectionOptions);
        try {
          await rc.open();
          break;
        } catch (e) {
          logger.debug(e);
        }
      }
      if (rc && rc.isOpen()){
        this.onConnectionEvent(rc);
        connection = rc;
        await this.reconnected();
      } else {
        logger.error(`gave up reconnecting`);
        await this.close();
        process.exit(9);
      }
    });
  }
}

export class Consumer extends AMQPBase {
  private receivers: Receiver[] = [];
  private validatorPath: {[s: string]: Function[]} | null = null;

  constructor() {
    super();
    this.createValidator();
  }

  private createValidator(): void {
    const ajv = Ajv();
    try {
      const rawSchemaPaths = JSON.parse(schemaPathsStr);
      if (!isObject(rawSchemaPaths)) {
        logger.warn(`SCHEMA_PATHS (${schemaPathsStr}) is not valid Object`);
        this.validatorPath = null;
        return;
      }
      this.validatorPath = Object.entries(rawSchemaPaths).map(([k, v]) => {
        if (!Array.isArray(v)) return [k, []];
        return [k, v.map((path: string) => ajv.compile(JSON.parse(readFileSync(path, 'utf-8'))))];
      })
      .reduce((obj, [k, v]) => ({...obj, [String(k)]:v}), {});
      logger.info(`create validators from ${schemaPathsStr}`);
    } catch (err) {
      logger.warn('invalid SCHEMA_PATHS, so ignore it', err);
      this.validatorPath = null;
    }
  }

  getValidators(queueName: string): Function[] {
    return (this.validatorPath) ? Object.entries(this.validatorPath).reduce((prev, current) => {
      return (new RegExp(current[0]).test(queueName)) ? ['', prev[1].concat(current[1])] : ['', prev[1]];
    }, ['', []])[1] : [];
  }

  async consume(): Promise<string> {
    await this.setup();
    return `${host}:${port}`;
  }

  async reconnected(): Promise<void> {
    await this.clean();
    await this.setup();
    logger.info('reconnected consumer');
    await super.reconnected();
  }

  async close(): Promise<void> {
    await this.clean();
    await super.close();
  }

  private async setup(): Promise<void> {
    const connection = await this.getConnection();
    await this.receive(connection);
    await activate();
  }

  private async receive(connection: Connection): Promise<void> {
    const qd = Array.from(new Map(this.queueDefs.map(o => [o.upstreamQueue, o])).values());
    await Promise.all(qd.map(async (queueDef: QueueDef) => {
      await this.createReceiver(connection, queueDef);
    }));
  }

  private async clean(): Promise<void> {
    await deactivate();
    await Promise.all(this.receivers.map(async (r: Receiver) => {
      logger.info(`close receiver: address=${r.address}`);
      await r.close();
    }));
    this.receivers = [];
  }

  private async createReceiver(connection: Connection, queueDef: QueueDef): Promise<void> {
    const receiverOptions: ReceiverOptions = {
      source: {
        address: queueDef.upstreamQueue,
      },
      autoaccept: false,
    };

    const validators: Function[] = this.getValidators(queueDef.upstreamQueue);
    logger.info(`the number of validators (queue=${queueDef.upstreamQueue}) is ${validators.length}`);

    const receiver = await connection.createReceiver(receiverOptions);
    logger.info(`consume message from Queue: ${queueDef.upstreamQueue}`);
    receiver.on(ReceiverEvents.message, (context: EventContext) => {
      if (context.message) {
        try {
          const msg = this.messageBody2String(context.message);
          logger.debug(`received message: ${msg}`);
          const parsed = JSON.parse(msg);
          const valid = validators.length == 0 ? true : validators.some((validate) => validate(parsed));
          if (!valid) {
            logger.warn(`no json schema matched this msg: msg=${msg}, schemas=${schemaPathsStr}`);
            context.delivery?.reject();
          } else {
            if (queueDef.backend === BackendType.iotagent) {
              this.sendMessageToIotAgent(queueDef, context, msg);
            } else {
              this.sendMessageToOrion(queueDef, context, msg);
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

  private messageBody2String(message: Message): string {
    if (typeof message.body === 'string') return message.body;
    if (message.body && message.body.content) return message.body.content.toString("utf-8");
    if (message.body && Buffer.isBuffer(message.body)) return message.body.toString("utf-8");
    throw new Error('Unknown message format');
  }

  private sendMessageToIotAgent(queueDef: QueueDef, context: EventContext, message: string): void {
    const deviceMessage = new DeviceMessage(message);
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

  private sendMessageToOrion(queueDef: QueueDef, context: EventContext, message: string): void {
    const rawJson = JSON.parse(message);
    sendNgsiMessage(queueDef, rawJson)
      .then(() => {
        logger.debug('sent ngsi message: %s', message);
        context.delivery?.accept();
      })
      .catch((err) => {
        logger.error('failed sending nsgi message', err);
        context.delivery?.release();
      })
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
