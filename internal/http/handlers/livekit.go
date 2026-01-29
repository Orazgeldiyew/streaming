package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"streaming/internal/apierr"
	"streaming/internal/service"
)

type LiveKitJoinRequest struct {
	Room       string `json:"room"`
	Name       string `json:"name"`
	Role       string `json:"role"`       // teacher|student
	TeacherKey string `json:"teacherKey"` // optional
}

func LiveKitJoin(lk *service.LiveKitService, teacherKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LiveKitJoinRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			apierr.BadRequest(c, "INVALID_JSON", "invalid JSON body")
			return
		}

		req.Room = strings.TrimSpace(req.Room)
		req.Name = strings.TrimSpace(req.Name)
		req.Role = strings.ToLower(strings.TrimSpace(req.Role))
		req.TeacherKey = strings.TrimSpace(req.TeacherKey)

		if req.Room == "" || req.Name == "" {
			apierr.BadRequest(c, "INVALID_REQUEST", "room and name are required")
			return
		}

		if req.Role == "" {
			req.Role = "student"
		}
		if req.Role != "teacher" && req.Role != "student" {
			req.Role = "student"
		}

		// ✅ teacher разрешаем ТОЛЬКО если teacherKey совпадает
		if req.Role == "teacher" {
			if teacherKey == "" || req.TeacherKey != teacherKey {
				req.Role = "student"
			}
		}

		token, err := lk.JoinToken(req.Room, req.Name, req.Name, req.Role)
		if err != nil {
			apierr.Internal(c, "LIVEKIT_TOKEN_ERROR", err.Error())
			return
		}

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
