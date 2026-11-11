-- Школьная библиотека: создание таблиц
-- Students 1 — ∞ Loans ∞ — 1 Books

CREATE TABLE Students (
  student_id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  class      TEXT NOT NULL,
  phone      TEXT
);

CREATE TABLE Books (
  book_id INTEGER PRIMARY KEY,
  title   TEXT NOT NULL,
  author  TEXT NOT NULL,
  genre   TEXT,
  year    INTEGER,
  copies  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE Loans (
  loan_id     INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL,
  book_id     INTEGER NOT NULL,
  issue_date  DATE NOT NULL,
  due_date    DATE NOT NULL,
  return_date DATE,
  FOREIGN KEY (student_id) REFERENCES Students(student_id),
  FOREIGN KEY (book_id)    REFERENCES Books(book_id)
);
