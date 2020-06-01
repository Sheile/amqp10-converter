const rhea = require("rhea-promise");

const host = process.env.AMQP_HOST || "localhost"
const port = parseInt(process.env.AMQP_PORT || "5672")
const useTLS = (process.env.AMQP_USE_TLS == "true")
const username = process.env.AMQP_RECEIVER_USERNAME || "ANONYMOUS"
const password = process.env.AMQP_RECEIVER_PASSWORD
const queue = process.env.AMQP_RECEIVE_QUEUE || "examples"

function messageBody2String(message) {
  if (!message) return undefined;
  if (typeof message.body === "string") return message.body;
  if (message && message.body.content) return message.body.content.toString("utf-8");
  if (message && Buffer.isBuffer(message.body)) return message.body.toString("utf8");
  return undefined;
}

async function consume(cb) {
  const connectionOptions = {
    hostname: host,
    host: host,
    port: port,
    username: username,
    reconnect_limit: 100,
  };
  if (useTLS) {
    connectionOptions.transport = "tls";
  }
  if (password) {
    connectionOptions.password = password;
  }

  const receiverOptions = {
    source: {
      address: queue,
    },
    autoaccept: false,
  };

  const connection = new rhea.Connection(connectionOptions);
  await connection.open();
  const receiver = await connection.createReceiver(receiverOptions);
  receiver.on(rhea.ReceiverEvents.message, async (context) => {
    cb(JSON.parse(messageBody2String(context.message)))
      .then(() => {
        context.delivery.accept();
      })
      .catch((err) => {
        console.log('error when sending cmdexe', err);
        context.delivery.release();
      });
  });
}

module.exports = consume;