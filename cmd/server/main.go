package main

import (
	"log"

	"github.com/joho/godotenv"
	"streaming/internal/config"
	httpserver "streaming/internal/http"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ .env not found, using system env")
	}
	cfg := config.Load()

	if err := httpserver.Run(cfg); err != nil {
		log.Fatal(err)
	}
}
