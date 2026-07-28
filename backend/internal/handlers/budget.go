package handlers

import (
	"net/http"

	"homefinance/internal/httpx"
)

func (h *Handler) GetBudget(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	rows, err := h.DB.Query(
		`SELECT category, monthly_limit FROM budgets WHERE user_id = $1`, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load budget: "+err.Error())
		return
	}
	defer rows.Close()

	budget := map[string]float64{}
	for rows.Next() {
		var cat string
		var limit float64
		if err := rows.Scan(&cat, &limit); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "scan budget: "+err.Error())
			return
		}
		budget[cat] = limit
	}
	httpx.JSON(w, http.StatusOK, budget)
}

type setBudgetInput struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
}

func (h *Handler) SetBudget(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var in setBudgetInput
	if err := httpx.Decode(r, &in); err != nil || in.Category == "" || in.Amount < 0 {
		httpx.Error(w, http.StatusBadRequest, "category and a non-negative amount are required")
		return
	}
	_, err := h.DB.Exec(
		`INSERT INTO budgets (user_id, category, monthly_limit)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, category) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit`,
		uid, in.Category, in.Amount,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save budget: "+err.Error())
		return
	}
	h.GetBudget(w, r)
}
