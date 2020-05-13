import { Connection, ConnectionOptions, Receiver, ReceiverOptions, ReceiverEvents, EventContext, Message } from 'rhea-promise';

const host = process.env.AMQP_HOST || 'localhost';
const port = parseInt(process.env.AMQP_PORT || '5672');
const username = process.env.AMQP_USERNAME || 'ANONYMOUS';
const useTLS = (process.env.AMQP_USE_TLS == 'true');
const password = process.env.AMQP_PASSWORD;
const rawEntities = JSON.parse(process.env.ENTITIES || '[{"type":"type0","id":"id0"}]');
const separator = process.env.AMQP_QUEUE_SEPARATOR || '.';

class Entity {
  constructor(private type: string, private id: string) {
  }

  get address(): string {
    return `${this.type}${separator}${this.id}`;
  }
}

export class Consumer {
  private connectionOptions: ConnectionOptions;
  private entities: Entity[];

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

    this.entities = rawEntities.map((e: {type: string; id: string}) => {
      return new Entity(e.type, e.id);
    });
  }

  consume(cb: () => void): void {
    this.connect()
      .then(this.receive.bind(this))
      .then(cb)
      .catch((err) => {
        console.error('error when starting AMQP consumer, %o', err);
      })
  }

  private async connect(): Promise<Connection> {
    const connection = new Connection(this.connectionOptions);
    await connection.open();
    return connection;
  }

  private async receive(connection: Connection): Promise<Receiver[]> {
    const receivers: Receiver[] = [];
    this.entities.forEach(async (entity: Entity) => {
      const receiverOptions: ReceiverOptions = {
        source: {
          address: entity.address,
        },
        autoaccept: false,
      };
      const receiver = await connection.createReceiver(receiverOptions);
      receiver.on(ReceiverEvents.message, (context: EventContext) => {
        if (context.message) {
          const msg = this.messageBody2String(context.message);
          console.log(`received message=${msg}`);
          if (context.delivery) context.delivery.accept();
        }
      });
    });
    return receivers;
  }

  private messageBody2String(message: Message): string {
    if (typeof message.body === 'string') return message.body;
    if (message && message.body.content) return message.body.content.toString("utf-8");
    if (message && Buffer.isBuffer(message.body)) return message.body.toString("utf8");
    throw new Error('Unknown message format');
  }
}