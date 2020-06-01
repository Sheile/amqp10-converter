const consume = require('./consume');
const produce = require('./produce');

async function attrs() {
  const temperature = 20 + (Math.random() * 15);
  const payload = {
    attrs: {
      temperature: temperature
    }
  };
  await produce(payload);
}

async function cmd() {
  await consume(async (msg) => {
    const cmdName = Object.keys(msg.cmd)[0];
    const payload = {
      cmdexe: {
        [cmdName]: `processed ${msg.cmd[cmdName]}`
      }
    }
    await produce(payload);
  });
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