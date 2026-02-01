package db

import (
	"database/sql"
	"time"

	_ "github.com/lib/pq"
)

func New(dsn string) (*sql.DB, error) {
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}

	// ✅ базовые настройки пула (можно менять)
	conn.SetMaxOpenConns(20)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)

	if err := conn.Ping(); err != nil {
		_ = conn.Close()
		return nil, err
	}

	return conn, nil
}
