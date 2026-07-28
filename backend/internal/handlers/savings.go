package handlers

import (
	"net/http"

	"homefinance/internal/httpx"
	"homefinance/internal/models"
)

func (h *Handler) GetSavings(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	goalRows, err := h.DB.Query(
		`SELECT id, name, target, saved, color FROM savings_goals
		 WHERE user_id = $1 ORDER BY created_at`, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load goals: "+err.Error())
		return
	}
	defer goalRows.Close()

	goals := []models.SavingsGoal{}
	for goalRows.Next() {
		var g models.SavingsGoal
		if err := goalRows.Scan(&g.ID, &g.Name, &g.Target, &g.Saved, &g.Color); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "scan goal: "+err.Error())
			return
		}
		goals = append(goals, g)
	}

	contribRows, err := h.DB.Query(
		`SELECT sc.id, sc.goal_id, sc.amount, sc.date FROM savings_contributions sc
		 JOIN savings_goals sg ON sg.id = sc.goal_id
		 WHERE sg.user_id = $1 ORDER BY sc.date DESC LIMIT 50`, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load contributions: "+err.Error())
		return
	}
	defer contribRows.Close()

	contribs := []models.SavingsContribution{}
	for contribRows.Next() {
		var c models.SavingsContribution
		var date timeLike
		if err := contribRows.Scan(&c.ID, &c.GoalID, &c.Amount, &date); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "scan contribution: "+err.Error())
			return
		}
		c.Date = date.String()
		contribs = append(contribs, c)
	}

	httpx.JSON(w, http.StatusOK, models.SavingsPayload{Goals: goals, Contributions: contribs})
}

func (h *Handler) CreateSavingsGoal(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var in models.SavingsGoal
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	if in.Target <= 0 {
		httpx.Error(w, http.StatusBadRequest, "target must be greater than 0")
		return
	}
	if in.Color == "" {
		in.Color = "#1F3D3A"
	}
	err := h.DB.QueryRow(
		`INSERT INTO savings_goals (user_id, name, target, saved, color)
		 VALUES ($1, $2, $3, 0, $4) RETURNING id`,
		uid, in.Name, in.Target, in.Color,
	).Scan(&in.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create goal: "+err.Error())
		return
	}
	in.Saved = 0
	httpx.JSON(w, http.StatusCreated, in)
}

func (h *Handler) DeleteSavingsGoal(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "savings_goals", id, uid) {
		return
	}
	if _, err := h.DB.Exec(
		`DELETE FROM savings_goals WHERE id = $1 AND user_id = $2`, id, uid,
	); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not delete goal: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}

type contributeInput struct {
	Amount float64 `json:"amount"`
}

func (h *Handler) ContributeSavings(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !h.enforceOwnership(w, "savings_goals", id, uid) {
		return
	}
	var in contributeInput
	if err := httpx.Decode(r, &in); err != nil || in.Amount <= 0 {
		httpx.Error(w, http.StatusBadRequest, "amount must be greater than 0")
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "tx begin: "+err.Error())
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		`UPDATE savings_goals SET saved = saved + $1 WHERE id = $2 AND user_id = $3`,
		in.Amount, id, uid,
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not update goal: "+err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		httpx.Error(w, http.StatusNotFound, "goal not found")
		return
	}
	if _, err := tx.Exec(
		`INSERT INTO savings_contributions (goal_id, amount) VALUES ($1, $2)`, id, in.Amount,
	); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not log contribution: "+err.Error())
		return
	}
	if err := tx.Commit(); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "tx commit: "+err.Error())
		return
	}

	h.GetSavings(w, r)
}
