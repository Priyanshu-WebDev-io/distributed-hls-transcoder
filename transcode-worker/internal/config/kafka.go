package config

import (
	"github.com/segmentio/kafka-go"
)

func NewKafkaReader() *kafka.Reader {
	return kafka.NewReader(kafka.ReaderConfig{
		Brokers:  []string{"localhost:29092"},
		Topic:    "transcode-jobs",
		GroupID:  "transcode-workers",
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})
}
