package config

import (
	"strings"

	"github.com/redis/go-redis/v9"
)

func NewRedisClient() *redis.Client {
	redisURL := GetEnv("REDIS_URL", "redis://localhost:6379")
	if strings.HasPrefix(redisURL, "redis://") || strings.HasPrefix(redisURL, "rediss://") {
		opt, err := redis.ParseURL(redisURL)
		if err == nil {
			return redis.NewClient(opt)
		}
	}
	return redis.NewClient(&redis.Options{
		Addr: redisURL,
	})
}
