import express from 'express';
import cors from 'cors';
import videoRoutes from './routes/videoRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', videoRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
