const amqp = require("amqplib");

let connection;
let channel;

// Initialize RabbitMQ connection and channel
const initRabbitMQ = async () => {
  try {
    console.log("Connecting to RabbitMQ at amqp://127.0.0.1:5672...");
    connection = await amqp.connect("amqp://127.0.0.1:5672"); // Use IPv4 explicitly
    channel = await connection.createChannel();
    console.log("RabbitMQ connected and channel created.");
  } catch (error) {
    console.error("Error initializing RabbitMQ:", error);
    throw error;
  }
};

// Publish a message to a RabbitMQ queue
const publishToQueue = async (queueName, message) => {
  try {
    if (!channel) {
      throw new Error("RabbitMQ channel is not initialized.");
    }

    await channel.assertQueue(queueName, { durable: true }); // Ensure the queue exists
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
      persistent: true, // Ensure the message is not lost if RabbitMQ restarts
    });
    console.log(`Message published to queue "${queueName}":`, message);
  } catch (error) {
    console.error("Error publishing message to RabbitMQ:", error);
    throw error;
  }
};

// Close RabbitMQ connection
const closeRabbitMQ = async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log("RabbitMQ connection closed.");
  } catch (error) {
    console.error("Error closing RabbitMQ connection:", error);
  }
};

module.exports = {
  initRabbitMQ,
  publishToQueue,
  closeRabbitMQ,
};
