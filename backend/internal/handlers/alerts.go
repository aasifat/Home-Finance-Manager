package handlers

import (
	"fmt"
	"net/http"
	"time"

	"homefinance/internal/httpx"
)

type Alert struct {
	ID       string `json:"id"`
	Type     string `json:"type"`     // bill | invite | budget | spending
	Severity string `json:"severity"` // info | warning | critical
	Title    string `json:"title"`
	Message  string `json:"message"`
}

// GetAlerts powers the notification bell: real, user-scoped alerts computed
// from the signed-in user's own data, rather than a separate notifications
// table to keep in sync.
func (h *Handler) GetAlerts(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	alerts := []Alert{}
	now := time.Now()

	alerts = append(alerts, h.billAlerts(uid, now)...)
	alerts = append(alerts, h.invitationAlerts(uid)...)
	alerts = append(alerts, h.budgetAlerts(uid, now)...)
	if a := h.spendingAlert(uid, now); a != nil {
		alerts = append(alerts, *a)
	}

	httpx.JSON(w, http.StatusOK, alerts)
}

// billAlerts flags bills whose due day falls within the next 7 days.
func (h *Handler) billAlerts(uid int, now time.Time) []Alert {
	alerts := []Alert{}
	rows, err := h.DB.Query(
		`SELECT id, name, amount, due_day FROM bills WHERE user_id = $1`, uid,
	)
	if err != nil {
		return alerts
	}
	defer rows.Close()

	daysInMonth := time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, now.Location()).Day()
	for rows.Next() {
		var id, dueDay int
		var name string
		var amount float64
		if err := rows.Scan(&id, &name, &amount, &dueDay); err != nil {
			continue
		}
		daysUntil := dueDay - now.Day()
		if daysUntil < 0 {
			daysUntil += daysInMonth
		}
		if daysUntil > 7 {
			continue
		}
		severity := "info"
		due := fmt.Sprintf("in %d days", daysUntil)
		if daysUntil == 0 {
			severity, due = "critical", "today"
		} else if daysUntil == 1 {
			severity, due = "warning", "tomorrow"
		} else if daysUntil <= 3 {
			severity = "warning"
		}
		alerts = append(alerts, Alert{
			ID:       fmt.Sprintf("bill-%d", id),
			Type:     "bill",
			Severity: severity,
			Title:    name,
			Message:  fmt.Sprintf("$%.2f is due %s.", amount, due),
		})
	}
	return alerts
}

// invitationAlerts flags this user's invited members whose invitation
// email failed to send.
func (h *Handler) invitationAlerts(uid int) []Alert {
	alerts := []Alert{}
	rows, err := h.DB.Query(
		`SELECT id, name FROM family_members WHERE user_id = $1 AND invitation_status = 'failed'`, uid,
	)
	if err != nil {
		return alerts
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			continue
		}
		alerts = append(alerts, Alert{
			ID:       fmt.Sprintf("invite-%d", id),
			Type:     "invite",
			Severity: "critical",
			Title:    "Invitation failed",
			Message:  fmt.Sprintf("%s's invite email didn't go out — resend it from Profile.", name),
		})
	}
	return alerts
}

// budgetAlerts flags categories where this month's spending has passed the
// budgeted monthly limit.
func (h *Handler) budgetAlerts(uid int, now time.Time) []Alert {
	alerts := []Alert{}
	start, end, ok := monthKeyToRange(now.Format("2006-01"))
	if !ok {
		return alerts
	}

	rows, err := h.DB.Query(
		`SELECT b.category, c.label, b.monthly_limit,
		        COALESCE((SELECT SUM(t.amount) FROM transactions t
		                  WHERE t.user_id = b.user_id AND t.category = b.category
		                    AND t.type = 'expense' AND t.date >= $2 AND t.date < $3), 0) AS spent
		 FROM budgets b JOIN categories c ON c.id = b.category
		 WHERE b.user_id = $1 AND b.monthly_limit > 0`,
		uid, start, end,
	)
	if err != nil {
		return alerts
	}
	defer rows.Close()

	for rows.Next() {
		var category, label string
		var limit, spent float64
		if err := rows.Scan(&category, &label, &limit, &spent); err != nil {
			continue
		}
		if spent <= limit {
			continue
		}
		alerts = append(alerts, Alert{
			ID:       "budget-" + category,
			Type:     "budget",
			Severity: "warning",
			Title:    label + " over budget",
			Message:  fmt.Sprintf("$%.0f spent against a $%.0f monthly limit.", spent, limit),
		})
	}
	return alerts
}

// spendingAlert flags total spending crossing this user's configured
// percentage-of-income threshold for the current month.
func (h *Handler) spendingAlert(uid int, now time.Time) *Alert {
	var enabled bool
	var threshold int
	if err := h.DB.QueryRow(
		`SELECT spending_alerts, reminder_threshold FROM notification_settings WHERE user_id = $1`, uid,
	).Scan(&enabled, &threshold); err != nil || !enabled {
		return nil
	}

	start, end, ok := monthKeyToRange(now.Format("2006-01"))
	if !ok {
		return nil
	}

	var income, expense float64
	_ = h.DB.QueryRow(
		`SELECT COALESCE(SUM(amount) FILTER (WHERE type='income'), 0),
		        COALESCE(SUM(amount) FILTER (WHERE type='expense'), 0)
		 FROM transactions WHERE user_id=$1 AND date >= $2 AND date < $3`,
		uid, start, end,
	).Scan(&income, &expense)

	if income <= 0 {
		return nil
	}
	pct := (expense / income) * 100
	if pct < float64(threshold) {
		return nil
	}

	return &Alert{
		ID:       "spending-" + now.Format("2006-01"),
		Type:     "spending",
		Severity: "warning",
		Title:    "Spending pace alert",
		Message:  fmt.Sprintf("You've spent %.0f%% of this month's income — your alert threshold is %d%%.", pct, threshold),
	}
}
