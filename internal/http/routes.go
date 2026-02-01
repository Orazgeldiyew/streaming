package http

import (
	"database/sql"
	nethttp "net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"streaming/internal/config"
	"streaming/internal/http/handlers"
	"streaming/internal/middleware"
	"streaming/internal/service"
)

func RegisterRoutes(
	r *gin.Engine,
	cfg *config.Config,
	db *sql.DB,
) {
	// ✅ безопасность
	_ = r.SetTrustedProxies(nil)

	// ================================
	// ADMIN (protected)
	// ================================
	admin := r.Group("/api/admin")
	admin.Use(middleware.AdminBasicAuth(cfg.Admin.Username, cfg.Admin.Password))
	{
		admin.GET("/summary", handlers.AdminSummary(db))
	}

	// ================================
	// API (protected)
	// ================================
	api := r.Group("/api/v1")
	api.Use(middleware.APIAuth(cfg.API.KeySecret))

	api.POST("/livekit/join",
		handlers.LiveKitJoin(
			service.NewLiveKitService(
				cfg.LiveKit.APIKey,
				cfg.LiveKit.APISecret,
				cfg.LiveKit.Port,
				cfg.LiveKit.Secure,
				cfg.LiveKit.PublicHost,
			),
			cfg.API.TeacherKey,
			db,
		),
	)

	// ================================
	// Health
	// ================================
	r.GET("/healthz", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.String(nethttp.StatusServiceUnavailable, "db error")
			return
		}
		c.String(nethttp.StatusOK, "ok")
	})

	// ================================
	// Frontend (Vite)
	// ================================
	r.Static("/assets", "./web/dist/assets")

	r.GET("/", func(c *gin.Context) {
		c.File("./web/dist/index.html")
	})

	r.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path

		if strings.HasPrefix(p, "/api/") ||
			strings.HasPrefix(p, "/assets/") {
			c.String(nethttp.StatusNotFound, "404 page not found")
			return
		}

		c.File("./web/dist/index.html")
	})
}
