package service

import "github.com/google/uuid"

type Meetings struct{}

func NewMeetings() *Meetings {
	return &Meetings{}
}

func (m *Meetings) MeetingURL(host string) string {
	return "https://" + host + "/join/" + uuid.NewString()
}
