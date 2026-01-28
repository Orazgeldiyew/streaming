package apierr

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ErrorResponse struct {
	Error APIError `json:"error"`
}

func JSON(c *gin.Context, status int, code, message string) {
	c.JSON(status, ErrorResponse{
		Error: APIError{Code: code, Message: message},
	})
}

func BadRequest(c *gin.Context, code, message string) {
	JSON(c, http.StatusBadRequest, code, message)
}

func Unauthorized(c *gin.Context, code, message string) {
	JSON(c, http.StatusUnauthorized, code, message)
}

func Forbidden(c *gin.Context, code, message string) {
	JSON(c, http.StatusForbidden, code, message)
}

func Internal(c *gin.Context, code, message string) {
	JSON(c, http.StatusInternalServerError, code, message)
}
