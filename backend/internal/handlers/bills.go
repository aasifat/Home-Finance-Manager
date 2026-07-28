package handlers

import (
	"net/http"

	"homefinance/internal/httpx"
	"homefinance/internal/models"
)

func (h *Handler) ListBills(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	rows, err := h.DB.Query(
		`SELECT id, name, category, amount, due_day, autopay
		 FROM bills WHERE user_id = $1 ORDER BY due_day`, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load bills: "+err.Error())
		return
	}
	defer rows.Close()

	bills := []models.Bill{}
	for rows.Next() {
		var b models.Bill
		if err := rows.Scan(&b.ID, &b.Name, &b.Category, &b.Amount, &b.DueDay, &b.Autopay); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "scan bill: "+err.Error())
			return
		}
		bills = append(bills, b)
	}
	httpx.JSON(w, http.StatusOK, bills)
}

func (h *Handler) CreateBill(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var in models.Bill
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	if in.Name == "" || in.Amount <= 0 || in.DueDay < 1 || in.DueDay > 31 {
		httpx.Error(w, http.StatusBadRequest, "name, a positive amount, and a due day (1-31) are required")
		return
	}
	err := h.DB.QueryRow(
		`INSERT INTO bills (user_id, name, category, amount, due_day, autopay)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		uid, in.Name, in.Category, in.Amount, in.DueDay, in.Autopay,
	).Scan(&in.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create bill: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, in)
}

func (h *Handler) UpdateBill(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "bills", id, uid) {
		return
	}

	var in models.Bill
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	_, err = h.DB.Exec(
		`UPDATE bills SET name=$1, category=$2, amount=$3, due_day=$4, autopay=$5
		 WHERE id=$6 AND user_id=$7`,
		in.Name, in.Category, in.Amount, in.DueDay, in.Autopay, id, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not update bill: "+err.Error())
		return
	}
	in.ID = id
	httpx.JSON(w, http.StatusOK, in)
}

func (h *Handler) DeleteBill(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "bills", id, uid) {
		return
	}
	if _, err := h.DB.Exec(`DELETE FROM bills WHERE id=$1 AND user_id=$2`, id, uid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not delete bill: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}
