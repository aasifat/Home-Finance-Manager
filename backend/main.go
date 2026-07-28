package main

import (
	"log"
	"net/http"

	"homefinance/internal/config"
	"homefinance/internal/db"
	"homefinance/internal/email"
	"homefinance/internal/handlers"
	"homefinance/internal/middleware"
	"homefinance/internal/scheduler"
)

func main() {
	cfg := config.Load()

	conn, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer conn.Close()
	log.Println("connected to database")

	mailSvc := email.New(cfg)
	h := handlers.New(conn, mailSvc, cfg)

	sched := scheduler.New(conn, mailSvc)
	go sched.Run()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Auth (per-user accounts, JWT in an HttpOnly cookie)
	mux.HandleFunc("POST /api/v1/auth/register", h.Register)
	mux.HandleFunc("POST /api/v1/auth/login", h.Login)
	mux.HandleFunc("GET /api/v1/auth/me", h.Me)
	mux.HandleFunc("POST /api/v1/auth/logout", h.Logout)

	// Family & profile
	mux.HandleFunc("GET /api/family", h.GetFamily)
	mux.HandleFunc("PUT /api/family", h.UpdateFamily)
	mux.HandleFunc("GET /api/notifications", h.GetNotifications)
	mux.HandleFunc("PUT /api/notifications", h.UpdateNotifications)

	// Family members (invitation emails)
	mux.HandleFunc("GET /api/members", h.ListMembers)
	mux.HandleFunc("POST /api/members", h.CreateMember)
	mux.HandleFunc("POST /api/members/{id}/invite", h.ResendInvite)
	mux.HandleFunc("DELETE /api/members/{id}", h.DeleteMember)

	// Reference data
	mux.HandleFunc("GET /api/categories", h.ListCategories)

	// Transactions (income + expenses)
	mux.HandleFunc("GET /api/transactions", h.ListTransactions)
	mux.HandleFunc("POST /api/transactions", h.CreateTransaction)
	mux.HandleFunc("PUT /api/transactions/{id}", h.UpdateTransaction)
	mux.HandleFunc("DELETE /api/transactions/{id}", h.DeleteTransaction)

	// Savings
	mux.HandleFunc("GET /api/savings", h.GetSavings)
	mux.HandleFunc("POST /api/savings/goals", h.CreateSavingsGoal)
	mux.HandleFunc("DELETE /api/savings/goals/{id}", h.DeleteSavingsGoal)
	mux.HandleFunc("POST /api/savings/goals/{id}/contribute", h.ContributeSavings)

	// Loans & debts
	mux.HandleFunc("GET /api/loans", h.ListLoans)
	mux.HandleFunc("POST /api/loans", h.CreateLoan)
	mux.HandleFunc("DELETE /api/loans/{id}", h.DeleteLoan)
	mux.HandleFunc("POST /api/loans/{id}/payment", h.RecordLoanPayment)

	// Budget
	mux.HandleFunc("GET /api/budget", h.GetBudget)
	mux.HandleFunc("PUT /api/budget", h.SetBudget)

	// Bills
	mux.HandleFunc("GET /api/bills", h.ListBills)
	mux.HandleFunc("POST /api/bills", h.CreateBill)
	mux.HandleFunc("PUT /api/bills/{id}", h.UpdateBill)
	mux.HandleFunc("DELETE /api/bills/{id}", h.DeleteBill)

	// Calendar events (the "Add Event" button)
	mux.HandleFunc("GET /api/calendar/events", h.ListCalendarEvents)
	mux.HandleFunc("POST /api/calendar/events", h.CreateCalendarEvent)
	mux.HandleFunc("PUT /api/calendar/events/{id}", h.UpdateCalendarEvent)
	mux.HandleFunc("DELETE /api/calendar/events/{id}", h.DeleteCalendarEvent)

	// Reports / dashboard summary
	mux.HandleFunc("GET /api/reports/summary", h.GetMonthSummary)

	// Notifications (bell dropdown)
	mux.HandleFunc("GET /api/notifications/alerts", h.GetAlerts)

	var handler http.Handler = mux
	handler = middleware.RequireAuth(cfg.JWTSecret, handler)
	handler = middleware.CORS(cfg.FrontendOrigin, handler)
	handler = middleware.Logging(handler)

	log.Printf("Ledger API listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
