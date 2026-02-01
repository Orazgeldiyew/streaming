package http

import (
	"database/sql"
	"log"

	"github.com/gin-gonic/gin"

	"streaming/internal/config"
)

// =======================
// Router
// =======================

func NewRouter(
	cfg *config.Config,
	db *sql.DB,
) *gin.Engine {
	r := gin.Default()

	RegisterRoutes(r, cfg, db)

	return r
}

// =======================
// HTTP server
// =======================

func Run(
	cfg *config.Config,
	db *sql.DB,
) error {
	r := NewRouter(cfg, db)

	addr := cfg.ListenAddr()
	log.Printf("HTTP listening on %s\n", addr)

	return r.Run(addr)
}
