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

	HTTPPort   int    // 7880
	Secure     bool   // false => ws, true => wss
	PublicHost string // если задано: всегда используем его (лучше для телефона)
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

	if s.PublicHost != "" {
		hostname = s.PublicHost
	}

	scheme := "ws"
	if s.Secure {
		scheme = "wss" // ✅ secure => wss
	}

	return fmt.Sprintf("%s://%s:%d", scheme, hostname, s.HTTPPort)
}

func extractHostname(host string) string {
	h := strings.TrimSpace(host)
	if h == "" {
		return "localhost"
	}

	// IPv6: "[::1]:3010"
	if strings.Contains(h, ":") {
		if hh, _, err := net.SplitHostPort(h); err == nil {
			return strings.Trim(hh, "[]")
		}
		// fallback для "host:port"
		if i := strings.LastIndex(h, ":"); i > 0 {
			return strings.Trim(h[:i], "[]")
		}
	}

	return strings.Trim(h, "[]")
}

func boolPtr(v bool) *bool { return &v }

// JoinToken with role-based permissions.
// role: "teacher" | "student"
func (s *LiveKitService) JoinToken(room, identity, displayName, role string) (string, error) {
	role = strings.ToLower(strings.TrimSpace(role))
	if role == "" {
		role = "student"
	}

	at := lkauth.NewAccessToken(s.APIKey, s.APISecret)
	at.SetIdentity(identity)
	at.SetName(displayName)

	// базовые права всем: зайти + смотреть + чат
	grant := &lkauth.VideoGrant{
		RoomJoin: true,
		Room:     room,

		// В твоей версии это *bool
		CanSubscribe:   boolPtr(true),
		CanPublishData: boolPtr(true),
	}

	// teacher может публиковать видео/мик/шэр экрана
	if role == "teacher" {
		grant.CanPublish = boolPtr(true)
		grant.CanPublishSources = []string{
			"camera",
			"microphone",
			"screen_share",
		}
	} else {
		// student по умолчанию НЕ публикует видео/мик
		grant.CanPublish = boolPtr(false)
		grant.CanPublishSources = nil
	}

	at.AddGrant(grant)
	at.SetValidFor(time.Hour)

	// опционально: роль в metadata (можно читать на фронте через participant.metadata)
	_ = at.SetMetadata(fmt.Sprintf(`{"role":"%s"}`, role))

	return at.ToJWT()
}
