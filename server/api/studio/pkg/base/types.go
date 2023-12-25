package base

import "time"

type StatusCode int

type Result interface{}

const (
	Error   StatusCode = -1
	Success StatusCode = 0
)

type Process struct {
	TotalSize        int     `json:"total"`
	CurrentSize      int     `json:"current"`
	Ratio            float64 `json:"ratio"`
	FailedReason     string  `json:"failed_reason"`
	PromptTokens     int     `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
}

type LLMStatus string

const (
	LLMStatusRunning LLMStatus = "running"
	LLMStatusSuccess LLMStatus = "success"
	LLMStatusFailed  LLMStatus = "failed"
	LLMStatusCancel  LLMStatus = "cancel"
	LLMStatusPending LLMStatus = "pending"
)

type LLMJobType string

const (
	LLMJobTypeFile     LLMJobType = "file"
	LLMJobTypeFilePath LLMJobType = "file_path"
)

// set the timeout for the graph service: 8 hours
// once the timeout is reached, the connection will be closed
// all requests running ngql will be failed, so keepping a long timeout is necessary, make the connection alive
const GraphServiceTimeout = 8 * time.Hour
