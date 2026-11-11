/* Школьная библиотека — учёт выдачи книг
 * Таблицы: Students, Books, Loans (см. папку sql/).
 * Данные хранятся в браузере (localStorage). SQL-консоль работает на sql.js (SQLite в браузере).
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'school-library-db-v1';
  var LOAN_DAYS = 14;        // срок выдачи по умолчанию
  var MAX_ACTIVE_LOANS = 3;  // максимум книг на руках у одного ученика
  var SQLJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/';

  /* ---------- Даты ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return toISO(new Date()); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(iso, n) { var d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
  function fmt(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }

  /* ---------- Демо-данные ---------- */
  function seed() {
    var t = today();
    var students = [
      [1, 'Айгерим', 'Сейтова', '11A', '+7 701 111 2233'],
      [2, 'Нурлан', 'Ахметов', '11B', '+7 702 222 3344'],
      [3, 'Дана', 'Жумабаева', '11A', '+7 705 333 4455'],
      [4, 'Арман', 'Касымов', '10A', '+7 707 444 5566'],
      [5, 'Алия', 'Нурпеисова', '11B', '+7 708 555 6677'],
      [6, 'Ерлан', 'Тулегенов', '10B', '+7 747 666 7788'],
      [7, 'Мадина', 'Абдрахманова', '11A', '+7 771 777 8899'],
      [8, 'Тимур', 'Ким', '10A', '+7 776 888 9900']
    ].map(function (r) { return { student_id: r[0], first_name: r[1], last_name: r[2], class: r[3], phone: r[4] }; });

    var books = [
      [1, 'Слова назидания', 'Абай Кунанбаев', 'Казахская литература', 1918, 3],
      [2, 'Путь Абая', 'Мухтар Ауэзов', 'Казахская литература', 1942, 2],
      [3, 'Кочевники', 'Ильяс Есенберлин', 'Казахская литература', 1976, 2],
      [4, 'Мастер и Маргарита', 'Михаил Булгаков', 'Классика', 1967, 2],
      [5, 'Преступление и наказание', 'Фёдор Достоевский', 'Классика', 1866, 3],
      [6, 'Война и мир', 'Лев Толстой', 'Классика', 1869, 1],
      [7, '1984', 'Джордж Оруэлл', 'Антиутопия', 1949, 2],
      [8, 'Маленький принц', 'Антуан де Сент-Экзюпери', 'Сказка', 1943, 4],
      [9, 'Гарри Поттер и философский камень', 'Джоан Роулинг', 'Фэнтези', 1997, 2],
      [10, 'Алгебра и начала анализа, 11 класс', 'Абылкасымова А.', 'Учебник', 2020, 5]
    ].map(function (r) { return { book_id: r[0], title: r[1], author: r[2], genre: r[3], year: r[4], copies: r[5] }; });

    // [id, student, book, выдано дней назад, вернули дней назад (null = на руках)]
    var loans = [
      [1, 1, 4, 20, null],
      [2, 2, 1, 5, null],
      [3, 3, 7, 30, null],
      [4, 4, 4, 3, null],
      [5, 5, 2, 25, 12],
      [6, 1, 9, 10, null],
      [7, 7, 5, 18, null],
      [8, 6, 3, 40, 20]
    ].map(function (r) {
      var issue = addDays(t, -r[3]);
      return {
        loan_id: r[0], student_id: r[1], book_id: r[2],
        issue_date: issue, due_date: addDays(issue, LOAN_DAYS),
        return_date: r[4] === null ? null : addDays(t, -r[4])
      };
    });

    return { students: students, books: books, loans: loans };
  }

  /* ---------- Хранилище ---------- */
  var db;
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.students && parsed.books && parsed.loans) return parsed;
      }
    } catch (e) { /* хранилище недоступно — используем демо */ }
    return seed();
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
  }
  function nextId(list, key) {
    return list.reduce(function (m, r) { return Math.max(m, r[key]); }, 0) + 1;
  }

  /* ---------- Запросы к данным ---------- */
  function studentById(id) { return db.students.find(function (s) { return s.student_id === id; }); }
  function bookById(id) { return db.books.find(function (b) { return b.book_id === id; }); }
  function activeLoans() { return db.loans.filter(function (l) { return !l.return_date; }); }
  function isOverdue(l) { return !l.return_date && l.due_date < today(); }
  function overdueLoans() { return activeLoans().filter(isOverdue); }
  function available(book) {
    var out = activeLoans().filter(function (l) { return l.book_id === book.book_id; }).length;
    return book.copies - out;
  }
  function studentActive(id) { return activeLoans().filter(function (l) { return l.student_id === id; }); }
  function fullName(s) { return s ? s.first_name + ' ' + s.last_name : '—'; }

  /* ---------- Утилиты UI ---------- */
  var app = document.getElementById('app');
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function sqlStr(v) { return v === null || v === undefined ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'"; }
  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  function head(eyebrow, title, sub, right) {
    return '<div class="page-head"><div>' +
      (eyebrow ? '<div class="eyebrow">' + esc(eyebrow) + '</div>' : '') +
      '<h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') +
      '</div>' + (right || '') + '</div>';
  }
  function statusBadge(l) {
    if (l.return_date) {
      var late = daysBetween(l.due_date, l.return_date);
      return late > 0 ? '<span class="badge grey">Возвращена (опоздание ' + late + ' дн.)</span>' : '<span class="badge ok">Возвращена</span>';
    }
    if (isOverdue(l)) return '<span class="badge late">Просрочена на ' + daysBetween(l.due_date, today()) + ' дн.</span>';
    return '<span class="badge out">На руках</span>';
  }
  function loansTable(list, opts) {
    opts = opts || {};
    if (!list.length) return '<div class="table-wrap"><div class="empty">' + esc(opts.empty || 'Записей нет') + '</div></div>';
    var rows = list.map(function (l) {
      var s = studentById(l.student_id), b = bookById(l.book_id);
      return '<tr>' +
        '<td class="num">' + l.loan_id + '</td>' +
        '<td>' + esc(fullName(s)) + ' <span class="muted">' + esc(s ? s.class : '') + '</span></td>' +
        '<td>' + esc(b ? b.title : '—') + '</td>' +
        '<td>' + fmt(l.issue_date) + '</td>' +
        '<td>' + fmt(l.due_date) + '</td>' +
        '<td>' + statusBadge(l) + '</td>' +
        (opts.returnBtn ? '<td><button class="btn small" data-return="' + l.loan_id + '">Вернуть</button></td>' : '') +
        '</tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr>' +
      '<th class="num">№</th><th>Ученик</th><th>Книга</th><th>Выдана</th><th>Вернуть до</th><th>Статус</th>' +
      (opts.returnBtn ? '<th></th>' : '') +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------- Страницы ---------- */
  var pages = {};

  pages.home = function () {
    var totalCopies = db.books.reduce(function (s, b) { return s + b.copies; }, 0);
    var recent = db.loans.slice().sort(function (a, b) { return b.loan_id - a.loan_id; }).slice(0, 5);
    var over = overdueLoans().length;
    return head('Главный экран', 'Школьная библиотека', 'Выдача и возврат книг, учёт читателей и просрочек.') +
      '<div class="grid grid-4">' +
        stat('Книг в каталоге', db.books.length, totalCopies + ' экземпляров') +
        stat('Читателей', db.students.length) +
        stat('Книг на руках', activeLoans().length) +
        stat('Просрочено', over, null, over > 0) +
      '</div>' +
      '<div class="card mt"><div class="card-head"><h2>Что нужно сделать?</h2></div>' +
        '<div class="actions">' +
          action('issue', '＋', 'Выдать книгу', 'Записать, кто и какую книгу взял') +
          action('return', '↩', 'Вернуть книгу', 'Отметить возврат книги') +
          action('overdue', '!', 'Просрочки', 'Кто не вернул книгу вовремя') +
          action('books', '▤', 'Каталог книг', 'Поиск и добавление книг') +
          action('students', '☺', 'Ученики', 'Список читателей') +
          action('sql', '⌘', 'SQL-консоль', 'CREATE, INSERT, SELECT') +
        '</div></div>' +
      '<div class="card"><div class="card-head"><h2>Последние выдачи</h2><a href="#return">Все выдачи →</a></div>' +
        loansTable(recent) + '</div>';
  };
  function stat(label, value, sub, warn) {
    return '<div class="card stat' + (warn ? ' warn' : '') + '"><div class="label">' + esc(label) + '</div>' +
      '<div class="value">' + esc(value) + '</div>' + (sub ? '<div class="muted" style="font-size:12px">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function action(route, ico, title, text) {
    return '<a class="action" href="#' + route + '"><span class="ico">' + ico + '</span><b>' + esc(title) + '</b><span>' + esc(text) + '</span></a>';
  }

  /* Выдача книги — форма ввода + квитанция (форма вывода) */
  var lastReceipt = null;
  pages.issue = function () {
    var studentOpts = db.students.slice().sort(function (a, b) { return a.last_name.localeCompare(b.last_name, 'ru'); })
      .map(function (s) { return '<option value="' + s.student_id + '">' + esc(s.last_name + ' ' + s.first_name + ' — ' + s.class) + '</option>'; }).join('');
    var bookOpts = db.books.map(function (b) {
      var a = available(b);
      return '<option value="' + b.book_id + '"' + (a <= 0 ? ' data-none="1"' : '') + '>' +
        esc(b.title + ' — ' + b.author + ' (свободно: ' + a + ')') + '</option>';
    }).join('');
    var t = today();
    return head('Форма ввода', 'Выдать книгу', 'Заполните поля и нажмите «Выдать». Система проверит наличие книги и лимит ученика.') +
      '<div class="grid grid-2">' +
        '<div class="card"><form class="form" id="issueForm" novalidate>' +
          '<div class="field"><label for="f-student">Ученик</label>' +
            '<select id="f-student" required><option value="">— выберите ученика —</option>' + studentOpts + '</select>' +
            '<span class="hint">Поле Loans.student_id</span></div>' +
          '<div class="field"><label for="f-book">Книга</label>' +
            '<select id="f-book" required><option value="">— выберите книгу —</option>' + bookOpts + '</select>' +
            '<span class="hint">Поле Loans.book_id</span></div>' +
          '<div class="form-row">' +
            '<div class="field"><label for="f-issue">Дата выдачи</label><input type="date" id="f-issue" value="' + t + '" required></div>' +
            '<div class="field"><label for="f-days">Срок (дней)</label><input type="number" id="f-days" min="1" max="60" value="' + LOAN_DAYS + '" required></div>' +
          '</div>' +
          '<div class="field"><label>Вернуть до</label><input type="text" id="f-due" value="' + fmt(addDays(t, LOAN_DAYS)) + '" readonly><span class="hint">Считается автоматически: дата выдачи + срок</span></div>' +
          '<div id="issueMsg"></div>' +
          '<div class="form-actions"><button class="btn" type="submit">Выдать книгу</button><button class="btn secondary" type="reset">Очистить</button></div>' +
        '</form></div>' +
        '<div class="card"><div class="card-head"><h2>Квитанция о выдаче</h2>' +
          (lastReceipt ? '<button class="btn secondary small no-print" type="button" id="printBtn">Печать</button>' : '') + '</div>' +
          (lastReceipt ? receiptHTML(lastReceipt) : '<div class="table-wrap"><div class="empty">После выдачи здесь появится квитанция — пример формы вывода.</div></div>') +
        '</div>' +
      '</div>';
  };
  function receiptHTML(l) {
    var s = studentById(l.student_id), b = bookById(l.book_id);
    var sql = 'INSERT INTO Loans (loan_id, student_id, book_id, issue_date, due_date, return_date)\nVALUES (' +
      l.loan_id + ', ' + l.student_id + ', ' + l.book_id + ', ' + sqlStr(l.issue_date) + ', ' + sqlStr(l.due_date) + ', NULL);';
    return '<div class="receipt"><span class="stamp">Выдано</span>' +
      '<h3>Школьная библиотека</h3><div class="rnum">Квитанция № ' + l.loan_id + '</div>' +
      '<dl>' +
        '<dt>Ученик</dt><dd>' + esc(fullName(s)) + '</dd>' +
        '<dt>Класс</dt><dd>' + esc(s ? s.class : '') + '</dd>' +
        '<dt>Книга</dt><dd>' + esc(b ? b.title : '') + '</dd>' +
        '<dt>Автор</dt><dd>' + esc(b ? b.author : '') + '</dd>' +
        '<dt>Дата выдачи</dt><dd>' + fmt(l.issue_date) + '</dd>' +
        '<dt>Вернуть до</dt><dd>' + fmt(l.due_date) + '</dd>' +
      '</dl></div>' +
      '<p class="muted" style="font-size:13px;margin:16px 0 6px">SQL, который выполнила система:</p>' +
      '<pre class="code">' + esc(sql) + '</pre>';
  }

  pages['return'] = function () {
    var act = activeLoans().sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; });
    var done = db.loans.filter(function (l) { return l.return_date; }).sort(function (a, b) { return b.return_date < a.return_date ? -1 : 1; });
    return head('Возврат', 'Вернуть книгу', 'Нажмите «Вернуть», когда ученик сдал книгу. Дата возврата ставится сегодняшняя.') +
      '<div class="card"><div class="card-head"><h2>На руках (' + act.length + ')</h2></div>' +
        loansTable(act, { returnBtn: true, empty: 'Все книги в библиотеке' }) + '</div>' +
      '<div class="card"><div class="card-head"><h2>История возвратов</h2></div>' +
        loansTable(done, { empty: 'Возвратов пока нет' }) + '</div>';
  };

  var bookQuery = '';
  pages.books = function () {
    return head('Каталог', 'Книги', 'Все книги библиотеки и сколько экземпляров свободно.') +
      '<div class="card"><div class="card-head"><h2>Каталог</h2>' +
        '<input class="search" type="search" id="bookSearch" placeholder="Поиск по названию, автору, жанру" value="' + esc(bookQuery) + '"></div>' +
        '<div id="booksTable">' + booksTable() + '</div></div>' +
      '<div class="card"><div class="card-head"><h2>Добавить книгу</h2></div>' +
        '<form class="form" id="bookForm">' +
          '<div class="form-row">' +
            '<div class="field"><label for="b-title">Название</label><input id="b-title" required maxlength="120"></div>' +
            '<div class="field"><label for="b-author">Автор</label><input id="b-author" required maxlength="80"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="field"><label for="b-genre">Жанр</label><input id="b-genre" list="genres" required maxlength="40">' +
              '<datalist id="genres">' + uniqueGenres().map(function (g) { return '<option value="' + esc(g) + '">'; }).join('') + '</datalist></div>' +
            '<div class="form-row">' +
              '<div class="field"><label for="b-year">Год</label><input id="b-year" type="number" min="1000" max="2100" required></div>' +
              '<div class="field"><label for="b-copies">Экземпляров</label><input id="b-copies" type="number" min="1" max="999" value="1" required></div>' +
            '</div>' +
          '</div>' +
          '<div class="form-actions"><button class="btn" type="submit">Добавить книгу</button></div>' +
        '</form></div>';
  };
  function uniqueGenres() {
    return db.books.map(function (b) { return b.genre; }).filter(function (g, i, a) { return a.indexOf(g) === i; }).sort();
  }
  function booksTable() {
    var q = bookQuery.trim().toLowerCase();
    var list = db.books.filter(function (b) {
      return !q || (b.title + ' ' + b.author + ' ' + b.genre).toLowerCase().indexOf(q) !== -1;
    });
    if (!list.length) return '<div class="table-wrap"><div class="empty">Ничего не найдено</div></div>';
    return '<div class="table-wrap"><table><thead><tr><th class="num">ID</th><th>Название</th><th>Автор</th><th>Жанр</th><th class="num">Год</th><th class="num">Всего</th><th class="num">Свободно</th></tr></thead><tbody>' +
      list.map(function (b) {
        var a = available(b);
        return '<tr><td class="num">' + b.book_id + '</td><td>' + esc(b.title) + '</td><td>' + esc(b.author) + '</td><td>' + esc(b.genre) + '</td>' +
          '<td class="num">' + esc(b.year) + '</td><td class="num">' + b.copies + '</td>' +
          '<td class="num">' + (a > 0 ? '<span class="badge ok">' + a + '</span>' : '<span class="badge late">0</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  pages.students = function () {
    var list = db.students.slice().sort(function (a, b) { return a.class === b.class ? a.last_name.localeCompare(b.last_name, 'ru') : (a.class < b.class ? -1 : 1); });
    return head('Читатели', 'Ученики', 'Список учеников и сколько книг у каждого на руках.') +
      '<div class="card"><div class="table-wrap"><table><thead><tr><th class="num">ID</th><th>Фамилия</th><th>Имя</th><th>Класс</th><th>Телефон</th><th class="num">На руках</th><th>Статус</th></tr></thead><tbody>' +
      list.map(function (s) {
        var act = studentActive(s.student_id);
        var late = act.filter(isOverdue).length;
        return '<tr><td class="num">' + s.student_id + '</td><td>' + esc(s.last_name) + '</td><td>' + esc(s.first_name) + '</td><td>' + esc(s.class) + '</td>' +
          '<td>' + esc(s.phone) + '</td><td class="num">' + act.length + '</td>' +
          '<td>' + (late ? '<span class="badge late">Должник</span>' : '<span class="badge ok">OK</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-head"><h2>Добавить ученика</h2></div>' +
        '<form class="form" id="studentForm"><div class="form-row">' +
          '<div class="field"><label for="s-first">Имя</label><input id="s-first" required maxlength="40"></div>' +
          '<div class="field"><label for="s-last">Фамилия</label><input id="s-last" required maxlength="40"></div>' +
        '</div><div class="form-row">' +
          '<div class="field"><label for="s-class">Класс</label><input id="s-class" required maxlength="4" placeholder="11A"></div>' +
          '<div class="field"><label for="s-phone">Телефон</label><input id="s-phone" maxlength="20" placeholder="+7 7__ ___ ____"></div>' +
        '</div><div class="form-actions"><button class="btn" type="submit">Добавить ученика</button></div></form></div>';
  };

  pages.overdue = function () {
    var list = overdueLoans().sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; });
    return head('Отчёт', 'Просроченные книги', 'Ученики, которые не вернули книгу в срок, на ' + fmt(today()) + '.',
      '<button class="btn secondary no-print" type="button" onclick="window.print()">Печать отчёта</button>') +
      '<div class="card">' +
        (list.length ? '<div class="alert warn" style="margin-bottom:14px">Просрочено книг: <b>' + list.length + '</b>. Напомните ученикам вернуть книги.</div>' : '') +
        loansTable(list, { returnBtn: true, empty: 'Просрочек нет — все молодцы!' }) + '</div>';
  };

  /* ---------- SQL-консоль ---------- */
  var SCHEMA_SQL = [
    'CREATE TABLE Students (',
    '  student_id INTEGER PRIMARY KEY,',
    '  first_name TEXT NOT NULL,',
    '  last_name  TEXT NOT NULL,',
    '  class      TEXT NOT NULL,',
    '  phone      TEXT',
    ');',
    '',
    'CREATE TABLE Books (',
    '  book_id INTEGER PRIMARY KEY,',
    '  title   TEXT NOT NULL,',
    '  author  TEXT NOT NULL,',
    '  genre   TEXT,',
    '  year    INTEGER,',
    '  copies  INTEGER NOT NULL DEFAULT 1',
    ');',
    '',
    'CREATE TABLE Loans (',
    '  loan_id     INTEGER PRIMARY KEY,',
    '  student_id  INTEGER NOT NULL,',
    '  book_id     INTEGER NOT NULL,',
    '  issue_date  DATE NOT NULL,',
    '  due_date    DATE NOT NULL,',
    '  return_date DATE,',
    '  FOREIGN KEY (student_id) REFERENCES Students(student_id),',
    '  FOREIGN KEY (book_id)    REFERENCES Books(book_id)',
    ');'
  ].join('\n');

  var EXAMPLES = [
    { label: '1. CREATE TABLE', danger: true, sql:
      '-- Создаём таблицы с нуля (старые данные удалятся)\nDROP TABLE IF EXISTS Loans;\nDROP TABLE IF EXISTS Books;\nDROP TABLE IF EXISTS Students;\n\n' + SCHEMA_SQL },
    { label: '2. INSERT INTO', sql:
      "INSERT INTO Students (student_id, first_name, last_name, class, phone) VALUES\n" +
      "  (101, 'Асель', 'Омарова', '11A', '+7 701 000 0001'),\n" +
      "  (102, 'Данияр', 'Сапаров', '11B', '+7 701 000 0002');\n\n" +
      "INSERT INTO Books (book_id, title, author, genre, year, copies) VALUES\n" +
      "  (101, 'Старик и море', 'Эрнест Хемингуэй', 'Классика', 1952, 2),\n" +
      "  (102, 'Дюна', 'Фрэнк Герберт', 'Фантастика', 1965, 1);\n\n" +
      "INSERT INTO Loans (loan_id, student_id, book_id, issue_date, due_date, return_date) VALUES\n" +
      "  (101, 101, 101, date('now'), date('now', '+14 days'), NULL),\n" +
      "  (102, 102, 102, date('now', '-20 days'), date('now', '-6 days'), NULL);\n\n" +
      "SELECT * FROM Loans WHERE loan_id >= 101;" },
    { label: '3. SELECT с AND и OR', sql:
      "-- Книги, которые сейчас на руках у учеников 11A или 11B\n" +
      "SELECT s.first_name, s.last_name, s.class, b.title, l.due_date\n" +
      "FROM Loans l\n" +
      "JOIN Students s ON s.student_id = l.student_id\n" +
      "JOIN Books b    ON b.book_id = l.book_id\n" +
      "WHERE (s.class = '11A' OR s.class = '11B')\n" +
      "  AND l.return_date IS NULL;" },
    { label: 'AND/OR по книгам', sql:
      "-- Классика или казахская литература, изданные после 1900 года\n" +
      "SELECT book_id, title, author, genre, year\n" +
      "FROM Books\n" +
      "WHERE (genre = 'Классика' OR genre = 'Казахская литература')\n" +
      "  AND year > 1900;" },
    { label: 'Просрочки', sql:
      "SELECT s.last_name, s.class, b.title, l.due_date,\n" +
      "       julianday('now') - julianday(l.due_date) AS days_late\n" +
      "FROM Loans l\n" +
      "JOIN Students s ON s.student_id = l.student_id\n" +
      "JOIN Books b    ON b.book_id = l.book_id\n" +
      "WHERE l.return_date IS NULL AND l.due_date < date('now')\n" +
      "ORDER BY days_late DESC;" },
    { label: 'Все таблицы', sql: 'SELECT * FROM Students;\nSELECT * FROM Books;\nSELECT * FROM Loans;' }
  ];

  var sqlState = { SQL: null, db: null, loading: null, text: EXAMPLES[2].sql, results: null, error: null, info: null };

  function loadSqlJs() {
    if (sqlState.SQL) return Promise.resolve(sqlState.SQL);
    if (sqlState.loading) return sqlState.loading;
    sqlState.loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SQLJS_BASE + 'sql-wasm.js';
      s.onload = function () {
        window.initSqlJs({ locateFile: function (f) { return SQLJS_BASE + f; } })
          .then(function (SQL) { sqlState.SQL = SQL; resolve(SQL); }, reject);
      };
      s.onerror = function () { reject(new Error('Не удалось загрузить sql.js. Проверьте интернет.')); };
      document.head.appendChild(s);
    });
    sqlState.loading.catch(function () { sqlState.loading = null; });
    return sqlState.loading;
  }

  // Переносим данные приложения в SQLite
  function buildSqlDb() {
    if (sqlState.db) sqlState.db.close();
    var d = new sqlState.SQL.Database();
    d.run('PRAGMA foreign_keys = ON;');
    d.run(SCHEMA_SQL);
    var st = d.prepare('INSERT INTO Students VALUES (?,?,?,?,?)');
    db.students.forEach(function (s) { st.run([s.student_id, s.first_name, s.last_name, s.class, s.phone || null]); });
    st.free();
    st = d.prepare('INSERT INTO Books VALUES (?,?,?,?,?,?)');
    db.books.forEach(function (b) { st.run([b.book_id, b.title, b.author, b.genre, b.year, b.copies]); });
    st.free();
    st = d.prepare('INSERT INTO Loans VALUES (?,?,?,?,?,?)');
    db.loans.forEach(function (l) { st.run([l.loan_id, l.student_id, l.book_id, l.issue_date, l.due_date, l.return_date]); });
    st.free();
    sqlState.db = d;
  }

  function tableExists(name) {
    var r = sqlState.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='" + name + "'");
    return r.length > 0;
  }
  function readTable(name) {
    var r = sqlState.db.exec('SELECT * FROM ' + name);
    if (!r.length) return [];
    var cols = r[0].columns;
    return r[0].values.map(function (row) {
      var o = {};
      cols.forEach(function (c, i) { o[c] = row[i]; });
      return o;
    });
  }
  // После INSERT/UPDATE/DELETE/CREATE переносим данные из SQLite обратно в приложение
  function syncBack() {
    ['Students', 'Books', 'Loans'].forEach(function (t) {
      if (!tableExists(t)) return;
      var rows = readTable(t);
      if (t === 'Students') db.students = rows.map(function (r) { return { student_id: r.student_id, first_name: String(r.first_name), last_name: String(r.last_name), class: String(r.class), phone: r.phone === null ? '' : String(r.phone) }; });
      if (t === 'Books') db.books = rows.map(function (r) { return { book_id: r.book_id, title: String(r.title), author: String(r.author), genre: r.genre === null ? '' : String(r.genre), year: r.year, copies: Number(r.copies) || 0 }; });
      if (t === 'Loans') db.loans = rows.map(function (r) { return { loan_id: r.loan_id, student_id: r.student_id, book_id: r.book_id, issue_date: String(r.issue_date), due_date: String(r.due_date), return_date: r.return_date ? String(r.return_date) : null }; });
    });
    save();
  }

  pages.sql = function () {
    var schema = [
      ['Students', [['student_id', 'PK'], ['first_name', ''], ['last_name', ''], ['class', ''], ['phone', '']]],
      ['Books', [['book_id', 'PK'], ['title', ''], ['author', ''], ['genre', ''], ['year', ''], ['copies', '']]],
      ['Loans', [['loan_id', 'PK'], ['student_id', 'FK → Students'], ['book_id', 'FK → Books'], ['issue_date', ''], ['due_date', ''], ['return_date', '']]]
    ].map(function (t) {
      return '<div class="tbl"><b>' + t[0] + '</b><ul>' + t[1].map(function (f) {
        return '<li><span>' + f[0] + '</span><span class="key">' + f[1] + '</span></li>';
      }).join('') + '</ul></div>';
    }).join('');

    return head('База данных', 'SQL-консоль', 'Настоящая база SQLite прямо в браузере. Пишите CREATE TABLE, INSERT INTO и SELECT.') +
      '<div class="card"><div class="card-head"><h2>Схема базы</h2><span class="muted" style="font-size:13px">Students 1 — ∞ Loans ∞ — 1 Books</span></div>' +
        '<div class="schema">' + schema + '</div></div>' +
      '<div class="card"><div class="card-head"><h2>Запрос</h2></div>' +
        '<div class="chips no-print" style="margin-bottom:12px">' +
          EXAMPLES.map(function (e, i) { return '<button class="chip" type="button" data-example="' + i + '">' + esc(e.label) + '</button>'; }).join('') +
        '</div>' +
        '<textarea class="sql-editor" id="sqlText" spellcheck="false" aria-label="SQL-запрос">' + esc(sqlState.text) + '</textarea>' +
        '<div class="form-actions mt no-print">' +
          '<button class="btn" type="button" id="runSql">▶ Выполнить</button>' +
          '<button class="btn secondary" type="button" id="resetSql">Пересобрать базу из данных сайта</button>' +
          '<span class="muted" style="font-size:13px;align-self:center">Ctrl + Enter — выполнить</span>' +
        '</div>' +
        '<div id="sqlOut" class="mt">' + sqlResultsHTML() + '</div>' +
      '</div>';
  };

  function sqlResultsHTML() {
    var out = '';
    if (sqlState.error) out += '<div class="alert error">Ошибка: ' + esc(sqlState.error) + '</div>';
    if (sqlState.info) out += '<div class="alert info">' + esc(sqlState.info) + '</div>';
    if (sqlState.results) {
      sqlState.results.forEach(function (r) {
        out += '<div class="result-meta">Найдено строк: <b>' + r.values.length + '</b></div>' +
          '<div class="table-wrap"><table><thead><tr>' + r.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + (r.values.length ? r.values.map(function (row) {
            return '<tr>' + row.map(function (v) { return '<td>' + (v === null ? '<span class="muted">NULL</span>' : esc(v)) + '</td>'; }).join('') + '</tr>';
          }).join('') : '<tr><td colspan="' + r.columns.length + '" class="empty">0 строк</td></tr>') + '</tbody></table></div>';
      });
    }
    if (!out) out = '<div class="muted" style="font-size:14px">Выберите пример или напишите свой запрос и нажмите «Выполнить».</div>';
    return out;
  }
  function refreshSqlOut() { var el = document.getElementById('sqlOut'); if (el) el.innerHTML = sqlResultsHTML(); }

  function runSql() {
    var ta = document.getElementById('sqlText');
    var text = ta.value;
    sqlState.text = text;
    if (/\bDROP\s+TABLE\b/i.test(text) && !window.confirm('Запрос удалит таблицы и все данные сайта. Продолжить?')) return;
    sqlState.error = null; sqlState.info = 'Загрузка базы…'; sqlState.results = null;
    refreshSqlOut();
    loadSqlJs().then(function () {
      if (!sqlState.db) buildSqlDb();
      var res;
      try {
        res = sqlState.db.exec(text);
      } catch (e) {
        sqlState.info = null; sqlState.error = e.message; refreshSqlOut();
        return;
      }
      var changes = /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)\b/i.test(text);
      if (changes) syncBack();
      sqlState.results = res;
      sqlState.info = changes
        ? 'Запрос выполнен. Изменения сохранены — они видны на всех страницах сайта.'
        : (res.length ? null : 'Запрос выполнен.');
      refreshSqlOut();
    }, function (err) {
      sqlState.info = null; sqlState.error = err.message; refreshSqlOut();
    });
  }

  /* ---------- Роутинг ---------- */
  function route() {
    var name = (location.hash || '#home').slice(1);
    if (!pages[name]) name = 'home';
    app.innerHTML = pages[name]();
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === name);
    });
    document.title = (name === 'home' ? '' : (document.querySelector('.nav a.active') || {}).textContent + ' · ') + 'Школьная библиотека';
    bind(name);
    window.scrollTo(0, 0);
  }

  function bind(name) {
    if (name === 'issue') {
      var form = document.getElementById('issueForm');
      var issue = document.getElementById('f-issue'), days = document.getElementById('f-days'), due = document.getElementById('f-due');
      var updDue = function () {
        var n = parseInt(days.value, 10);
        due.value = issue.value && n > 0 ? fmt(addDays(issue.value, n)) : '—';
      };
      issue.addEventListener('input', updDue); days.addEventListener('input', updDue);
      form.addEventListener('reset', function () { setTimeout(function () { updDue(); document.getElementById('issueMsg').innerHTML = ''; }, 0); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = document.getElementById('issueMsg');
        var sid = parseInt(document.getElementById('f-student').value, 10);
        var bid = parseInt(document.getElementById('f-book').value, 10);
        var n = parseInt(days.value, 10);
        var err = null;
        if (!sid) err = 'Выберите ученика.';
        else if (!bid) err = 'Выберите книгу.';
        else if (!issue.value) err = 'Укажите дату выдачи.';
        else if (!(n >= 1 && n <= 60)) err = 'Срок должен быть от 1 до 60 дней.';
        else if (available(bookById(bid)) <= 0) err = 'Свободных экземпляров этой книги нет. Выберите другую книгу.';
        else if (studentActive(sid).length >= MAX_ACTIVE_LOANS) err = 'У ученика уже ' + MAX_ACTIVE_LOANS + ' книги на руках — сначала нужно вернуть одну.';
        else if (studentActive(sid).some(isOverdue)) err = 'У ученика есть просроченная книга. Выдача невозможна, пока он её не вернёт.';
        if (err) { msg.innerHTML = '<div class="alert error">' + esc(err) + '</div>'; return; }
        var loan = {
          loan_id: nextId(db.loans, 'loan_id'), student_id: sid, book_id: bid,
          issue_date: issue.value, due_date: addDays(issue.value, n), return_date: null
        };
        db.loans.push(loan); save(); sqlState.db = null;
        lastReceipt = loan;
        toast('Книга выдана. Квитанция № ' + loan.loan_id);
        route();
      });
      var pb = document.getElementById('printBtn');
      if (pb) pb.addEventListener('click', function () { window.print(); });
    }

    if (name === 'books') {
      var search = document.getElementById('bookSearch');
      search.addEventListener('input', function () { bookQuery = search.value; document.getElementById('booksTable').innerHTML = booksTable(); });
      document.getElementById('bookForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var b = {
          book_id: nextId(db.books, 'book_id'),
          title: document.getElementById('b-title').value.trim(),
          author: document.getElementById('b-author').value.trim(),
          genre: document.getElementById('b-genre').value.trim(),
          year: parseInt(document.getElementById('b-year').value, 10),
          copies: parseInt(document.getElementById('b-copies').value, 10)
        };
        if (!b.title || !b.author || !b.genre || !b.year || !(b.copies > 0)) { toast('Заполните все поля'); return; }
        db.books.push(b); save(); sqlState.db = null;
        toast('Книга «' + b.title + '» добавлена');
        route();
      });
    }

    if (name === 'students') {
      document.getElementById('studentForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var s = {
          student_id: nextId(db.students, 'student_id'),
          first_name: document.getElementById('s-first').value.trim(),
          last_name: document.getElementById('s-last').value.trim(),
          class: document.getElementById('s-class').value.trim().toUpperCase(),
          phone: document.getElementById('s-phone').value.trim()
        };
        if (!s.first_name || !s.last_name || !s.class) { toast('Заполните имя, фамилию и класс'); return; }
        db.students.push(s); save(); sqlState.db = null;
        toast('Ученик ' + fullName(s) + ' добавлен');
        route();
      });
    }

    if (name === 'sql') {
      var ta = document.getElementById('sqlText');
      ta.addEventListener('input', function () { sqlState.text = ta.value; });
      ta.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSql(); } });
      document.getElementById('runSql').addEventListener('click', runSql);
      document.getElementById('resetSql').addEventListener('click', function () {
        sqlState.db = null; sqlState.results = null; sqlState.error = null;
        sqlState.info = 'База будет пересобрана из текущих данных сайта при следующем запросе.';
        refreshSqlOut();
      });
      document.querySelectorAll('[data-example]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          ta.value = EXAMPLES[+btn.getAttribute('data-example')].sql;
          sqlState.text = ta.value;
          ta.focus();
        });
      });
    }

    // Кнопки «Вернуть» (страницы возврата и просрочек)
    document.querySelectorAll('[data-return]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = +btn.getAttribute('data-return');
        var l = db.loans.find(function (x) { return x.loan_id === id; });
        if (!l) return;
        l.return_date = today(); save(); sqlState.db = null;
        var b = bookById(l.book_id);
        toast('Книга «' + (b ? b.title : '') + '» возвращена');
        route();
      });
    });
  }

  document.getElementById('resetBtn').addEventListener('click', function () {
    if (!window.confirm('Сбросить все данные и вернуть демо-данные?')) return;
    db = seed(); save(); sqlState.db = null; lastReceipt = null;
    toast('Демо-данные восстановлены');
    route();
  });

  db = load();
  window.addEventListener('hashchange', route);
  route();
})();
