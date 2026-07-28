package scheduler

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"homefinance/internal/email"
)

type Scheduler struct {
	db   *sql.DB
	mail *email.Service
}

func New(db *sql.DB, mail *email.Service) *Scheduler {
	return &Scheduler{db: db, mail: mail}
}

// Run starts a daily loop (checking once at startup, then once every 24h)
// that sends every user's end-of-month narrative summary, weekly recap,
// spending alerts, and any bill reminders due soon. Intended to run as a
// goroutine.
func (s *Scheduler) Run() {
	s.tick()
	ticker := time.NewTicker(24 * time.Hour)
	for range ticker.C {
		s.tick()
	}
}

func (s *Scheduler) tick() {
	now := time.Now()

	userIDs, err := s.allUserIDs()
	if err != nil {
		log.Printf("scheduler: could not list users: %v", err)
		return
	}

	for _, uid := range userIDs {
		if isLastDayOfMonth(now) {
			s.sendMonthEndSummary(uid, now)
		}
		s.sendUpcomingBillReminders(uid, now)
		s.sendWeeklySummaryIfDue(uid, now)
		s.sendSpendingAlertIfDue(uid, now)
	}
}

func (s *Scheduler) allUserIDs() ([]int, error) {
	rows, err := s.db.Query(`SELECT id FROM users`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func isLastDayOfMonth(t time.Time) bool {
	return t.AddDate(0, 0, 1).Day() == 1
}

func (s *Scheduler) sendMonthEndSummary(uid int, now time.Time) {
	monthKey := now.Format("2006-01")

	var alreadySent bool
	_ = s.db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM sent_summaries WHERE user_id=$1 AND month_key=$2)`,
		uid, monthKey,
	).Scan(&alreadySent)
	if alreadySent {
		return
	}

	var monthlyOn bool
	var familyName, familyEmail string
	err := s.db.QueryRow(
		`SELECT ns.monthly_reminder, f.name, COALESCE(f.email,'')
		 FROM notification_settings ns JOIN families f ON f.user_id = ns.user_id
		 WHERE ns.user_id = $1`, uid,
	).Scan(&monthlyOn, &familyName, &familyEmail)
	if err != nil || !monthlyOn || familyEmail == "" {
		return
	}

	var income, expense float64
	start := now.Format("2006-01") + "-01"
	end := now.AddDate(0, 1, -now.Day()+1).Format("2006-01-02")
	_ = s.db.QueryRow(
		`SELECT COALESCE(SUM(amount) FILTER (WHERE type='income'),0),
		        COALESCE(SUM(amount) FILTER (WHERE type='expense'),0)
		 FROM transactions WHERE user_id=$1 AND date >= $2 AND date < $3`,
		uid, start, end,
	).Scan(&income, &expense)

	balance := income - expense
	savingsPct := 0.0
	if income > 0 {
		savingsPct = (balance / income) * 100
	}

	narrative := simpleNarrative(familyName, income, expense, balance, savingsPct)
	monthLabel := now.Format("January 2006")

	recipients := s.collectRecipients(uid, familyEmail)
	for _, to := range recipients {
		if err := s.mail.SendMonthlySummary(to, familyName, monthLabel, narrative); err != nil {
			log.Printf("month-end summary to %s failed: %v", to, err)
		}
	}

	_, _ = s.db.Exec(
		`INSERT INTO sent_summaries (user_id, month_key) VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`, uid, monthKey,
	)
}

func (s *Scheduler) sendUpcomingBillReminders(uid int, now time.Time) {
	var remindersOn bool
	var familyEmail string
	err := s.db.QueryRow(
		`SELECT ns.bill_reminders, COALESCE(f.email,'')
		 FROM notification_settings ns JOIN families f ON f.user_id = ns.user_id
		 WHERE ns.user_id = $1`, uid,
	).Scan(&remindersOn, &familyEmail)
	if err != nil || !remindersOn || familyEmail == "" {
		return
	}

	// Bills due in exactly 3 days get a one-time reminder for this run.
	targetDay := now.AddDate(0, 0, 3).Day()

	rows, err := s.db.Query(
		`SELECT name, amount, due_day FROM bills WHERE user_id=$1 AND due_day=$2`,
		uid, targetDay,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	recipients := s.collectRecipients(uid, familyEmail)
	for rows.Next() {
		var name string
		var amount float64
		var dueDay int
		if err := rows.Scan(&name, &amount, &dueDay); err != nil {
			continue
		}
		for _, to := range recipients {
			if err := s.mail.SendBillReminder(to, name, amount, dueDay); err != nil {
				log.Printf("bill reminder to %s failed: %v", to, err)
			}
		}
	}
}

// sendWeeklySummaryIfDue emails a short recap once a week (checked every
// Monday) and records the ISO week in sent_summaries so it never repeats,
// reusing that table's (user_id, month_key) key with a "week:" prefix to
// distinguish it from month-end keys.
func (s *Scheduler) sendWeeklySummaryIfDue(uid int, now time.Time) {
	if now.Weekday() != time.Monday {
		return
	}
	year, week := now.ISOWeek()
	weekKey := fmt.Sprintf("week:%d-W%02d", year, week)

	var alreadySent bool
	_ = s.db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM sent_summaries WHERE user_id=$1 AND month_key=$2)`,
		uid, weekKey,
	).Scan(&alreadySent)
	if alreadySent {
		return
	}

	var weeklyOn bool
	var familyName, familyEmail string
	err := s.db.QueryRow(
		`SELECT ns.weekly_summary, f.name, COALESCE(f.email,'')
		 FROM notification_settings ns JOIN families f ON f.user_id = ns.user_id
		 WHERE ns.user_id = $1`, uid,
	).Scan(&weeklyOn, &familyName, &familyEmail)
	if err != nil || !weeklyOn || familyEmail == "" {
		return
	}

	start := now.AddDate(0, 0, -7).Format("2006-01-02")
	end := now.Format("2006-01-02")
	var income, expense float64
	_ = s.db.QueryRow(
		`SELECT COALESCE(SUM(amount) FILTER (WHERE type='income'),0),
		        COALESCE(SUM(amount) FILTER (WHERE type='expense'),0)
		 FROM transactions WHERE user_id=$1 AND date >= $2 AND date < $3`,
		uid, start, end,
	).Scan(&income, &expense)

	weekLabel := fmt.Sprintf("week of %s", now.AddDate(0, 0, -7).Format("Jan 2"))

	recipients := s.collectRecipients(uid, familyEmail)
	for _, to := range recipients {
		if err := s.mail.SendWeeklySummary(to, familyName, weekLabel, income, expense); err != nil {
			log.Printf("weekly summary to %s failed: %v", to, err)
		}
	}

	_, _ = s.db.Exec(
		`INSERT INTO sent_summaries (user_id, month_key) VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`, uid, weekKey,
	)
}

// sendSpendingAlertIfDue emails once per month, the first time spending
// crosses this user's configured percentage-of-income threshold, tracked
// via an "alert:" prefixed key in sent_summaries.
func (s *Scheduler) sendSpendingAlertIfDue(uid int, now time.Time) {
	monthKey := now.Format("2006-01")
	alertKey := "alert:" + monthKey

	var alreadySent bool
	_ = s.db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM sent_summaries WHERE user_id=$1 AND month_key=$2)`,
		uid, alertKey,
	).Scan(&alreadySent)
	if alreadySent {
		return
	}

	var alertsOn bool
	var threshold int
	var familyName, familyEmail string
	err := s.db.QueryRow(
		`SELECT ns.spending_alerts, ns.reminder_threshold, f.name, COALESCE(f.email,'')
		 FROM notification_settings ns JOIN families f ON f.user_id = ns.user_id
		 WHERE ns.user_id = $1`, uid,
	).Scan(&alertsOn, &threshold, &familyName, &familyEmail)
	if err != nil || !alertsOn || familyEmail == "" {
		return
	}

	start := monthKey + "-01"
	end := now.AddDate(0, 1, -now.Day()+1).Format("2006-01-02")
	var income, expense float64
	_ = s.db.QueryRow(
		`SELECT COALESCE(SUM(amount) FILTER (WHERE type='income'),0),
		        COALESCE(SUM(amount) FILTER (WHERE type='expense'),0)
		 FROM transactions WHERE user_id=$1 AND date >= $2 AND date < $3`,
		uid, start, end,
	).Scan(&income, &expense)
	if income <= 0 {
		return
	}
	pct := (expense / income) * 100
	if pct < float64(threshold) {
		return
	}

	recipients := s.collectRecipients(uid, familyEmail)
	for _, to := range recipients {
		if err := s.mail.SendSpendingAlert(to, familyName, pct, threshold); err != nil {
			log.Printf("spending alert to %s failed: %v", to, err)
		}
	}

	_, _ = s.db.Exec(
		`INSERT INTO sent_summaries (user_id, month_key) VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`, uid, alertKey,
	)
}

func (s *Scheduler) collectRecipients(uid int, familyEmail string) []string {
	recipients := []string{familyEmail}
	rows, err := s.db.Query(
		`SELECT email FROM family_members WHERE user_id=$1 AND invitation_status != 'failed'`,
		uid,
	)
	if err != nil {
		return recipients
	}
	defer rows.Close()
	for rows.Next() {
		var e string
		if rows.Scan(&e) == nil && e != "" {
			recipients = append(recipients, e)
		}
	}
	return recipients
}

func simpleNarrative(familyName string, income, expense, balance, savingsPct float64) string {
	name := familyName
	if name == "" {
		name = "Your family"
	}
	if balance >= 0 {
		return name + " stayed on track this month — see the full breakdown in Ledger."
	}
	return name + " spent more than they earned this month — see the full breakdown in Ledger."
}
