package http

import (
	"log"

	"github.com/gin-gonic/gin"
	"streaming/internal/config"
)

func NewRouter(cfg config.Config) *gin.Engine {
	r := gin.Default()
	RegisterRoutes(r, cfg)
	return r
}

func Run(cfg config.Config) error {
	r := NewRouter(cfg)
	log.Printf("HTTP listening on %s\n", cfg.ListenAddr())
	return r.Run(cfg.ListenAddr())
}
