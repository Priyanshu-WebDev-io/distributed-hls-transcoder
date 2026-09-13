import { Router } from 'express';
import { 
  listVideos, 
  getUploadUrl, 
  queueTranscode, 
  getProgress, 
  deleteVideo 
} from '../controllers/videoController';

const router = Router();

router.get('/videos', listVideos);
router.post('/upload-url', getUploadUrl);
router.post('/transcode', queueTranscode);
router.get('/progress/:filename', getProgress);
router.delete('/videos/:filename', deleteVideo);

export default router;
