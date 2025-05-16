const amqp = require("amqplib");
const pLimit = require('p-limit').default;
const limit = pLimit(5);
const { fetchRecentEmail } = require("../controllers/email/emailController");

const QUEUE_NAME = "email-fetch-queue";
// const limit = pLimit(5); // Limit concurrency to 5

async function startWorker() {
  const connection = await amqp.connect("amqp://127.0.0.1:5672");
  console.log("Connected to RabbitMQ");
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  channel.consume(
    QUEUE_NAME,
    async (msg) => {
      if (msg !== null) {
        const { adminId } = JSON.parse(msg.content.toString());
        try {
          await limit(async () => {
            console.log(`Fetching recent emails for adminId: ${adminId}`);
            await fetchRecentEmail(adminId);
          });
          channel.ack(msg);
        } catch (error) {
          console.error(
            `Error processing email fetch for adminId ${adminId}:`,
            error
          );
          channel.nack(msg, false, false); // Discard the message on error
        }
      }
    },
    { noAck: false }
  );

  console.log("Email fetch worker started and waiting for jobs...");
}

startWorker().catch(console.error);
