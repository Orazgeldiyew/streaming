package db

import "database/sql"

func JoinParticipant(db *sql.DB, lessonID int64, name, role string) error {
	// ✅ если человек переподключился — не создаём дубль,
	// просто "реанимируем" запись (left_at = NULL)
	_, err := db.Exec(`
		INSERT INTO lesson_participants
			(lesson_id, participant_name, role, joined_at, left_at)
		VALUES ($1, $2, $3, now(), NULL)
		ON CONFLICT (lesson_id, participant_name)
		DO UPDATE SET
			role = EXCLUDED.role,
			joined_at = EXCLUDED.joined_at,
			left_at = NULL
	`, lessonID, name, role)

	if err != nil {
		return err
	}

	_ = LogEvent(db, lessonID, "join", name)
	return nil
}

func LeaveParticipant(db *sql.DB, lessonID int64, name string) error {
	_, err := db.Exec(`
		UPDATE lesson_participants
		SET left_at = now()
		WHERE lesson_id = $1
		  AND participant_name = $2
		  AND left_at IS NULL
	`, lessonID, name)

	if err != nil {
		return err
	}

	_ = LogEvent(db, lessonID, "leave", name)
	return nil
}

// ✅ нужно для S2: понять, остался ли активный teacher
func HasActiveTeacher(dbConn *sql.DB, lessonID int64) (bool, error) {
	var cnt int
	err := dbConn.QueryRow(`
		SELECT count(*)
		FROM lesson_participants
		WHERE lesson_id = $1
		  AND role = 'teacher'
		  AND left_at IS NULL
	`, lessonID).Scan(&cnt)

	return cnt > 0, err
}
