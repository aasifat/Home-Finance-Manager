package handlers

import (
	"net/http"

	"homefinance/internal/httpx"
	"homefinance/internal/models"
)

// ListCalendarEvents returns manually-added events for a given ?month=YYYY-MM.
// Income, expense, bill, and loan events are derived separately by the
// frontend from their own endpoints — this only covers events added via
// the calendar's "Add Event" button.
func (h *Handler) ListCalendarEvents(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	q := `SELECT id, type, title, COALESCE(amount,0), date, COALESCE(notes,''), repeat
	      FROM calendar_events WHERE user_id = $1`
	args := []interface{}{uid}

	if m := r.URL.Query().Get("month"); m != "" {
		if start, end, ok := monthKeyToRange(m); ok {
			args = append(args, start, end)
			q += " AND date >= $2 AND date < $3"
		}
	}
	q += " ORDER BY date"

	rows, err := h.DB.Query(q, args...)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load events: "+err.Error())
		return
	}
	defer rows.Close()

	events := []models.CalendarEvent{}
	for rows.Next() {
		var e models.CalendarEvent
		var date timeLike
		if err := rows.Scan(&e.ID, &e.Type, &e.Title, &e.Amount, &date, &e.Notes, &e.Repeat); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "scan event: "+err.Error())
			return
		}
		e.Date = date.String()
		events = append(events, e)
	}
	httpx.JSON(w, http.StatusOK, events)
}

func (h *Handler) CreateCalendarEvent(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var in models.CalendarEvent
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	if in.Title == "" || in.Date == "" {
		httpx.Error(w, http.StatusBadRequest, "title and date are required")
		return
	}
	if in.Type == "" {
		in.Type = "other"
	}
	if in.Repeat == "" {
		in.Repeat = "none"
	}
	err := h.DB.QueryRow(
		`INSERT INTO calendar_events (user_id, type, title, amount, date, notes, repeat)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		uid, in.Type, in.Title, in.Amount, in.Date, in.Notes, in.Repeat,
	).Scan(&in.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create event: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, in)
}

func (h *Handler) UpdateCalendarEvent(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "calendar_events", id, uid) {
		return
	}

	var in models.CalendarEvent
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	_, err = h.DB.Exec(
		`UPDATE calendar_events SET type=$1, title=$2, amount=$3, date=$4, notes=$5, repeat=$6
		 WHERE id=$7 AND user_id=$8`,
		in.Type, in.Title, in.Amount, in.Date, in.Notes, in.Repeat, id, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not update event: "+err.Error())
		return
	}
	in.ID = id
	httpx.JSON(w, http.StatusOK, in)
}

func (h *Handler) DeleteCalendarEvent(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "calendar_events", id, uid) {
		return
	}
	if _, err := h.DB.Exec(`DELETE FROM calendar_events WHERE id=$1 AND user_id=$2`, id, uid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not delete event: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}
