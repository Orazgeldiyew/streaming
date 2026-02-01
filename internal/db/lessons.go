package db

import (
	"database/sql"
	"errors"
)

// =======================
// Start lesson (teacher)
// =======================

func StartLesson(db *sql.DB, room, teacher string) (int64, error) {
	var id int64

	err := db.QueryRow(`
		INSERT INTO lessons (room_name, teacher_name, started_at)
		VALUES ($1, $2, now())
		RETURNING id
	`, room, teacher).Scan(&id)

	if err != nil {
		return 0, err
	}

	// лог события (не ломаем урок, если логирование не удалось)
	_ = LogEvent(db, id, "lesson_started", teacher)

	return id, nil
}

// =======================
// End lesson
// =======================

func EndLesson(db *sql.DB, lessonID int64) error {
	// ✅ закрываем только если ещё не закрыт
	res, err := db.Exec(`
		UPDATE lessons
		SET ended_at = now(),
		    duration_sec = EXTRACT(EPOCH FROM (now() - started_at))::int
		WHERE id = $1
		  AND ended_at IS NULL
	`, lessonID)
	if err != nil {
		return err
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		// уже закрыт — это НЕ ошибка
		return nil
	}

	_ = LogEvent(db, lessonID, "lesson_ended", "")
	return nil
}

// =======================
// Get active lesson by room
// =======================

func GetActiveLesson(db *sql.DB, room string) (int64, error) {
	var id int64

	err := db.QueryRow(`
		SELECT id
		FROM lessons
		WHERE room_name = $1
		  AND ended_at IS NULL
		ORDER BY started_at DESC
		LIMIT 1
	`, room).Scan(&id)

	if err == sql.ErrNoRows {
		return 0, errors.New("no active lesson")
	}
	if err != nil {
		return 0, err
	}

	return id, nil
}
