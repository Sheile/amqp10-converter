const consume = require('./consume');
const produce = require('./produce');

async function main() {
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

main().then(() => {
  console.log('start consuming cmd');
}).catch((err) => {
  console.log('faild consuming cmd', err);
});