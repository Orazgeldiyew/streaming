package db

import (
	"database/sql"
	"errors"
)

var allowedEventTypes = map[string]struct{}{
	"lesson_started": {},
	"lesson_ended":   {},
	"join":           {},
	"leave":          {},
}

// LogEvent — универсальная функция логирования событий урока
func LogEvent(db *sql.DB, lessonID int64, eventType, actor string) error {
	if lessonID <= 0 {
		return errors.New("invalid lessonID")
	}
	if _, ok := allowedEventTypes[eventType]; !ok {
		return errors.New("invalid event type: " + eventType)
	}

	_, err := db.Exec(`
		INSERT INTO lesson_events
		(lesson_id, event_type, actor_name, occurred_at)
		VALUES ($1, $2, $3, now())
	`, lessonID, eventType, actor)

	return err
}
