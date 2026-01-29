package http

import (
	nethttp "net/http"
	"strings"

	"streaming/internal/config"
	"streaming/internal/http/handlers"
	"streaming/internal/middleware"
	"streaming/internal/service"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine, cfg config.Config) {

	// ✅ важно: не доверять всем прокси (убирает WARNING и безопаснее)
	_ = r.SetTrustedProxies(nil)

	// ================================
	// 1) API (protected) — ВСЕГДА ДО SPA fallback
	// ================================
	api := r.Group("/api/v1")
	api.Use(middleware.APIAuth(cfg.API.KeySecret))
	api.POST("/livekit/join", handlers.LiveKitJoin(
		service.NewLiveKitService(
			cfg.LiveKit.APIKey,
			cfg.LiveKit.APISecret,
			cfg.LiveKit.Port,   // 7880
			cfg.LiveKit.Secure, // false => ws, true => wss
			cfg.LiveKit.PublicHost,
		),
		cfg.API.TeacherKey, // ✅ добавили teacherKey (см. ниже)
	))

	// healthcheck
	r.GET("/healthz", func(c *gin.Context) {
		c.String(nethttp.StatusOK, "ok")
	})

	// ================================
	// 2) FRONTEND (Vite production)
	// ================================
	// Vite assets
	r.Static("/assets", "./web/dist/assets")

	// index.html entry
	r.GET("/", func(c *gin.Context) {
		c.File("./web/dist/index.html")
	})

	// SPA routes (чтобы прямые ссылки работали)
	r.GET("/join/:room", func(c *gin.Context) {
		c.File("./web/dist/index.html")
	})
	r.GET("/newroom", func(c *gin.Context) {
		c.File("./web/dist/index.html")
	})

	// ================================
	// 3) SPA fallback (НО не для /api и не для /assets)
	// ================================
	r.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path

		// ✅ не перехватываем API/Assets
		if strings.HasPrefix(p, "/api/") || strings.HasPrefix(p, "/assets/") {
			c.String(nethttp.StatusNotFound, "404 page not found")
			return
		}

		// всё остальное — SPA
		c.File("./web/dist/index.html")
	})
}
