package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"streaming/internal/apierr"
	"streaming/internal/service"
)

type LiveKitJoinRequest struct {
	Room string `json:"room"`
	Name string `json:"name"`
	Role string `json:"role"` // teacher|student
}

func LiveKitJoin(lk *service.LiveKitService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LiveKitJoinRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			apierr.BadRequest(c, "INVALID_JSON", "invalid JSON body")
			return
		}

		req.Room = strings.TrimSpace(req.Room)
		req.Name = strings.TrimSpace(req.Name)
		req.Role = strings.ToLower(strings.TrimSpace(req.Role))

		if req.Room == "" || req.Name == "" {
			apierr.BadRequest(c, "INVALID_REQUEST", "room and name are required")
			return
		}

		// default role
		if req.Role == "" {
			req.Role = "student"
		}
		if req.Role != "teacher" && req.Role != "student" {
			apierr.BadRequest(c, "INVALID_ROLE", "role must be teacher or student")
			return
		}

		// identity = req.Name (как у тебя)
		token, err := lk.JoinToken(req.Room, req.Name, req.Name, req.Role)
		if err != nil {
			apierr.Internal(c, "LIVEKIT_TOKEN_ERROR", err.Error())
			return
		}

		// Важно: если телефон открывает страницу по IP, Host будет "192.168.x.x:3010"
		wsURL := lk.WSURLFromRequestHost(c.Request.Host)

		c.JSON(http.StatusOK, gin.H{
			"room":  req.Room,
			"name":  req.Name,
			"role":  req.Role,
			"token": token,
			"wsUrl": wsURL,
		})
	}
}
