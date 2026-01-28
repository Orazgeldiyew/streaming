package middleware

import "sync"

type HostAuth struct {
	mu  sync.RWMutex
	ips map[string]bool
}

func NewHostAuth() *HostAuth {
	return &HostAuth{ips: make(map[string]bool)}
}

func (h *HostAuth) Authorize(ip string) {
	h.mu.Lock()
	h.ips[ip] = true
	h.mu.Unlock()
}
