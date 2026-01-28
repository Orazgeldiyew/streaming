package http

import "github.com/gin-gonic/gin"

type ContextWriter interface {
	JSON(code int, obj any)
}

var _ ContextWriter = (*gin.Context)(nil)
