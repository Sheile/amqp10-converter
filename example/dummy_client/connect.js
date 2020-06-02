const rhea = require("rhea-promise");

const host = process.env.AMQP_HOST || "localhost"
const port = parseInt(process.env.AMQP_PORT || "5672")
const useTLS = (process.env.AMQP_USE_TLS == "true")
const username = process.env.AMQP_USERNAME || "ANONYMOUS"
const password = process.env.AMQP_PASSWORD

async function connect() {
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

  const connection = new rhea.Connection(connectionOptions);
  await connection.open();
  return connection;
}

module.exports = connect;
