package config

import "os"

// GetEnv retrieves the value of the environment variable named by key, or fallback if empty
func GetEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
