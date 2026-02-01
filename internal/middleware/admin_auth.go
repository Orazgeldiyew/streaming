package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func AdminBasicAuth(username, password string) gin.HandlerFunc {
	return func(c *gin.Context) {
		u, p, ok := c.Request.BasicAuth()
		if !ok || u != username || p != password {
			c.Header("WWW-Authenticate", `Basic realm="Admin Area"`)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized",
			})
			return
		}
		c.Next()
	}
}
