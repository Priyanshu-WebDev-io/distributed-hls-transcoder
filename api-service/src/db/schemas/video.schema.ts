export interface Video {
  id: number;
  filename: string;
  folder_name: string;
  status: 'pending' | 'transcoding' | 'ready' | 'failed';
  created_at: Date;
}

export const createVideosTableQuery = `
  CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ready',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
`;
