-- Школьная библиотека: запросы

-- 1) AND + OR: книги на руках у учеников 11A или 11B
SELECT s.first_name, s.last_name, s.class, b.title, l.due_date
FROM Loans l
JOIN Students s ON s.student_id = l.student_id
JOIN Books b    ON b.book_id = l.book_id
WHERE (s.class = '11A' OR s.class = '11B')
  AND l.return_date IS NULL;

-- 2) AND + OR без JOIN: классика или казахская литература после 1900 года
SELECT book_id, title, author, genre, year
FROM Books
WHERE (genre = 'Классика' OR genre = 'Казахская литература')
  AND year > 1900;

-- 3) Просроченные книги на сегодня
SELECT s.last_name, s.class, b.title, l.due_date
FROM Loans l
JOIN Students s ON s.student_id = l.student_id
JOIN Books b    ON b.book_id = l.book_id
WHERE l.return_date IS NULL AND l.due_date < date('now')
ORDER BY l.due_date;
