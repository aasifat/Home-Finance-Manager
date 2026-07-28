package handlers

import (
	"database/sql/driver"
	"fmt"
	"strconv"
	"time"
)

func itoa(n int) string {
	return strconv.Itoa(n)
}

// timeLike scans a SQL DATE or TIMESTAMPTZ column (which the postgres
// driver returns as time.Time) into a plain ISO date/time string, so JSON
// responses match the ISO strings the frontend already works with.
type timeLike struct {
	t      time.Time
	isDate bool
}

func (tl *timeLike) Scan(value interface{}) error {
	switch v := value.(type) {
	case time.Time:
		tl.t = v
	case nil:
		tl.t = time.Time{}
	default:
		return fmt.Errorf("unsupported Scan type %T for timeLike", value)
	}
	return nil
}

func (tl timeLike) Value() (driver.Value, error) {
	return tl.t, nil
}

func (tl timeLike) String() string {
	if tl.t.IsZero() {
		return ""
	}
	return tl.t.Format(time.RFC3339)
}
