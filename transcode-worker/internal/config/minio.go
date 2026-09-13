package config

import (
	"log"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

func NewMinioClient() *minio.Client {
	minioClient, err := minio.New("localhost:9000", &minio.Options{
		Creds:  credentials.NewStaticV4("minio_admin", "minio_password", ""),
		Secure: false,
	})
	if err != nil {
		log.Fatalln("Failed to connect to MinIO:", err)
	}
	return minioClient
}
