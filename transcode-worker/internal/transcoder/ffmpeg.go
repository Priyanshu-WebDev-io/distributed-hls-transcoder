package transcoder

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/redis/go-redis/v9"
)

func ProcessVideo(ctx context.Context, s3Client *minio.Client, rdb *redis.Client, filename string) error {
	progressKey := fmt.Sprintf("transcode_progress:%s", filename)

	folderName := strings.TrimSuffix(filename, filepath.Ext(filename))
	_, statErr := s3Client.StatObject(ctx, "public-videos", fmt.Sprintf("%s/playlist.m3u8", folderName), minio.StatObjectOptions{})
	if statErr == nil {
		log.Printf("Video %s is already fully transcoded, skipping duplicate job.", filename)
		rdb.Set(ctx, progressKey, `{"status": "completed", "progress": 100}`, 0)
		return nil
	}

	workDir := fmt.Sprintf("./tmp_%s", folderName)
	os.MkdirAll(workDir, os.ModePerm)
	defer os.RemoveAll(workDir)

	inputPath := filepath.Join(workDir, filename)

	rdb.Set(ctx, progressKey, `{"status": "downloading", "progress": 0}`, 0)
	log.Printf("Downloading %s from MinIO...", filename)
	err := s3Client.FGetObject(ctx, "raw-videos", filename, inputPath, minio.GetObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to download video: %v", err)
	}

	totalDuration, hasAudio, videoHeight, err := GetVideoInfo(ctx, inputPath)
	if err != nil {
		return err
	}

	activeQualities := GenerateABRLadder(videoHeight)

	rdb.Set(ctx, progressKey, `{"status": "transcoding", "progress": 0}`, 0)
	log.Printf("Transcoding %s with FFmpeg (Duration: %.2fs, Has Audio: %v, Height: %d, Qualities: %d)...", filename, totalDuration, hasAudio, videoHeight, len(activeQualities))

	var filterBuilder strings.Builder
	filterBuilder.WriteString(fmt.Sprintf("[0:v]split=%d", len(activeQualities)))
	for i := range activeQualities {
		filterBuilder.WriteString(fmt.Sprintf("[v%d]", i+1))
	}
	filterBuilder.WriteString(";")
	for i, q := range activeQualities {
		filterBuilder.WriteString(fmt.Sprintf("[v%d]scale=-2:%d[v%dout]", i+1, q.Resolution, i+1))
		if i < len(activeQualities)-1 {
			filterBuilder.WriteString(";")
		}
	}

	args := []string{
		"-i", filename,
		"-filter_complex", filterBuilder.String(),
	}

	for i, q := range activeQualities {
		args = append(args,
			"-map", fmt.Sprintf("[v%dout]", i+1),
			fmt.Sprintf("-c:v:%d", i), "libx264",
			fmt.Sprintf("-b:v:%d", i), q.Bitrate,
			"-r", "24", "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
		)
	}

	if hasAudio {
		for i := range activeQualities {
			args = append(args,
				"-map", "0:a?",
				fmt.Sprintf("-c:a:%d", i), "aac",
				fmt.Sprintf("-b:a:%d", i), "128k",
			)
		}
	}

	args = append(args,
		"-f", "hls",
		"-hls_time", "4",
		"-hls_playlist_type", "vod",
		"-hls_flags", "independent_segments",
		"-hls_segment_type", "mpegts",
		"-hls_segment_filename", "stream_%v_%03d.ts",
		"-master_pl_name", "playlist.m3u8",
	)

	var streamMapBuilder strings.Builder
	for i := range activeQualities {
		if hasAudio {
			streamMapBuilder.WriteString(fmt.Sprintf("v:%d,a:%d ", i, i))
		} else {
			streamMapBuilder.WriteString(fmt.Sprintf("v:%d ", i))
		}
	}

	args = append(args, "-var_stream_map", strings.TrimSpace(streamMapBuilder.String()))
	args = append(args, "stream_%v.m3u8")

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.Dir = workDir

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("could not create stderr pipe: %v", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("could not start ffmpeg: %v", err)
	}

	buf := make([]byte, 1024)
	for {
		n, err := stderr.Read(buf)
		if n > 0 {
			line := string(buf[:n])
			if strings.Contains(line, "time=") {
				idx := strings.Index(line, "time=")
				timeStr := line[idx+5 : idx+16]
				currentTime := parseFFmpegTime(timeStr)
				progress := (currentTime / totalDuration) * 100
				if progress > 99 {
					progress = 99
				}
				progressJSON := fmt.Sprintf(`{"status": "transcoding", "progress": %.1f}`, progress)
				rdb.Set(ctx, progressKey, progressJSON, 0)
			}
		}
		if err != nil {
			break
		}
	}

	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("ffmpeg failed: %v", err)
	}

	rdb.Set(ctx, progressKey, `{"status": "uploading", "progress": 99}`, 0)
	log.Println("Uploading HLS chunks to MinIO public-videos bucket...")
	files, err := os.ReadDir(workDir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".m3u8") || strings.HasSuffix(file.Name(), ".ts") {
			localFilePath := filepath.Join(workDir, file.Name())
			s3Key := fmt.Sprintf("%s/%s", folderName, file.Name())

			contentType := "video/MP2T"
			if strings.HasSuffix(file.Name(), ".m3u8") {
				contentType = "application/vnd.apple.mpegurl"
			}

			_, err = s3Client.FPutObject(ctx, "public-videos", s3Key, localFilePath, minio.PutObjectOptions{
				ContentType: contentType,
			})
			if err != nil {
				return fmt.Errorf("failed to upload chunk %s: %v", file.Name(), err)
			}
		}
	}

	return nil
}

func parseFFmpegTime(timeStr string) float64 {
	parts := strings.Split(timeStr, ":")
	if len(parts) != 3 {
		return 0
	}
	h, _ := strconv.ParseFloat(parts[0], 64)
	m, _ := strconv.ParseFloat(parts[1], 64)
	s, _ := strconv.ParseFloat(parts[2], 64)
	return h*3600 + m*60 + s
}
