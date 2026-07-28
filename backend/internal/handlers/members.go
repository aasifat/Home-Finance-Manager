package handlers

import (
	"net/http"
	"strings"

	"homefinance/internal/httpx"
	"homefinance/internal/models"
)

func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	rows, err := h.DB.Query(
		`SELECT id, name, email, role, invitation_status, invited_at
		 FROM family_members WHERE user_id = $1 ORDER BY created_at`, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load members: "+err.Error())
		return
	}
	defer rows.Close()

	members := []models.Member{}
	for rows.Next() {
		var m models.Member
		if err := rows.Scan(&m.ID, &m.Name, &m.Email, &m.Role, &m.InvitationStatus, &m.InvitedAt); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "scan member: "+err.Error())
			return
		}
		members = append(members, m)
	}
	httpx.JSON(w, http.StatusOK, members)
}

// CreateMember adds a family member and — because they were given an email
// address — sends them an invitation email to the shared account.
func (h *Handler) CreateMember(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var in models.Member
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.TrimSpace(in.Email)
	if in.Name == "" {
		httpx.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	if in.Email == "" || !strings.Contains(in.Email, "@") {
		httpx.Error(w, http.StatusBadRequest, "a valid email is required to invite a family member")
		return
	}
	if in.Role == "" {
		in.Role = "Member"
	}

	var m models.Member
	err := h.DB.QueryRow(
		`INSERT INTO family_members (user_id, name, email, role, invitation_status)
		 VALUES ($1, $2, $3, $4, 'pending')
		 RETURNING id, name, email, role, invitation_status, invited_at`,
		uid, in.Name, in.Email, in.Role,
	).Scan(&m.ID, &m.Name, &m.Email, &m.Role, &m.InvitationStatus, &m.InvitedAt)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not add member: "+err.Error())
		return
	}

	// Look up the household name for a friendlier email, then send the
	// invitation asynchronously so the API responds immediately.
	var familyName string
	_ = h.DB.QueryRow(`SELECT name FROM families WHERE user_id = $1`, uid).Scan(&familyName)

	go h.sendInviteAndRecordStatus(m.ID, m.Name, m.Email, familyName)

	httpx.JSON(w, http.StatusCreated, m)
}

func (h *Handler) sendInviteAndRecordStatus(memberID int, name, email, familyName string) {
	status := "sent"
	if err := h.Mail.SendInvitation(name, email, familyName, h.Cfg.FrontendURL); err != nil {
		status = "failed"
	}
	_, _ = h.DB.Exec(
		`UPDATE family_members SET invitation_status = $1, invited_at = now() WHERE id = $2`,
		status, memberID,
	)
}

// ResendInvite lets the household re-send an invitation, e.g. after a
// bounce or if the member lost the original email.
func (h *Handler) ResendInvite(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "family_members", id, uid) {
		return
	}

	var name, memberEmail, familyName string
	err = h.DB.QueryRow(
		`SELECT fm.name, fm.email, f.name FROM family_members fm
		 JOIN families f ON f.user_id = fm.user_id
		 WHERE fm.id = $1 AND fm.user_id = $2`, id, uid,
	).Scan(&name, &memberEmail, &familyName)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "member not found")
		return
	}

	go h.sendInviteAndRecordStatus(id, name, memberEmail, familyName)
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "sending"})
}

func (h *Handler) DeleteMember(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "family_members", id, uid) {
		return
	}
	if _, err := h.DB.Exec(`DELETE FROM family_members WHERE id = $1 AND user_id = $2`, id, uid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not delete member: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}
