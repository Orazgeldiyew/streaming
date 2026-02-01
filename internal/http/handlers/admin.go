package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

func AdminSummary(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {

		var totalLessons int
		_ = db.QueryRow(`SELECT count(*) FROM lessons`).Scan(&totalLessons)

		var totalMinutes int
		_ = db.QueryRow(`
			SELECT COALESCE(sum(duration_sec)/60,0)
			FROM lessons
		`).Scan(&totalMinutes)

		rows, _ := db.Query(`
			SELECT teacher_name, count(*)
			FROM lessons
			GROUP BY teacher_name
		`)
		defer rows.Close()

		teachers := []gin.H{}
		for rows.Next() {
			var name string
			var cnt int
			rows.Scan(&name, &cnt)
			teachers = append(teachers, gin.H{
				"teacher": name,
				"lessons": cnt,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"total_lessons": totalLessons,
			"total_minutes": totalMinutes,
			"teachers":      teachers,
		})
	}
}
