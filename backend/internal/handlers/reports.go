package handlers

import (
	"fmt"
	"net/http"
	"time"

	"homefinance/internal/httpx"
)

type categoryAmount struct {
	ID     string  `json:"id"`
	Label  string  `json:"label"`
	Color  string  `json:"color"`
	Amount float64 `json:"amount"`
}

type monthSummary struct {
	Month       string           `json:"month"`
	Income      float64          `json:"income"`
	Expense     float64          `json:"expense"`
	Balance     float64          `json:"balance"`
	SavingsPct  float64          `json:"savingsRate"`
	TopCategory *categoryAmount  `json:"topCategory,omitempty"`
	Breakdown   []categoryAmount `json:"breakdown"`
	Narrative   string           `json:"narrative"`
}

// GetMonthSummary powers both the Dashboard's monthly statement card and
// the Reports page. ?month=YYYY-MM defaults to the current month.
func (h *Handler) GetMonthSummary(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	monthParam := r.URL.Query().Get("month")
	if monthParam == "" {
		monthParam = time.Now().Format("2006-01")
	}
	start, end, ok := monthKeyToRange(monthParam)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "month must be formatted YYYY-MM")
		return
	}

	var income, expense float64
	err := h.DB.QueryRow(
		`SELECT COALESCE(SUM(amount) FILTER (WHERE type='income'), 0),
		        COALESCE(SUM(amount) FILTER (WHERE type='expense'), 0)
		 FROM transactions WHERE user_id=$1 AND date >= $2 AND date < $3`,
		uid, start, end,
	).Scan(&income, &expense)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not summarize month: "+err.Error())
		return
	}

	rows, err := h.DB.Query(
		`SELECT c.id, c.label, c.color, SUM(t.amount) AS amt
		 FROM transactions t JOIN categories c ON c.id = t.category
		 WHERE t.user_id=$1 AND t.type='expense' AND t.date >= $2 AND t.date < $3
		 GROUP BY c.id, c.label, c.color ORDER BY amt DESC`,
		uid, start, end,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load breakdown: "+err.Error())
		return
	}
	defer rows.Close()

	breakdown := []categoryAmount{}
	for rows.Next() {
		var c categoryAmount
		if err := rows.Scan(&c.ID, &c.Label, &c.Color, &c.Amount); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "scan breakdown: "+err.Error())
			return
		}
		breakdown = append(breakdown, c)
	}

	var familyName string
	_ = h.DB.QueryRow(`SELECT name FROM families WHERE user_id=$1`, uid).Scan(&familyName)

	summary := monthSummary{
		Month:     monthParam,
		Income:    income,
		Expense:   expense,
		Balance:   income - expense,
		Breakdown: breakdown,
	}
	if len(breakdown) > 0 {
		top := breakdown[0]
		summary.TopCategory = &top
	}
	if income > 0 {
		summary.SavingsPct = float64(int((summary.Balance/income)*1000)) / 10
	}
	summary.Narrative = buildNarrative(familyName, income, expense, summary.Balance, summary.SavingsPct, summary.TopCategory)

	httpx.JSON(w, http.StatusOK, summary)
}

func buildNarrative(familyName string, income, expense, balance, savingsPct float64, top *categoryAmount) string {
	name := familyName
	if name == "" {
		name = "Your family"
	}
	if income == 0 && expense == 0 {
		return "No transactions recorded yet this month. Add your income and expenses to see your monthly story."
	}
	topLine := ""
	if top != nil {
		topLine = fmt.Sprintf(" %s was your highest expense category at $%.0f.", top.Label, top.Amount)
	}
	var savingsLine string
	if balance >= 0 {
		savingsLine = fmt.Sprintf("%s saved $%.0f, which is %.1f%% of total income.", name, balance, savingsPct)
	} else {
		savingsLine = fmt.Sprintf("%s spent $%.0f more than they earned this month.", name, -balance)
	}
	return fmt.Sprintf("%s earned $%.0f this month and spent $%.0f.%s %s", name, income, expense, topLine, savingsLine)
}
