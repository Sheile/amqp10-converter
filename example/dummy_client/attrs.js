const produce = require('./produce');

async function main() {
  const temperature = 20 + (Math.random() * 15);
  const payload = {
    attrs: {
      temperature: temperature
    }
  };
  await produce(payload);
}

main().then(() => {
  console.log('sent attributes successfully');
}).catch((err) => {
  console.log('faild sending attributes', err);
});