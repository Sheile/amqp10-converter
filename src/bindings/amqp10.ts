import { Connection, ConnectionOptions, Receiver, ReceiverOptions, ReceiverEvents, EventContext, Message, SenderOptions } from 'rhea-promise';
import { sendAttributes } from '@/bindings/iotagent-json';
import { Entity, DeviceMessage, MessageType, JsonType } from '@/common';

const host = process.env.AMQP_HOST || 'localhost';
const port = parseInt(process.env.AMQP_PORT || '5672');
const username = process.env.AMQP_USERNAME || 'ANONYMOUS';
const useTLS = (process.env.AMQP_USE_TLS == 'true');
const password = process.env.AMQP_PASSWORD;
const entitiesStr = process.env.ENTITIES || '[{"type":"type0","id":"id0"}]';

class AMQPBase {
  protected connectionOptions: ConnectionOptions;
  protected entities: Entity[];

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

  protected async connect(): Promise<Connection> {
    const connection = new Connection(this.connectionOptions);
    await connection.open();
    return connection;
  }

  private isEntities(x: unknown): boolean {
    return Array.isArray(x) && x.every(e => (typeof e === 'object') && 'type' in e && 'id' in e)
  }
}

export class Consumer extends AMQPBase {
  async consume(): Promise<string> {
    const connection = await this.connect();
    await this.receive(connection);
    return `${host}:${port}`;
  }

  private async receive(connection: Connection): Promise<Receiver[]> {
    const receivers: Receiver[] = [];
    this.entities.forEach(async (entity: Entity) => {
      const receiverOptions: ReceiverOptions = {
        source: {
          address: entity.upstreamQueue,
        },
        autoaccept: false,
      };
      const receiver = await connection.createReceiver(receiverOptions);
      receiver.on(ReceiverEvents.message, (context: EventContext) => {
        if (context.message) {
          try {
            const msg = this.messageBody2String(context.message);
            console.log(`received message=${msg}`);
            const deviceMessage = new DeviceMessage(msg);
            switch (deviceMessage.messageType) {
              case MessageType.attrs:
                sendAttributes(entity, deviceMessage.data)
                  .then(() => {
                    console.log('sent attributes: %o', deviceMessage.data);
                    context.delivery?.accept();
                  })
                  .catch((err) => {
                    console.log('failed sending attributes', err);
                    context.delivery?.release();
                  })
                break;
              case MessageType.cmdexe:
                context.delivery?.accept();
                break;
              default:
                context.delivery?.reject();
            }
          } catch (err) {
            console.error('failed when receiving message', err);
            context.delivery?.reject();
          }
        }
      });
    });
    return receivers;
  }

  private messageBody2String(message: Message): string {
    if (typeof message.body === 'string') return message.body;
    if (message.body && message.body.content) return message.body.content.toString("utf-8");
    if (message.body && Buffer.isBuffer(message.body)) return message.body.toString("utf8");
    throw new Error('Unknown message format');
  }
}

export class Producer extends AMQPBase {
  private connection: Connection | undefined;

  async produce(entity: Entity, data: JsonType): Promise<number> {
    const connection = await this.getConnection();
    return await this.send(entity, data, connection);
  }

  private async getConnection(): Promise<Connection> {
    if (!this.connection) {
      this.connection = await this.connect();
    }
    return this.connection;
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
    await sender.close();
    return delivery.id;
  }
}