const connect = require('./connect');
const consume = require('./consume');
const produce = require('./produce');

async function attrs() {
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

async function cmd() {
  let connection;
  if (process.env.AMQP_SHARE_CONNECTION === 'true') {
    connection = await connect();
  }

  await consume(async (msg) => {
    const cmdName = Object.keys(msg.cmd)[0];
    const payload = {
      cmdexe: {
        [cmdName]: `processed ${msg.cmd[cmdName]}`
      }
    }
    await produce(payload, connection);
  }, connection);
}

if (process.argv.length <= 2) {
  console.log(`Usage: node main.js attrs|cmd`);
  process.exit(1);
}
switch (process.argv[2]) {
  case 'attrs':
    attrs().then(() => {
      console.log('sent attributes successfully');
    }).catch((err) => {
      console.log('failed sending attributes', err);
    });
    break;
  case 'cmd':
    cmd().then(() => {
      console.log('start consuming cmd');
    }).catch((err) => {
      console.log('faild consuming cmd', err);
    });
    break;
  default:
    console.log(`unknown cmd (${process.argv[2]})`);
    process.exit(1);
}
