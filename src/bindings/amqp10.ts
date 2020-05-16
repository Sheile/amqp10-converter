import { Connection, ConnectionOptions, Receiver, ReceiverOptions, ReceiverEvents, EventContext, Message, SenderOptions } from 'rhea-promise';
import log4js from 'log4js';
import { sendAttributes } from '@/bindings/iotagent-json';
import { activate, setCommandResult, deactivate } from '@/bindings/iotagent-lib';
import { Entity, DeviceMessage, MessageType, JsonType } from '@/common';

const host = process.env.AMQP_HOST || 'localhost';
const port = parseInt(process.env.AMQP_PORT || '5672');
const username = process.env.AMQP_USERNAME || 'ANONYMOUS';
const useTLS = (process.env.AMQP_USE_TLS == 'true');
const password = process.env.AMQP_PASSWORD;
const entitiesStr = process.env.ENTITIES || '[{"type":"type0","id":"id0"}]';

const logger = log4js.getLogger('amqp10');

class AMQPBase {
  protected connectionOptions: ConnectionOptions;
  protected entities: Entity[];

  private connection: Connection | undefined;

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

    const rawEntities = JSON.parse(entitiesStr);
    if (!this.isEntities(rawEntities)) throw new Error(`invalid ENTITIES (${entitiesStr})`);

    this.entities = rawEntities.map((e: {type: string; id: string}) => {
      return new Entity(e.type, e.id);
    });
  }

  protected async getConnection(): Promise<Connection> {
    if (!this.connection) {
      const c = new Connection(this.connectionOptions);
      await c.open();
      logger.debug(`connected to ${host}:${port} ${(useTLS) ? 'with TLS': 'without TLS'}`);
      this.connection = c;
    }
    return this.connection;
  }

  protected async close(): Promise<void> {
    if (this.connection) logger.info(`close connection: id=${this.connection.id}`);
    await this.connection?.close();
  }

  private isEntities(x: unknown): boolean {
    return Array.isArray(x) && x.every(e => (typeof e === 'object') && 'type' in e && 'id' in e)
  }
}

export class Consumer extends AMQPBase {
  private receivers: Receiver[] = [];

  async consume(): Promise<string> {
    const connection = await this.getConnection();
    await this.receive(connection);
    await activate();
    return `${host}:${port}`;
  }

  private async receive(connection: Connection): Promise<void> {
    this.entities.forEach(async (entity: Entity) => {
      const receiverOptions: ReceiverOptions = {
        source: {
          address: entity.upstreamQueue,
        },
        autoaccept: false,
      };
      const receiver = await connection.createReceiver(receiverOptions);
      logger.info(`consume message from Queue: ${entity.upstreamQueue}`);
      receiver.on(ReceiverEvents.message, (context: EventContext) => {
        if (context.message) {
          try {
            const msg = this.messageBody2String(context.message);
            logger.debug(`received message: ${msg}`);
            const deviceMessage = new DeviceMessage(msg);
            switch (deviceMessage.messageType) {
              case MessageType.attrs:
                sendAttributes(entity, deviceMessage.data)
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
                setCommandResult(entity, deviceMessage.data)
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
                logger.warn('unhandled message type', deviceMessage.messageType && MessageType[deviceMessage.messageType]);
                context.delivery?.reject();
            }
          } catch (err) {
            logger.error('failed when receiving message', err);
            context.delivery?.reject();
          }
        }
      });
      this.receivers.push(receiver);
    });
  }

  async close(): Promise<void> {
    await deactivate();
    this.receivers.forEach(async (r) => {
      logger.info(`close receiver: address=${r.address}`);
      await r.close();
    });
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

  async produce(entity: Entity, data: JsonType): Promise<number> {
    const connection = await this.getConnection();
    return await this.send(entity, data, connection);
  }

  private async send(entity: Entity, data: JsonType, connection: Connection): Promise<number> {
    const senderOptions: SenderOptions = {
      target: {
        address: entity.downstreamQueue,
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