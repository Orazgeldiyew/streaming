package http

import (
	nethttp "net/http"

	"github.com/gin-gonic/gin"
	"streaming/internal/config"
	"streaming/internal/http/handlers"
	"streaming/internal/middleware"
	"streaming/internal/service"
)

func RegisterRoutes(r *gin.Engine, cfg config.Config) {
	// static + templates
	r.Static("/public", cfg.Paths.PublicDir)
	r.LoadHTMLGlob(cfg.Paths.ViewsDir + "/*.html")

	// pages
	r.GET("/", func(c *gin.Context) {
		c.HTML(nethttp.StatusOK, "landing.html", gin.H{})
	})
	r.GET("/newroom", func(c *gin.Context) {
		c.HTML(nethttp.StatusOK, "newroom.html", gin.H{})
	})
	r.GET("/join/:room", func(c *gin.Context) {
		c.HTML(nethttp.StatusOK, "room.html", gin.H{"room": c.Param("room")})
	})

	// services
	lk := service.NewLiveKitService(
		cfg.LiveKit.APIKey,
		cfg.LiveKit.APISecret,
		cfg.LiveKit.Port,
		cfg.LiveKit.Secure,
		cfg.LiveKit.PublicHost, // <-- поставь сюда IP ПК (лучший вариант для телефона)
	)

	// api (protected)
	api := r.Group("/api/v1")
	api.Use(middleware.APIAuth(cfg.API.KeySecret))
	api.POST("/livekit/join", handlers.LiveKitJoin(lk))

	// 404 (важно: NoRoute после Static — ок)
	r.NoRoute(func(c *gin.Context) {
		c.String(nethttp.StatusNotFound, "404 page not found")
	})
}
