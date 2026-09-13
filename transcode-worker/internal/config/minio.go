package config

import (
	"log"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

func NewMinioClient() *minio.Client {
	endpoint := GetEnv("S3_ENDPOINT", "http://localhost:9000")
	accessKey := GetEnv("S3_ACCESS_KEY", "minio_admin")
	secretKey := GetEnv("S3_SECRET_KEY", "minio_password")

	useSSL := strings.HasPrefix(endpoint, "https://")
	host := strings.TrimPrefix(endpoint, "http://")
	host = strings.TrimPrefix(host, "https://")
	host = strings.TrimRight(host, "/")

	minioClient, err := minio.New(host, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		log.Fatalln("Failed to connect to MinIO:", err)
	}
	return minioClient
}
