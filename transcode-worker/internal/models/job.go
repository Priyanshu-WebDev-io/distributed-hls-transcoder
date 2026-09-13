package models

type TranscodeJob struct {
	Filename string `json:"filename"`
}

type Quality struct {
	Resolution int
	Bitrate    string
}
