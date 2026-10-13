-- Tutoring Portal schema (MySQL 8+)

CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,              -- bcrypt hash, never plain text
    role        ENUM('admin', 'tutor', 'student') NOT NULL DEFAULT 'student',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    tutor_id        INT NOT NULL,
    student_id      INT NULL,                        -- NULL for blocked time
    session_date    DATETIME NOT NULL,
    duration        INT NOT NULL,                    -- minutes
    status          ENUM('upcoming', 'completed', 'no-show', 'cancelled', 'blocked')
                    NOT NULL DEFAULT 'upcoming',
    notes           VARCHAR(500) NULL,
    rating          TINYINT NULL,
    feedback_notes  TEXT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sessions_tutor   FOREIGN KEY (tutor_id)   REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_sessions_tutor (tutor_id),
    INDEX idx_sessions_student (student_id)
);
