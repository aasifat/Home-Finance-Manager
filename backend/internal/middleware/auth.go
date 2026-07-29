package middleware

import (
	"net/http"
	"strings"

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

// tokenFromRequest prefers the Authorization: Bearer header — the frontend
// and backend are on different domains (Vercel/Render), and browsers won't
// reliably send cross-site cookies (SameSite, and third-party cookie
// blocking that no SameSite setting can override). The cookie is kept as a
// fallback for same-site local dev.
func tokenFromRequest(r *http.Request) string {
	if authz := r.Header.Get("Authorization"); authz != "" {
		if rest, ok := strings.CutPrefix(authz, "Bearer "); ok {
			return rest
		}
	}
	if cookie, err := r.Cookie(AuthCookieName); err == nil {
		return cookie.Value
	}
	return ""
}

// RequireAuth verifies the caller's JWT and, on success, attaches its claims
// to the request context so handlers (like GET /api/v1/auth/me) can
// identify the caller.
func RequireAuth(jwtSecret string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions || publicPaths[r.URL.Path] {
			next.ServeHTTP(w, r)
			return
		}

		token := tokenFromRequest(r)
		if token == "" {
			httpx.Error(w, http.StatusUnauthorized, "authentication required")
			return
		}

		claims, err := auth.ParseJWT(jwtSecret, token)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "invalid or expired session")
			return
		}

		next.ServeHTTP(w, r.WithContext(auth.WithUser(r.Context(), claims)))
	})
}
