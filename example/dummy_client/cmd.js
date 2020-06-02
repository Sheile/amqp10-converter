const connect = require('./connect');
const consume = require('./consume');
const produce = require('./produce');

async function main() {
  let connection;
  if (process.env.AMQP_SHARE_CONNECTION === 'true') {
    connection = await connect();
  }

  await consume(async (msg) => {
    console.log('msg', msg);
    const cmdName = Object.keys(msg.cmd)[0];
    const payload = {
      cmdexe: {
        [cmdName]: `processed ${msg.cmd[cmdName]}`
      }
    }
    await produce(payload, connection);
  }, connection);
}

main().then(() => {
  console.log('start consuming cmd');
}).catch((err) => {
  console.log('faild consuming cmd', err);
});
