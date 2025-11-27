const amqp = require("amqplib");

let channel;
async function getChannel() {
  if (channel) return channel;
  const connection = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://localhost"
  );
  channel = await connection.createChannel();
  return channel;
}

exports.publishToQueue = async (queue, data) => {
  console.debug(`[publishToQueue] Received queue name: "${queue}"`);
  const ch = await getChannel();
  await ch.assertQueue(queue, { durable: true });
  console.debug(`[publishToQueue] Queue "${queue}" asserted and message sent`);
  ch.sendToQueue(queue, Buffer.from(JSON.stringify(data)), {
    persistent: true,
  });
};
