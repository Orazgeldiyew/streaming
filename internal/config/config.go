package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
)

// =======================
// Main Config struct
// =======================

type Config struct {
	// =======================
	// HTTP
	// =======================
	ListenIP string
	Port     int

	// =======================
	// Admin
	// =======================
	Admin struct {
		Username string
		Password string
	}

	// =======================
	// Database
	// =======================
	Database struct {
		URL string
	}

	// =======================
	// TLS
	// =======================
	TLS struct {
		Enabled  bool
		CertFile string
		KeyFile  string
	}

	// =======================
	// Host protection (Basic Auth - optional)
	// =======================
	HostProtection struct {
		Protected bool
		Username  string
		Password  string
	}

	// =======================
	// API
	// =======================
	API struct {
		// 🔐 API protection for /api/*
		KeySecret string

		// 🎓 Teacher role protection
		// если пусто — teacher НИКОГДА не выдается
		TeacherKey string
	}

	// =======================
	// LiveKit
	// =======================
	LiveKit struct {
		APIKey     string
		APISecret  string
		Port       int
		Secure     bool   // false => ws, true => wss
		PublicHost string // IP / domain for clients (важно для телефона)
	}

	// =======================
	// Paths (optional, legacy)
	// =======================
	Paths struct {
		PublicDir string
		ViewsDir  string
	}
}

// =======================
// Load config from ENV
// =======================

func Load() (*Config, error) {
	var c Config

	// =======================
	// HTTP server
	// =======================
	c.ListenIP = envString("APP_LISTEN_IP", "0.0.0.0")
	c.Port = envInt("APP_PORT", 3010)

	// =======================
	// Database
	// =======================
	// ✅ дефолт под твою БД classroom (ты уже её создал)
	c.Database.URL = envString(
		"DATABASE_URL",
		"postgres://postgres:postgres@localhost:5432/classroom?sslmode=disable",
	)

	// =======================
	// TLS
	// =======================
	c.TLS.Enabled = envBool("TLS_ENABLED", false)
	c.TLS.CertFile = envString("TLS_CERT_FILE", "ssl/cert.pem")
	c.TLS.KeyFile = envString("TLS_KEY_FILE", "ssl/key.pem")

	// =======================
	// Host protection
	// =======================
	c.HostProtection.Protected = envBool("HOST_PROTECTED", false)
	c.HostProtection.Username = envString("HOST_USERNAME", "admin")
	c.HostProtection.Password = envString("HOST_PASSWORD", "admin")

	// =======================
	// API
	// =======================
	c.API.KeySecret = envString("API_KEY_SECRET", "secret123")
	c.API.TeacherKey = envString("API_TEACHER_KEY", "") // пусто => teacher запретить

	// =======================
	// LiveKit
	// =======================
	c.LiveKit.APIKey = envString("LIVEKIT_API_KEY", "devkey")
	c.LiveKit.APISecret = envString("LIVEKIT_API_SECRET", "CHANGE_ME_MIN_32_CHARS_SECRET")
	c.LiveKit.Port = envInt("LIVEKIT_PORT", 7880)
	c.LiveKit.Secure = envBool("LIVEKIT_SECURE", false)

	// ⚠️ Важно: для телефона/другого ПК это должен быть IP твоего ПК, например 192.168.0.5
	// Если оставить 127.0.0.1 — телефон не подключится к LiveKit.
	c.LiveKit.PublicHost = envString("LIVEKIT_PUBLIC_HOST", "127.0.0.1")

	// =======================
	// Paths (optional)
	// =======================
	c.Paths.PublicDir = envString("PUBLIC_DIR", "web/public")
	c.Paths.ViewsDir = envString("VIEWS_DIR", "web/views")

	// =======================
	// Admin (NEW)
	// =======================
	c.Admin.Username = envString("ADMIN_USERNAME", "")
	c.Admin.Password = envString("ADMIN_PASSWORD", "")

	// =======================
	// Validation
	// =======================
	if err := validate(&c); err != nil {
		return nil, err
	}

	return &c, nil
}

// =======================
// Helpers
// =======================

func (c Config) ListenAddr() string {
	return c.ListenIP + ":" + strconv.Itoa(c.Port)
}

func envString(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return i
}

func envBool(key string, def bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if v == "" {
		return def
	}
	return v == "true" || v == "1" || v == "yes" || v == "y"
}

// =======================
// Validation
// =======================

func validate(c *Config) error {
	if c.ListenIP == "" {
		return errors.New("APP_LISTEN_IP is required")
	}

	if c.Port <= 0 || c.Port > 65535 {
		return errors.New("APP_PORT must be between 1 and 65535")
	}

	if strings.TrimSpace(c.Database.URL) == "" {
		return errors.New("DATABASE_URL is required")
	}

	// TLS sanity
	if c.TLS.Enabled {
		if strings.TrimSpace(c.TLS.CertFile) == "" || strings.TrimSpace(c.TLS.KeyFile) == "" {
			return errors.New("TLS is enabled but TLS_CERT_FILE or TLS_KEY_FILE is missing")
		}
	}

	// Admin
	if strings.TrimSpace(c.Admin.Username) == "" || strings.TrimSpace(c.Admin.Password) == "" {
		return errors.New("ADMIN_USERNAME and ADMIN_PASSWORD are required")
	}

	// API
	if strings.TrimSpace(c.API.KeySecret) == "" {
		return errors.New("API_KEY_SECRET is required")
	}

	// LiveKit
	if strings.TrimSpace(c.LiveKit.APIKey) == "" {
		return errors.New("LIVEKIT_API_KEY is required")
	}
	if len(strings.TrimSpace(c.LiveKit.APISecret)) < 32 {
		return errors.New("LIVEKIT_API_SECRET must be at least 32 characters")
	}
	if c.LiveKit.Port <= 0 || c.LiveKit.Port > 65535 {
		return errors.New("LIVEKIT_PORT must be between 1 and 65535")
	}

	// PublicHost must be set for LAN clients (not strictly required for localhost dev)
	if strings.TrimSpace(c.LiveKit.PublicHost) == "" {
		return errors.New("LIVEKIT_PUBLIC_HOST is required (set to PC IP for phone)")
	}

	// Host protection
	if c.HostProtection.Protected {
		if strings.TrimSpace(c.HostProtection.Username) == "" || strings.TrimSpace(c.HostProtection.Password) == "" {
			return errors.New("HOST_PROTECTED is true but HOST_USERNAME or HOST_PASSWORD is empty")
		}
	}

	return nil
}
