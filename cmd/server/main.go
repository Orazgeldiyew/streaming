package main

import (
	"log"

	"github.com/joho/godotenv"

	"streaming/internal/config"
	"streaming/internal/db"
	httpserver "streaming/internal/http"
)

func main() {
	// Загружаем .env (если есть)
	_ = godotenv.Load()

	// =========================
	// 1) Load config
	// =========================
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	// =========================
	// 2) Connect database
	// =========================
	dbConn, err := db.New(cfg.Database.URL) // ✅ ВАЖНО: Database.URL
	if err != nil {
		log.Fatal(err)
	}
	defer dbConn.Close()

	log.Println("✅ Database connected")

	// =========================
	// 3) Run HTTP server
	// =========================
	if err := httpserver.Run(cfg, dbConn); err != nil {
		log.Fatal(err)
	}
}
