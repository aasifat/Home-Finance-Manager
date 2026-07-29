package handlers

import (
	"net/http"

	"homefinance/internal/httpx"
	"homefinance/internal/models"
)

func (h *Handler) GetFamily(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var f models.Family
	err := h.DB.QueryRow(
		`SELECT name, COALESCE(email,''), currency FROM families WHERE user_id = $1`, uid,
	).Scan(&f.Name, &f.Email, &f.Currency)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load profile: "+err.Error())
		return
	}
	f.ID = uid
	httpx.JSON(w, http.StatusOK, f)
}

// supportedCurrencies are the currencies selectable from the Profile page.
var supportedCurrencies = map[string]bool{
	"BDT": true,
	"KRW": true,
	"USD": true,
}

func (h *Handler) UpdateFamily(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var in models.Family
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	if in.Currency != "" && !supportedCurrencies[in.Currency] {
		httpx.Error(w, http.StatusBadRequest, "unsupported currency: "+in.Currency)
		return
	}
	_, err := h.DB.Exec(
		`UPDATE families SET name = $1, email = $2, currency = $3 WHERE user_id = $4`,
		in.Name, in.Email, in.Currency, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not update profile: "+err.Error())
		return
	}
	h.GetFamily(w, r)
}

func (h *Handler) GetNotifications(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var n models.NotificationSettings
	err := h.DB.QueryRow(
		`SELECT monthly_reminder, weekly_summary, bill_reminders, spending_alerts, reminder_threshold
		 FROM notification_settings WHERE user_id = $1`, uid,
	).Scan(&n.MonthlyReminder, &n.WeeklySummary, &n.BillReminders, &n.SpendingAlerts, &n.ReminderThreshold)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load notification settings: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, n)
}

func (h *Handler) UpdateNotifications(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var n models.NotificationSettings
	if err := httpx.Decode(r, &n); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	_, err := h.DB.Exec(
		`UPDATE notification_settings
		 SET monthly_reminder = $1, weekly_summary = $2, bill_reminders = $3,
		     spending_alerts = $4, reminder_threshold = $5
		 WHERE user_id = $6`,
		n.MonthlyReminder, n.WeeklySummary, n.BillReminders, n.SpendingAlerts, n.ReminderThreshold, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not update notification settings: "+err.Error())
		return
	}
	h.GetNotifications(w, r)
}
