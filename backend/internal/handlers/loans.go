package handlers

import (
	"net/http"

	"homefinance/internal/httpx"
	"homefinance/internal/models"
)

func (h *Handler) ListLoans(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	rows, err := h.DB.Query(
		`SELECT id, name, COALESCE(lender,''), principal, remaining, interest_rate,
		        monthly_payment, next_due_date, start_date
		 FROM loans WHERE user_id = $1 ORDER BY created_at`, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load loans: "+err.Error())
		return
	}
	defer rows.Close()

	loans := []models.Loan{}
	for rows.Next() {
		var l models.Loan
		var due, start timeLike
		if err := rows.Scan(&l.ID, &l.Name, &l.Lender, &l.Principal, &l.Remaining, &l.InterestRate,
			&l.MonthlyPayment, &due, &start); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "scan loan: "+err.Error())
			return
		}
		l.NextDueDate = due.String()
		l.StartDate = start.String()
		loans = append(loans, l)
	}
	httpx.JSON(w, http.StatusOK, loans)
}

func (h *Handler) CreateLoan(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var in models.Loan
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	if in.Name == "" || in.Principal <= 0 {
		httpx.Error(w, http.StatusBadRequest, "name and a positive principal are required")
		return
	}
	if in.Remaining == 0 {
		in.Remaining = in.Principal
	}
	err := h.DB.QueryRow(
		`INSERT INTO loans (user_id, name, lender, principal, remaining, interest_rate,
		                     monthly_payment, next_due_date, start_date)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
		uid, in.Name, in.Lender, in.Principal, in.Remaining, in.InterestRate,
		in.MonthlyPayment, nullableDate(in.NextDueDate), nullableDate(in.StartDate),
	).Scan(&in.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create loan: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, in)
}

func (h *Handler) DeleteLoan(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "loans", id, uid) {
		return
	}
	if _, err := h.DB.Exec(`DELETE FROM loans WHERE id=$1 AND user_id=$2`, id, uid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not delete loan: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}

type paymentInput struct {
	Amount float64 `json:"amount"`
}

func (h *Handler) RecordLoanPayment(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "loans", id, uid) {
		return
	}
	var in paymentInput
	if err := httpx.Decode(r, &in); err != nil || in.Amount <= 0 {
		httpx.Error(w, http.StatusBadRequest, "amount must be greater than 0")
		return
	}
	_, err = h.DB.Exec(
		`UPDATE loans SET remaining = GREATEST(0, remaining - $1) WHERE id = $2 AND user_id = $3`,
		in.Amount, id, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not record payment: "+err.Error())
		return
	}
	h.ListLoans(w, r)
}

func nullableDate(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
