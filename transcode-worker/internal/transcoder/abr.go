package transcoder

import (
	"context"
	"os/exec"
	"strconv"
	"strings"

	"transcode-worker/internal/models"
)

func GetVideoInfo(ctx context.Context, inputPath string) (float64, bool, int, error) {
	// 1. Get Video Duration
	out, err := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", inputPath).Output()
	var totalDuration float64
	if err == nil {
		totalDuration, _ = strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	}
	if totalDuration == 0 {
		totalDuration = 100 // fallback
	}

	// 2. Check if video has audio
	audioOut, _ := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", inputPath).Output()
	hasAudio := len(strings.TrimSpace(string(audioOut))) > 0

	// 3. Get Video Height
	heightOut, _ := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=height", "-of", "csv=p=0", inputPath).Output()
	heightStr := strings.TrimSpace(string(heightOut))
	videoHeight, _ := strconv.Atoi(heightStr)
	if videoHeight == 0 {
		videoHeight = 1080 // fallback
	}

	return totalDuration, hasAudio, videoHeight, nil
}

func GenerateABRLadder(videoHeight int) []models.Quality {
	allQualities := []models.Quality{
		{Resolution: 2160, Bitrate: "14000k"},
		{Resolution: 1440, Bitrate: "8000k"},
		{Resolution: 1080, Bitrate: "5000k"},
		{Resolution: 720,  Bitrate: "2500k"},
		{Resolution: 480,  Bitrate: "1000k"},
	}

	var activeQualities []models.Quality
	for _, q := range allQualities {
		if videoHeight >= q.Resolution {
			activeQualities = append(activeQualities, q)
		}
	}
	if len(activeQualities) == 0 {
		activeQualities = append(activeQualities, models.Quality{Resolution: 480, Bitrate: "1000k"})
	}
	return activeQualities
}
