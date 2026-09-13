import { Kafka } from 'kafkajs';

export const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:29092';
export const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'transcode-jobs';

const kafka = new Kafka({
  clientId: 'api-service',
  brokers: [KAFKA_BROKER],
});

export const producer = kafka.producer();

export const connectKafka = async () => {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const topics = await admin.listTopics();
    if (!topics.includes(KAFKA_TOPIC)) {
      await admin.createTopics({
        topics: [{ topic: KAFKA_TOPIC, numPartitions: 1, replicationFactor: 1 }],
      });
      console.log(`Kafka topic verified/created: ${KAFKA_TOPIC}`);
    }
    await admin.disconnect();
  } catch (err) {
    // If admin already created it or not supported, ignore
  }

  await producer.connect();
};
