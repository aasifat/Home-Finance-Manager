package db

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"

	"homefinance/internal/config"
)

func Connect(cfg *config.Config) (*sql.DB, error) {
	conn, err := sql.Open("postgres", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	conn.SetMaxOpenConns(10)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(30 * time.Minute)

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	return conn, nil
}
