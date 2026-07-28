package models

import "time"

type Category struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Label string `json:"label"`
	Color string `json:"color"`
}

type User struct {
	ID       int    `json:"id"`
	FullName string `json:"fullName"`
	Email    string `json:"email"`
}

type Family struct {
	ID       int    `json:"id"`
	Name     string `json:"familyName"`
	Email    string `json:"email"`
	Currency string `json:"currency"`
}

type Member struct {
	ID               int        `json:"id"`
	Name             string     `json:"name"`
	Email            string     `json:"email"`
	Role             string     `json:"role"`
	InvitationStatus string     `json:"invitationStatus"`
	InvitedAt        *time.Time `json:"invitedAt,omitempty"`
}

type Transaction struct {
	ID        int     `json:"id"`
	Type      string  `json:"type"`
	Category  string  `json:"category"`
	Amount    float64 `json:"amount"`
	Date      string  `json:"date"` // ISO date string
	Note      string  `json:"note"`
	Recurring bool    `json:"recurring"`
}

type SavingsGoal struct {
	ID     int     `json:"id"`
	Name   string  `json:"name"`
	Target float64 `json:"target"`
	Saved  float64 `json:"saved"`
	Color  string  `json:"color"`
}

type SavingsContribution struct {
	ID     int     `json:"id"`
	GoalID int     `json:"goalId"`
	Amount float64 `json:"amount"`
	Date   string  `json:"date"`
}

type SavingsPayload struct {
	Goals         []SavingsGoal         `json:"goals"`
	Contributions []SavingsContribution `json:"contributions"`
}

type Loan struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	Lender         string  `json:"lender"`
	Principal      float64 `json:"principal"`
	Remaining      float64 `json:"remaining"`
	InterestRate   float64 `json:"interestRate"`
	MonthlyPayment float64 `json:"monthlyPayment"`
	NextDueDate    string  `json:"nextDueDate"`
	StartDate      string  `json:"startDate"`
}

type Bill struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
	DueDay   int     `json:"dueDay"`
	Autopay  bool    `json:"autopay"`
}

type CalendarEvent struct {
	ID     int     `json:"id"`
	Type   string  `json:"type"`
	Title  string  `json:"title"`
	Amount float64 `json:"amount"`
	Date   string  `json:"date"`
	Notes  string  `json:"notes"`
	Repeat string  `json:"repeat"`
}

type NotificationSettings struct {
	MonthlyReminder   bool `json:"monthlyReminder"`
	WeeklySummary     bool `json:"weeklySummary"`
	BillReminders     bool `json:"billReminders"`
	SpendingAlerts    bool `json:"spendingAlerts"`
	ReminderThreshold int  `json:"reminderThreshold"`
}
