// quiz.js

const BASE_URL        = 'https://the-trivia-api.com';
const PRELOAD_LIMIT   = 100;
let questionPool      = [];
let currentCategory   = '';
let currentDifficulty = '';
let score             = 0;
let timerInterval     = null;
let timeLeft          = 0;

// Durées par difficulté (secondes)
const DIFFICULTY_TIME = {
  easy:   30,
  medium: 15,
  hard:    10
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function decodeHtml(html) {
  const t = document.createElement('textarea');
  t.innerHTML = html;
  return t.value;
}

async function loadCategories() {
  const [catRes, metaRes] = await Promise.all([
    fetch(`${BASE_URL}/api/categories`),
    fetch(`${BASE_URL}/api/metadata`)
  ]);
  const categories = await catRes.json();
  const meta       = await metaRes.json();

  const merged = Object.entries(categories).map(([label, codes]) => {
    const count = codes
      .map(code => meta.byCategory[code] || 0)
      .reduce((a,b) => a + b, 0);
    return { label, code: codes[0]||'', count };
  });

  merged.sort((a,b) => a.label.localeCompare(b.label));

  const select = document.getElementById('category-select');
  select.innerHTML = '';
  select.append(new Option('All categories',''));
  merged.forEach(({ label, code, count }) => {
    select.append(new Option(`${label} (${count})`, code));
  });
}

function loadDifficulties() {
  const diffs = ['easy','medium','hard'];
  const select = document.getElementById('difficulty-select');
  select.innerHTML = '';
  select.append(new Option('All difficulities',''));
  diffs.forEach(d => {
    select.append(new Option(d.charAt(0).toUpperCase()+d.slice(1), d));
  });
}

async function loadPool(category='', difficulty='') {
  const url = new URL(`${BASE_URL}/api/questions`);
  url.searchParams.set('limit', PRELOAD_LIMIT);
  url.searchParams.set('type', 'multipleChoice');        
  if (category)   url.searchParams.set('categories', category);
  if (difficulty) url.searchParams.set('difficulty', difficulty);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API status ${res.status}`);
  questionPool = await res.json();
  shuffle(questionPool);
}

function showNextQuestion() {
  const qEl  = document.querySelector('.question');
  const aEl  = document.querySelector('.answers');
  const next = document.getElementById('next-btn');

  if (questionPool.length === 0) {
    return loadPool(currentCategory, currentDifficulty)
      .then(showNextQuestion);
  }

  const q = questionPool.pop();
  next.style.display = 'none';
  aEl.innerHTML = '';

  startTimer();

  const rawQ = (typeof q.question === 'object' && q.question.text)
    ? q.question.text : q.question;
  qEl.textContent = decodeHtml(rawQ);

  const correct = decodeHtml(q.correctAnswer);
  const wrongs  = q.incorrectAnswers.map(decodeHtml);
  const all     = [correct, ...wrongs];
  shuffle(all);

  all.forEach(ans => {
    const btn = document.createElement('button');
    btn.textContent = ans;
    btn.addEventListener('click', () => {
      aEl.querySelectorAll('button').forEach(b => b.disabled = true);
      if (ans === correct) {
        btn.classList.add('correct');
        score++;
        document.getElementById('score').textContent = score;
      
        // === mise à jour du bestScore pour la catégorie et la difficulté ===
        const currentUser = localStorage.getItem('username') || '';
        const catKey      = currentCategory   || 'all';
        const diffKey     = currentDifficulty || 'all';
        const storageKey  = `bestScore_${currentUser}_${catKey}_${diffKey}`;
      
        const prev = parseInt(localStorage.getItem(storageKey) || '0', 10);
        if (score > prev) {
          localStorage.setItem(storageKey, score.toString());
        }
      }
      else {
        btn.classList.add('wrong');
        aEl.querySelectorAll('button')
          .forEach(b => {
            if (b.textContent === correct) b.classList.add('correct');
          });
      }
      next.style.display = 'block';
    });
    aEl.appendChild(btn);
  });
}


function startTimer() {
  clearInterval(timerInterval);
  const display = document.getElementById('timer');
  timeLeft = DIFFICULTY_TIME[currentDifficulty] ?? 20;
  display.textContent = timeLeft;
  timerInterval = setInterval(() => {
    timeLeft--;
    display.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      // Bloquer les réponses
      document.querySelectorAll('.answers button').forEach(b => b.disabled = true);
      // Révéler la bonne réponse
      document.querySelectorAll('.answers button')
        .forEach(b => {
          if (b.textContent === document.querySelector('button.correct')?.textContent) return;
          // nothing
        });
      // Afficher next
      document.getElementById('next-btn').style.display = 'block';
    }
  }, 1000);
}


document.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();    // remplit #category-select
  loadDifficulties();        // remplit #difficulty-select

  const selCat  = document.getElementById('category-select');
  const selDiff = document.getElementById('difficulty-select');
  const cfg     = document.getElementById('config');
  const qbox    = document.getElementById('question-box');
  const start   = document.getElementById('start-btn');

  start.addEventListener('click', async () => {
    currentCategory   = selCat.value;
    currentDifficulty = selDiff.value;
    cfg.style.display  = 'none';
    qbox.style.display = 'block';
    try {
      await loadPool(currentCategory, currentDifficulty);
      showNextQuestion();
    } catch (e) {
      console.error(e);
      document.querySelector('.question')
        .textContent = 'Impossible de charger : ' + e.message;
    }
  });

  document.getElementById('next-btn')
    .addEventListener('click', showNextQuestion);
});
