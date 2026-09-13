package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"transcode-worker/internal/config"
	"transcode-worker/internal/pool"
)

func main() {
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
