CREATE TABLE lessons (
    id              BIGSERIAL PRIMARY KEY,
    room_name       TEXT NOT NULL,
    teacher_name    TEXT NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    duration_sec    INTEGER,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lessons_started_at ON lessons(started_at);
CREATE INDEX idx_lessons_teacher ON lessons(teacher_name);

CREATE TABLE lesson_participants (
    id BIGSERIAL PRIMARY KEY,
    lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    participant_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('teacher','student')),
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lp_lesson_id ON lesson_participants(lesson_id);
CREATE INDEX idx_lp_participant ON lesson_participants(participant_name);
