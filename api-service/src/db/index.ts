import { Client } from 'pg';
import { createVideosTableQuery } from './schemas/video.schema';

const databaseUrl = process.env.DATABASE_URL;

export const db = databaseUrl
  ? new Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('sslmode=require') || databaseUrl.includes('ssl=true')
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : null;

export const initializeDatabase = async () => {
  if (!db) {
    console.log('PostgreSQL: No DATABASE_URL set. Running without database.');
    return;
  }

  try {
    await db.connect();
    await db.query(createVideosTableQuery);
    console.log('PostgreSQL connected and schemas initialized');
  } catch (error) {
    console.error('PostgreSQL connection error:', error);
  }
};

export * from './schemas/video.schema';
