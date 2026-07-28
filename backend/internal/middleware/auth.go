package middleware

import (
	"net/http"

	"homefinance/internal/auth"
	"homefinance/internal/httpx"
)

const AuthCookieName = "ledger_token"

// publicPaths never require a valid session — they're how you get one
// (or clear one) in the first place.
var publicPaths = map[string]bool{
	"/api/health":           true,
	"/api/v1/auth/register": true,
	"/api/v1/auth/login":    true,
	"/api/v1/auth/logout":   true,
}

// RequireAuth verifies the JWT carried in the ledger_token cookie and, on
// success, attaches its claims to the request context so handlers (like
// GET /api/v1/auth/me) can identify the caller.
func RequireAuth(jwtSecret string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions || publicPaths[r.URL.Path] {
			next.ServeHTTP(w, r)
			return
		}

		cookie, err := r.Cookie(AuthCookieName)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "authentication required")
			return
		}

		claims, err := auth.ParseJWT(jwtSecret, cookie.Value)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "invalid or expired session")
			return
		}

		next.ServeHTTP(w, r.WithContext(auth.WithUser(r.Context(), claims)))
	})
}
