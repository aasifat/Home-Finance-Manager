package handlers

import (
	"net/http"

	"homefinance/internal/httpx"
	"homefinance/internal/models"
)

func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`SELECT id, type, label, color FROM categories ORDER BY type, label`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load categories: "+err.Error())
		return
	}
	defer rows.Close()

	result := map[string][]models.Category{"income": {}, "expense": {}}
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.Type, &c.Label, &c.Color); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "scan category: "+err.Error())
			return
		}
		result[c.Type] = append(result[c.Type], c)
	}
	httpx.JSON(w, http.StatusOK, result)
}

// ListTransactions supports optional ?type=income|expense and
// ?month=YYYY-MM query params.
func (h *Handler) ListTransactions(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	q := `SELECT id, type, category, amount, date, COALESCE(note,''), recurring
	      FROM transactions WHERE user_id = $1`
	args := []interface{}{uid}

	if t := r.URL.Query().Get("type"); t != "" {
		args = append(args, t)
		q += " AND type = $" + itoa(len(args))
	}
	if m := r.URL.Query().Get("month"); m != "" {
		if start, end, ok := monthKeyToRange(m); ok {
			args = append(args, start, end)
			q += " AND date >= $" + itoa(len(args)-1) + " AND date < $" + itoa(len(args))
		}
	}
	q += " ORDER BY date DESC, id DESC"

	rows, err := h.DB.Query(q, args...)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load transactions: "+err.Error())
		return
	}
	defer rows.Close()

	txs := []models.Transaction{}
	for rows.Next() {
		var t models.Transaction
		var date timeLike
		if err := rows.Scan(&t.ID, &t.Type, &t.Category, &t.Amount, &date, &t.Note, &t.Recurring); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "scan transaction: "+err.Error())
			return
		}
		t.Date = date.String()
		txs = append(txs, t)
	}
	httpx.JSON(w, http.StatusOK, txs)
}

func (h *Handler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var in models.Transaction
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	if in.Type != "income" && in.Type != "expense" {
		httpx.Error(w, http.StatusBadRequest, "type must be income or expense")
		return
	}
	if in.Amount <= 0 {
		httpx.Error(w, http.StatusBadRequest, "amount must be greater than 0")
		return
	}

	var id int
	err := h.DB.QueryRow(
		`INSERT INTO transactions (user_id, type, category, amount, date, note, recurring)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		uid, in.Type, in.Category, in.Amount, in.Date, in.Note, in.Recurring,
	).Scan(&id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not add transaction: "+err.Error())
		return
	}
	in.ID = id
	httpx.JSON(w, http.StatusCreated, in)
}

func (h *Handler) UpdateTransaction(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "transactions", id, uid) {
		return
	}

	var in models.Transaction
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	_, err = h.DB.Exec(
		`UPDATE transactions SET type=$1, category=$2, amount=$3, date=$4, note=$5, recurring=$6
		 WHERE id=$7 AND user_id=$8`,
		in.Type, in.Category, in.Amount, in.Date, in.Note, in.Recurring, id, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not update transaction: "+err.Error())
		return
	}
	in.ID = id
	httpx.JSON(w, http.StatusOK, in)
}

func (h *Handler) DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "transactions", id, uid) {
		return
	}
	if _, err := h.DB.Exec(`DELETE FROM transactions WHERE id=$1 AND user_id=$2`, id, uid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not delete transaction: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}
