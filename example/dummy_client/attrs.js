const connect = require('./connect');
const produce = require('./produce');

async function main() {
  let connection;
  if (process.env.AMQP_SHARE_CONNECTION === 'true') {
    connection = await connect();
  }

  const temperature = 20 + (Math.random() * 15);
  const payload = {
    attrs: {
      temperature: temperature
    }
  };
  await produce(payload, connection);
}

main().then(() => {
  console.log('sent attributes successfully');
}).catch((err) => {
  console.log('faild sending attributes', err);
});
