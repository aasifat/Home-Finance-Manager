package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"homefinance/internal/auth"
	"homefinance/internal/config"
	"homefinance/internal/email"
	"homefinance/internal/httpx"
)

type Handler struct {
	DB   *sql.DB
	Mail *email.Service
	Cfg  *config.Config
}

func New(db *sql.DB, mail *email.Service, cfg *config.Config) *Handler {
	return &Handler{DB: db, Mail: mail, Cfg: cfg}
}

// idFromPath extracts the trailing {id} path value from a Go 1.22 mux
// pattern, e.g. "/api/bills/{id}".
func idFromPath(r *http.Request) (int, error) {
	return strconv.Atoi(r.PathValue("id"))
}

// userID reads the authenticated user's id from the JWT claims the
// RequireAuth middleware attached to the request context. Every data
// handler uses this instead of a shared constant, so every query is
// scoped to whoever is actually signed in.
func userID(r *http.Request) (int, error) {
	claims, ok := auth.UserFromContext(r.Context())
	if !ok {
		return 0, errors.New("missing authentication")
	}
	return claims.UserID, nil
}

// requireUserID is the same lookup but writes a 401 directly, for the
// common case where a handler can't proceed at all without it. Returns
// ok=false if it already wrote a response.
func requireUserID(w http.ResponseWriter, r *http.Request) (id int, ok bool) {
	id, err := userID(r)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return 0, false
	}
	return id, true
}

// checkOwnership looks up which user owns the row with the given id in
// table (which must have a user_id column) and reports whether it exists
// at all, and whether it belongs to userID — letting callers distinguish
// 404 Not Found from 403 Forbidden instead of silently no-oping.
// table is always a fixed string from our own code, never request input.
func (h *Handler) checkOwnership(table string, id, userID int) (found, owned bool, err error) {
	var ownerID int
	q := fmt.Sprintf(`SELECT user_id FROM %s WHERE id = $1`, table)
	err = h.DB.QueryRow(q, id).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	return true, ownerID == userID, nil
}

// enforceOwnership is checkOwnership plus writing the appropriate 404/403
// response. Returns ok=true only if the row exists and belongs to userID.
func (h *Handler) enforceOwnership(w http.ResponseWriter, table string, id, userID int) bool {
	found, owned, err := h.checkOwnership(table, id, userID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not verify ownership: "+err.Error())
		return false
	}
	if !found {
		httpx.Error(w, http.StatusNotFound, "not found")
		return false
	}
	if !owned {
		httpx.Error(w, http.StatusForbidden, "you do not have access to this resource")
		return false
	}
	return true
}

// monthKeyToRange converts a "2026-07" style key into [start, end) date
// strings suitable for a SQL BETWEEN / >= < filter.
func monthKeyToRange(key string) (start, end string, ok bool) {
	parts := strings.Split(key, "-")
	if len(parts) != 2 {
		return "", "", false
	}
	y, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || m < 1 || m > 12 {
		return "", "", false
	}
	start = key + "-01"
	nextM, nextY := m+1, y
	if nextM > 12 {
		nextM = 1
		nextY++
	}
	end = pad4(nextY) + "-" + pad2(nextM) + "-01"
	return start, end, true
}

func pad2(n int) string {
	if n < 10 {
		return "0" + strconv.Itoa(n)
	}
	return strconv.Itoa(n)
}
func pad4(n int) string {
	s := strconv.Itoa(n)
	for len(s) < 4 {
		s = "0" + s
	}
	return s
}
