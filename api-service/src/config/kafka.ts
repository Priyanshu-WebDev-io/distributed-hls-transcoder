import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'api-service',
  brokers: ['localhost:29092'],
});

export const producer = kafka.producer();

export const connectKafka = async () => {
  await producer.connect();
};
