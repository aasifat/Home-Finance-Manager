package email

import (
	"fmt"
	"log"

	"gopkg.in/gomail.v2"

	"homefinance/internal/config"
)

type Service struct {
	cfg *config.Config
}

func New(cfg *config.Config) *Service {
	return &Service{cfg: cfg}
}

// Send delivers an HTML email, or just logs it if EMAIL_DRY_RUN=true /
// SMTP isn't configured — this lets the app run end-to-end without real
// email credentials while you're developing.
func (s *Service) Send(to, subject, htmlBody string) error {
	if s.cfg.EmailDryRun || s.cfg.SMTPHost == "" {
		log.Printf("[email:dry-run] to=%s subject=%q\n%s\n", to, subject, htmlBody)
		return nil
	}

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("%s <%s>", s.cfg.SMTPFromName, s.cfg.SMTPFromEmail))
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/html", htmlBody)

	d := gomail.NewDialer(s.cfg.SMTPHost, s.cfg.SMTPPort, s.cfg.SMTPUsername, s.cfg.SMTPPassword)
	if err := d.DialAndSend(m); err != nil {
		return fmt.Errorf("send email to %s: %w", to, err)
	}
	return nil
}

// SendInvitation notifies a newly-added family member that they've been
// added to the household's shared finance account.
func (s *Service) SendInvitation(memberName, memberEmail, familyName, appURL string) error {
	subject := fmt.Sprintf("You've been added to %s's finances on Ledger", familyName)
	body := fmt.Sprintf(`
		<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #16211E;">
			<div style="background:#1F3D3A; color:#fff; padding:20px 24px; border-radius:10px 10px 0 0;">
				<p style="margin:0; font-size:12px; letter-spacing:0.15em; text-transform:uppercase; opacity:0.7;">Ledger — Home Finance</p>
				<h1 style="margin:8px 0 0; font-size:20px; font-weight:600;">Welcome, %s</h1>
			</div>
			<div style="border:1px solid #DBD9CE; border-top:none; padding:24px; border-radius:0 0 10px 10px;">
				<p>You've been added as a member of <strong>%s</strong>'s shared home finance account.</p>
				<p>You'll be able to see the household's income, expenses, savings goals, budgets, and upcoming bills — all kept in one place.</p>
				<p style="margin-top:24px;">
					<a href="%s" style="display:inline-block; background:#C9A227; color:#16211E; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:600;">Open Ledger</a>
				</p>
				<p style="margin-top:24px; font-size:12px; color:#68746D;">If you weren't expecting this, you can safely ignore this email.</p>
			</div>
		</div>`, memberName, familyName, appURL)

	return s.Send(memberEmail, subject, body)
}

// SendMonthlySummary delivers the "Where did our money go?" narrative.
func (s *Service) SendMonthlySummary(to, familyName, monthLabel, narrative string) error {
	subject := fmt.Sprintf("%s — your %s summary", familyName, monthLabel)
	body := fmt.Sprintf(`
		<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #16211E;">
			<div style="background:#1F3D3A; color:#fff; padding:24px; border-radius:10px;">
				<p style="margin:0; font-size:12px; letter-spacing:0.15em; text-transform:uppercase; opacity:0.6;">Where did our money go? — %s</p>
				<p style="margin:14px 0 0; font-size:18px; font-style:italic; line-height:1.5;">"%s"</p>
			</div>
			<p style="margin-top:20px; font-size:13px; color:#68746D;">Open Ledger to see the full breakdown, charts, and reports.</p>
		</div>`, monthLabel, narrative)

	return s.Send(to, subject, body)
}

// SendWeeklySummary delivers a short weekly income/expense recap.
func (s *Service) SendWeeklySummary(to, familyName, weekLabel string, income, expense float64) error {
	subject := fmt.Sprintf("%s — your %s recap", familyName, weekLabel)
	balance := income - expense
	body := fmt.Sprintf(`
		<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #16211E;">
			<div style="background:#1F3D3A; color:#fff; padding:24px; border-radius:10px;">
				<p style="margin:0; font-size:12px; letter-spacing:0.15em; text-transform:uppercase; opacity:0.6;">Weekly recap — %s</p>
				<p style="margin:14px 0 0; font-size:16px; line-height:1.5;">Earned $%.0f, spent $%.0f, leaving %s%.0f.</p>
			</div>
			<p style="margin-top:20px; font-size:13px; color:#68746D;">Open Ledger to see the full breakdown, charts, and reports.</p>
		</div>`, weekLabel, income, expense, signPrefix(balance), abs(balance))

	return s.Send(to, subject, body)
}

// SendSpendingAlert warns that spending has crossed the configured
// percentage-of-income threshold for the month.
func (s *Service) SendSpendingAlert(to, familyName string, pct float64, threshold int) error {
	subject := fmt.Sprintf("%s — spending pace alert", familyName)
	body := fmt.Sprintf(`
		<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #16211E;">
			<div style="border:1px solid #DBD9CE; border-radius:10px; padding:24px;">
				<p style="margin:0 0 8px; font-size:12px; letter-spacing:0.15em; text-transform:uppercase; color:#9A7B18;">Spending Pace Alert</p>
				<p style="margin:0; font-size:20px; font-weight:600;">%.0f%% of income spent this month</p>
				<p style="margin-top:8px; color:#68746D;">That's past your %d%% alert threshold — set in Profile &gt; Email Reminders.</p>
			</div>
		</div>`, pct, threshold)

	return s.Send(to, subject, body)
}

func signPrefix(v float64) string {
	if v < 0 {
		return "-$"
	}
	return "$"
}

func abs(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}

// SendBillReminder warns that a bill is due soon.
func (s *Service) SendBillReminder(to, billName string, amount float64, dueDay int) error {
	subject := fmt.Sprintf("Reminder: %s is due soon", billName)
	body := fmt.Sprintf(`
		<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #16211E;">
			<div style="border:1px solid #DBD9CE; border-radius:10px; padding:24px;">
				<p style="margin:0 0 8px; font-size:12px; letter-spacing:0.15em; text-transform:uppercase; color:#9A7B18;">Upcoming Bill</p>
				<h1 style="margin:0 0 8px; font-size:20px;">%s</h1>
				<p style="margin:0; font-size:24px; font-weight:600;">$%.2f</p>
				<p style="margin-top:8px; color:#68746D;">Due on day %d of this month.</p>
			</div>
		</div>`, billName, amount, dueDay)

	return s.Send(to, subject, body)
}
