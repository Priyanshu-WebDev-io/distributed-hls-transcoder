import { Request, Response } from 'express';
import { PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/s3';
import { producer } from '../config/kafka';
import { redisClient } from '../config/redis';

export const listVideos = async (req: Request, res: Response) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: 'public-videos',
      Prefix: '',
    });
    const response = await s3Client.send(command);
    
    const videoNames = new Set<string>();
    if (response.Contents) {
      response.Contents.forEach(item => {
        if (item.Key && item.Key.endsWith('/playlist.m3u8')) {
          const folder = item.Key.split('/')[0];
          videoNames.add(folder);
        }
      });
    }

    const validVideos = [];
    for (const folder of Array.from(videoNames)) {
      const progressJSON = await redisClient.get(`transcode_progress:${folder}.mp4`);
      if (progressJSON) {
        try {
          const progress = JSON.parse(progressJSON);
          if (progress.status === 'completed') {
            validVideos.push(folder);
          }
        } catch (e) {}
      } else {
        validVideos.push(folder);
      }
    }

    res.json({ videos: validVideos });
  } catch (error) {
    console.error('Error listing videos:', error);
    res.status(500).json({ error: 'Failed to list videos' });
  }
};

export const getUploadUrl = async (req: Request, res: Response) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });

  try {
    const command = new PutObjectCommand({
      Bucket: 'raw-videos',
      Key: filename,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
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
    await producer.send({
      topic: 'transcode-jobs',
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
    res.json(data);
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
};

export const deleteVideo = async (req: Request, res: Response) => {
  const { filename } = req.params;
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: 'public-videos',
      Prefix: `${filename}/`,
    });
    const listRes = await s3Client.send(listCommand);
    
    if (listRes.Contents && listRes.Contents.length > 0) {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: 'public-videos',
        Delete: {
          Objects: listRes.Contents.map((item) => ({ Key: item.Key })),
        },
      });
      await s3Client.send(deleteCommand);
    }

    const listRaw = new ListObjectsV2Command({
      Bucket: 'raw-videos',
      Prefix: `${filename}`, 
    });
    const rawRes = await s3Client.send(listRaw);
    if (rawRes.Contents && rawRes.Contents.length > 0) {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: 'raw-videos',
        Delete: {
          Objects: rawRes.Contents.map((item) => ({ Key: item.Key })),
        },
      });
      await s3Client.send(deleteCommand);
    }

    await redisClient.del(`transcode_progress:${filename}.mp4`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
};
