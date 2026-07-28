package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	FrontendOrigin []string
	FrontendURL    string
	JWTSecret      string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	SMTPHost      string
	SMTPPort      int
	SMTPUsername  string
	SMTPPassword  string
	SMTPFromName  string
	SMTPFromEmail string
	EmailDryRun   bool
}

func Load() *Config {
	// It's fine if .env doesn't exist (e.g. in production, use real env vars).
	_ = godotenv.Load()

	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))
	dryRun, _ := strconv.ParseBool(getEnv("EMAIL_DRY_RUN", "true"))

	origins := strings.Split(getEnv("FRONTEND_ORIGIN", "http://localhost:5173"), ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}

	jwtSecret := getEnv("JWT_SECRET", "")
	if jwtSecret == "" {
		jwtSecret = "dev-insecure-secret-change-me"
		log.Println("WARNING: JWT_SECRET not set — using an insecure default. Set JWT_SECRET in .env before deploying.")
	}

	return &Config{
		Port:           getEnv("PORT", "8080"),
		FrontendOrigin: origins,
		FrontendURL:    getEnv("FRONTEND_URL", "http://localhost:5173"),
		JWTSecret:      jwtSecret,

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "postgres"),
		DBName:     getEnv("DB_NAME", "homefinance"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		SMTPHost:      getEnv("SMTP_HOST", ""),
		SMTPPort:      smtpPort,
		SMTPUsername:  getEnv("SMTP_USERNAME", ""),
		SMTPPassword:  getEnv("SMTP_PASSWORD", ""),
		SMTPFromName:  getEnv("SMTP_FROM_NAME", "Ledger — Home Finance"),
		SMTPFromEmail: getEnv("SMTP_FROM_EMAIL", ""),
		EmailDryRun:   dryRun,
	}
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
