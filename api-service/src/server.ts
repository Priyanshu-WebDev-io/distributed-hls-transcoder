import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { initializeStorage } from './config/s3';
import { connectRedis } from './config/redis';
import { connectKafka } from './config/kafka';
import { initializeDatabase } from './config/db';

const port = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await initializeDatabase();
    await connectRedis();
    console.log('Redis connected');

    await connectKafka();
    console.log('Kafka producer connected');

    await initializeStorage();

    app.listen(port, () => {
      console.log(`API Service running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
