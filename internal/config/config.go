package config

import (
	"os"
	"strconv"
)

// =======================
// Main Config struct
// =======================

type Config struct {
	ListenIP string
	Port     int

	TLS struct {
		Enabled  bool
		CertFile string
		KeyFile  string
	}

	HostProtection struct {
		Protected bool
		Username  string
		Password  string
	}

	API struct {
		// 🔐 API protection for /api/*
		KeySecret string

		// 🎓 Teacher role protection
		TeacherKey string
	}

	LiveKit struct {
		APIKey     string
		APISecret  string
		Port       int    // 7880
		Secure     bool   // false => ws, true => wss
		PublicHost string // IP / domain for clients
	}

	Paths struct {
		PublicDir string
		ViewsDir  string
	}
}

// =======================
// Load config from ENV
// =======================

func Load() Config {
	var c Config

	// =======================
	// HTTP server
	// =======================
	c.ListenIP = envString("APP_LISTEN_IP", "0.0.0.0")
	c.Port = envInt("APP_PORT", 3010)

	// =======================
	// TLS
	// =======================
	c.TLS.Enabled = envBool("TLS_ENABLED", false)
	c.TLS.CertFile = envString("TLS_CERT_FILE", "ssl/cert.pem")
	c.TLS.KeyFile = envString("TLS_KEY_FILE", "ssl/key.pem")

	// =======================
	// Host protection (basic auth)
	// =======================
	c.HostProtection.Protected = envBool("HOST_PROTECTED", false)
	c.HostProtection.Username = envString("HOST_USERNAME", "admin")
	c.HostProtection.Password = envString("HOST_PASSWORD", "admin")

	// =======================
	// API
	// =======================
	c.API.KeySecret = envString("API_KEY_SECRET", "secret123")

	// 🔑 Teacher role secret
	// если пусто — teacher НИКОГДА не выдается
	c.API.TeacherKey = envString("API_TEACHER_KEY", "")

	// =======================
	// LiveKit (🔥 ВАЖНО)
	// =======================
	c.LiveKit.APIKey = envString("LIVEKIT_API_KEY", "devkey")
	c.LiveKit.APISecret = envString(
		"LIVEKIT_API_SECRET",
		"CHANGE_ME_MIN_32_CHARS_SECRET",
	)
	c.LiveKit.Port = envInt("LIVEKIT_PORT", 7880)
	c.LiveKit.Secure = envBool("LIVEKIT_SECURE", false)

	// ⚠️ В production ОБЯЗАТЕЛЬНО указать реальный IP или домен
	c.LiveKit.PublicHost = envString("LIVEKIT_PUBLIC_HOST", "127.0.0.1")

	// =======================
	// Static paths
	// =======================
	c.Paths.PublicDir = envString("PUBLIC_DIR", "web/public")
	c.Paths.ViewsDir = envString("VIEWS_DIR", "web/views")

	return c
}

// =======================
// Helpers
// =======================

func (c Config) ListenAddr() string {
	return c.ListenIP + ":" + strconv.Itoa(c.Port)
}

func envString(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return def
}

func envBool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		return v == "true" || v == "1"
	}
	return def
}
