package middleware

import (
	"database/sql"

	"github.com/gin-gonic/gin"
)

const dbKey = "db"

func DB(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(dbKey, db)
		c.Next()
	}
}

// Helper для безопасного получения DB
func GetDB(c *gin.Context) *sql.DB {
	v, ok := c.Get(dbKey)
	if !ok {
		panic("database not found in context")
	}

	db, ok := v.(*sql.DB)
	if !ok {
		panic("invalid database type in context")
	}

	return db
}
