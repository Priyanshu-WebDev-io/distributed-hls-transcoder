import { Request, Response } from 'express';
import { PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, RAW_BUCKET, PUBLIC_BUCKET } from '../config/s3';
import { producer, KAFKA_TOPIC } from '../config/kafka';
import { redisClient } from '../config/redis';
import { db } from '../config/db';

export const listVideos = async (req: Request, res: Response) => {
  try {
    const database = db;
    if (database) {
      const allVideos = await database.query(
        "SELECT id, filename, folder_name, status, created_at FROM videos ORDER BY created_at DESC"
      );

      const items = await Promise.all(
        allVideos.rows.map(async (row: any) => {
          let currentStatus = row.status;
          let progress = 0;

          if (currentStatus === 'ready') {
            progress = 100;
          } else {
            const statusStr = await redisClient.get(`transcode_progress:${row.filename}`);
            if (statusStr) {
              try {
                const data = JSON.parse(statusStr);
                if (data.status === 'completed') {
                  currentStatus = 'ready';
                  progress = 100;
                  await database.query("UPDATE videos SET status = 'ready' WHERE id = $1", [row.id]);
                } else {
                  currentStatus = data.status || currentStatus;
                  progress = Number(data.progress) || 0;
                }
              } catch {}
            }
          }

          return {
            id: row.id,
            filename: row.filename,
            folder_name: row.folder_name,
            status: currentStatus,
            progress: Math.round(progress * 10) / 10,
            created_at: row.created_at,
          };
        })
      );

      const readyFolderNames = items
        .filter((item: any) => item.status === 'ready')
        .map((item: any) => item.folder_name);

      return res.json({
        videos: readyFolderNames,
        items: items,
      });
    }
    res.json({ videos: [], items: [] });
  } catch (error) {
    console.error('Error fetching videos from database:', error);
    res.status(500).json({ error: 'Failed to list videos' });
  }
};

export const getUploadUrl = async (req: Request, res: Response) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });

  try {
    const command = new PutObjectCommand({
      Bucket: RAW_BUCKET,
      Key: filename,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    if (db) {
      const folderName = filename.replace(/\.[^/.]+$/, '');
      await db.query(
        `INSERT INTO videos (filename, folder_name, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT (filename) DO UPDATE SET status = 'pending'`,
        [filename, folderName]
      );
    }

    res.json({ url });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

export const queueTranscode = async (req: Request, res: Response) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });

  try {
    if (db) {
      await db.query("UPDATE videos SET status = 'transcoding' WHERE filename = $1", [filename]);
    }

    await producer.send({
      topic: KAFKA_TOPIC,
      messages: [{ value: JSON.stringify({ filename }) }],
    });
    res.json({ success: true, message: 'Transcode job queued' });
  } catch (error) {
    console.error('Error queueing transcode:', error);
    res.status(500).json({ error: 'Failed to queue transcode' });
  }
};

export const getProgress = async (req: Request, res: Response) => {
  try {
    const statusStr = await redisClient.get(`transcode_progress:${req.params.filename}`);
    if (!statusStr) {
      return res.json({ status: 'unknown', progress: 0 });
    }
    const data = JSON.parse(statusStr);

    if (db && data.status === 'completed') {
      const folderName = String(req.params.filename).replace(/\.mp4$/, '');
      await db.query(
        "UPDATE videos SET status = 'ready' WHERE folder_name = $1 OR filename = $1",
        [folderName]
      );
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
};

export const deleteVideo = async (req: Request, res: Response) => {
  const { filename } = req.params;
  try {
    if (db) {
      await db.query("DELETE FROM videos WHERE filename = $1 OR folder_name = $1", [filename]);
    }

    const listPublic = new ListObjectsV2Command({
      Bucket: PUBLIC_BUCKET,
      Prefix: `${filename}/`,
    });
    const publicRes = await s3Client.send(listPublic);
    if (publicRes.Contents && publicRes.Contents.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: PUBLIC_BUCKET,
          Delete: { Objects: publicRes.Contents.map((item) => ({ Key: item.Key })) },
        })
      );
    }

    const listRaw = new ListObjectsV2Command({
      Bucket: RAW_BUCKET,
      Prefix: `${filename}`,
    });
    const rawRes = await s3Client.send(listRaw);
    if (rawRes.Contents && rawRes.Contents.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: RAW_BUCKET,
          Delete: { Objects: rawRes.Contents.map((item) => ({ Key: item.Key })) },
        })
      );
    }

    await redisClient.del(`transcode_progress:${filename}`);
    await redisClient.del(`transcode_progress:${filename}.mp4`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
};
