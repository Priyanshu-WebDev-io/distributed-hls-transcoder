package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/joho/godotenv"
	"transcode-worker/internal/config"
	"transcode-worker/internal/pool"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found in transcode-worker directory, using environment variables")
	}

	minioClient := config.NewMinioClient()
	redisClient := config.NewRedisClient()
	vodReader := config.NewKafkaReader()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Println("Received termination signal. Shutting down gracefully...")
		cancel()
		vodReader.Close()
	}()

	workerPool := pool.NewWorkerPool(vodReader, minioClient, redisClient, 4)

	var wg sync.WaitGroup
	workerPool.Start(ctx, &wg)

	wg.Wait()
	log.Println("All workers exited cleanly.")
}
