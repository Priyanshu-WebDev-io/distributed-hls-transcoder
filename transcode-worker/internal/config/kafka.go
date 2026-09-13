package config

import (
	"strings"

	"github.com/segmentio/kafka-go"
)

func NewKafkaReader() *kafka.Reader {
	broker := GetEnv("KAFKA_BROKER", "localhost:29092")
	topic := GetEnv("KAFKA_TOPIC", "transcode-jobs")

	brokers := strings.Split(broker, ",")
	for i, b := range brokers {
		brokers[i] = strings.TrimSpace(b)
	}

	return kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokers,
		Topic:    topic,
		GroupID:  "transcode-workers",
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})
}
