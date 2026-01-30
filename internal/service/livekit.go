package service

import (
	"fmt"
	"net"
	"strings"
	"time"

	lkauth "github.com/livekit/protocol/auth"
)

type LiveKitService struct {
	APIKey    string
	APISecret string

	HTTPPort   int
	Secure     bool
	PublicHost string
}

func NewLiveKitService(apiKey, apiSecret string, httpPort int, secure bool, publicHost string) *LiveKitService {
	return &LiveKitService{
		APIKey:     apiKey,
		APISecret:  apiSecret,
		HTTPPort:   httpPort,
		Secure:     secure,
		PublicHost: strings.TrimSpace(publicHost),
	}
}

func (s *LiveKitService) WSURLFromRequestHost(hostHeader string) string {
	hostname := extractHostname(hostHeader)

	// ✅ если задан PublicHost — всегда он (лучше для телефона)
	if s.PublicHost != "" {
		hostname = s.PublicHost
	}

	scheme := "ws"
	if s.Secure {
		scheme = "wss"
	}

	// livekit-client ожидает базовый wsUrl без пути
	return fmt.Sprintf("%s://%s:%d", scheme, hostname, s.HTTPPort)
}

func extractHostname(host string) string {
	h := strings.TrimSpace(host)
	if h == "" {
		return "localhost"
	}

	// пример: "[::1]:3010" или "127.0.0.1:3010"
	if hh, _, err := net.SplitHostPort(h); err == nil {
		return strings.Trim(hh, "[]")
	}

	// fallback: если без порта
	return strings.Trim(h, "[]")
}

func boolPtr(v bool) *bool { return &v }

// JoinToken issues token with role-based permissions.
// role: "teacher" | "student"
func (s *LiveKitService) JoinToken(room, identity, displayName, role string) (string, error) {
	role = strings.ToLower(strings.TrimSpace(role))
	if role == "" {
		role = "student"
	}

	at := lkauth.NewAccessToken(s.APIKey, s.APISecret)
	at.SetIdentity(identity)
	at.SetName(displayName)

	grant := &lkauth.VideoGrant{
		RoomJoin: true,
		Room:     room,

		CanSubscribe:   boolPtr(true),
		CanPublishData: boolPtr(true), // ✅ чат всем
	}

	if role == "teacher" {
		grant.CanPublish = boolPtr(true)
		grant.CanPublishSources = []string{
			"camera",
			"microphone",
			"screen_share",
		}
	} else {
		// ✅ STUDENT ТОЖЕ МОЖЕТ ПУБЛИКОВАТЬ ВИДЕО И МИК
		grant.CanPublish = boolPtr(true)
		grant.CanPublishSources = []string{
			"camera",
			"microphone",
			"screen_share",
		}
	}

	at.AddGrant(grant)
	at.SetValidFor(time.Hour)

	// metadata: role
	_ = at.SetMetadata(fmt.Sprintf(`{"role":"%s"}`, role))

	return at.ToJWT()
}
