package handlers

import (
	"database/sql"
	"net/http"
	"regexp"
	"strings"

	"github.com/lib/pq"

	"homefinance/internal/auth"
	"homefinance/internal/httpx"
	"homefinance/internal/middleware"
	"homefinance/internal/models"
)

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// defaultBudgets seeds a starter monthly budget for every new user, so
// the Budget page isn't empty on day one — the same defaults the old
// single-household demo shipped with.
var defaultBudgets = map[string]float64{
	"groceries":     450,
	"transport":     120,
	"bills":         160,
	"education":     200,
	"medical":       100,
	"shopping":      150,
	"dining":        100,
	"housing":       650,
	"other_expense": 80,
}

func setAuthCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     middleware.AuthCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(auth.TokenTTL.Seconds()),
	})
}

func clearAuthCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     middleware.AuthCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

type registerInput struct {
	FullName        string `json:"fullName"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

// Register creates a new user account. It does not sign the user in —
// they're sent to the login page to sign in with their new credentials.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var in registerInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}

	in.FullName = strings.TrimSpace(in.FullName)
	email := strings.ToLower(strings.TrimSpace(in.Email))

	if in.FullName == "" {
		httpx.Error(w, http.StatusBadRequest, "full name is required")
		return
	}
	if !emailPattern.MatchString(email) {
		httpx.Error(w, http.StatusBadRequest, "a valid email address is required")
		return
	}
	if len(in.Password) < 8 {
		httpx.Error(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if in.Password != in.ConfirmPassword {
		httpx.Error(w, http.StatusBadRequest, "passwords do not match")
		return
	}

	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not hash password")
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "tx begin: "+err.Error())
		return
	}
	defer tx.Rollback()

	var user models.User
	err = tx.QueryRow(
		`INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3)
		 RETURNING id, full_name, email`,
		in.FullName, email, hash,
	).Scan(&user.ID, &user.FullName, &user.Email)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			httpx.Error(w, http.StatusConflict, "an account with that email already exists")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "could not create account: "+err.Error())
		return
	}

	// Auto-provision this user's private profile, notification settings,
	// and a starter budget — everything downstream assumes these rows
	// already exist (matches what schema.sql used to seed for the old
	// single shared household).
	if _, err := tx.Exec(
		`INSERT INTO families (user_id, name, email, currency) VALUES ($1, $2, $3, 'USD')`,
		user.ID, in.FullName+"'s Household", email,
	); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not set up profile: "+err.Error())
		return
	}
	if _, err := tx.Exec(
		`INSERT INTO notification_settings (user_id) VALUES ($1)`, user.ID,
	); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not set up notification settings: "+err.Error())
		return
	}
	for category, limit := range defaultBudgets {
		if _, err := tx.Exec(
			`INSERT INTO budgets (user_id, category, monthly_limit) VALUES ($1, $2, $3)`,
			user.ID, category, limit,
		); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not set up budget: "+err.Error())
			return
		}
	}

	if err := tx.Commit(); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "tx commit: "+err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, user)
}

type loginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var in loginInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))

	var user models.User
	var hash string
	err := h.DB.QueryRow(
		`SELECT id, full_name, email, password_hash FROM users WHERE email = $1`, email,
	).Scan(&user.ID, &user.FullName, &user.Email, &hash)
	if err == sql.ErrNoRows || (err == nil && !auth.CheckPassword(hash, in.Password)) {
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not log in: "+err.Error())
		return
	}

	token, err := auth.GenerateJWT(h.Cfg.JWTSecret, user.ID, user.Email)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not start session")
		return
	}
	setAuthCookie(w, token)
	httpx.JSON(w, http.StatusOK, user)
}

// Me returns the signed-in user's profile, re-read from the database so
// it reflects any changes since the token was issued.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var user models.User
	err := h.DB.QueryRow(
		`SELECT id, full_name, email FROM users WHERE id = $1`, claims.UserID,
	).Scan(&user.ID, &user.FullName, &user.Email)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "user no longer exists")
		return
	}
	httpx.JSON(w, http.StatusOK, user)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	clearAuthCookie(w)
	httpx.JSON(w, http.StatusOK, nil)
}
