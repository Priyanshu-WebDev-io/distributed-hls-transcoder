package pool

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
	"transcode-worker/internal/models"
	"transcode-worker/internal/transcoder"
)

type WorkerPool struct {
	VodReader   *kafka.Reader
	S3Client    *minio.Client
	RedisClient *redis.Client
	WorkerCount int
}

func NewWorkerPool(vod *kafka.Reader, s *minio.Client, r *redis.Client, count int) *WorkerPool {
	return &WorkerPool{
		VodReader:   vod,
		S3Client:    s,
		RedisClient: r,
		WorkerCount: count,
	}
}

func (wp *WorkerPool) Start(ctx context.Context, wg *sync.WaitGroup) {
	log.Printf("Transcode worker pool started (%d VOD workers), waiting for jobs...\n", wp.WorkerCount)

	for i := 1; i <= wp.WorkerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for {
				m, err := wp.VodReader.ReadMessage(ctx)
				if err != nil {
					if errors.Is(err, context.Canceled) || errors.Is(err, io.EOF) {
						log.Printf("VOD Worker %d shutting down.", workerID)
						return
					}
					log.Printf("VOD Worker %d: error receiving message: %v", workerID, err)
					time.Sleep(2 * time.Second)
					continue
				}

				var job models.TranscodeJob
				if err := json.Unmarshal(m.Value, &job); err != nil {
					log.Printf("VOD Worker %d: Failed to parse job JSON: %v", workerID, err)
					continue
				}

				log.Printf("VOD Worker %d: Received transcode job for: %s", workerID, job.Filename)
				if err := transcoder.ProcessVideo(ctx, wp.S3Client, wp.RedisClient, job.Filename); err != nil {
					if errors.Is(err, context.Canceled) {
						log.Printf("VOD Worker %d: Job %s was canceled during shutdown.", workerID, job.Filename)
					} else {
						log.Printf("VOD Worker %d: Failed to process video %s: %v", workerID, job.Filename, err)
						wp.RedisClient.Set(ctx, fmt.Sprintf("transcode_progress:%s", job.Filename), `{"status": "failed", "progress": 0}`, 0)
					}
				} else {
					log.Printf("VOD Worker %d: Successfully transcoded video: %s", workerID, job.Filename)
					wp.RedisClient.Set(ctx, fmt.Sprintf("transcode_progress:%s", job.Filename), `{"status": "completed", "progress": 100}`, 0)
				}
			}
		}(i)
	}
}
