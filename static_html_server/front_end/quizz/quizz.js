// quiz.js

const BASE_URL        = 'https://the-trivia-api.com';
let PRELOAD_LIMIT   = 100;
let questionPool      = [];
let currentCategory   = '';
let currentDifficulty = '';
let score             = 0;
let timerInterval     = null;
let timeLeft          = 0;
let questionsAsked = 0;
let MAX_QUESTIONS = 10; 
let quizCompleted = false; // Indique si le quiz est terminé

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

//permet de choisir le nombre de questions parmi 3 choix (10, 20 ou 30)
function questionNumber() {
  const options = [10, 20, 30];
  const select  = document.getElementById('question-number-select');

  // Ajout des options
  options.forEach(n => {
    select.append(new Option(n.toString(), n));
  });
}

document.addEventListener('DOMContentLoaded', questionNumber);




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

function updateCounter() {
  const ctr = document.getElementById('question-counter');
  ctr.textContent = `Question ${questionsAsked + 1}/${MAX_QUESTIONS}`;
}

// **Affiche l’écran final**
function showFinalScreen() {
  if (!quizCompleted) {
    return;
  }
  clearInterval(timerInterval);
  document.getElementById('question-box').style.display   = 'none';
  document.getElementById('final-screen').style.display  = 'block';
  document.getElementById('new-quiz-btn').style.display = 'block';
  document.getElementById('final-score').textContent     = score;
  document.getElementById('total-questions').textContent = MAX_QUESTIONS;

}


function showNextQuestion() {
  const qEl  = document.querySelector('.question');
  const aEl  = document.querySelector('.answers');
  const next = document.getElementById('next-btn');

  updateCounter();
  questionsAsked++;

  if (questionsAsked > MAX_QUESTIONS) {
    // Si on a atteint le nombre maximum de questions, afficher l'écran final
    quizCompleted = true; // Indique si le quiz est terminé
    showFinalScreen();
    return;
  }

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


async function completeQuiz() {
  if (!quizCompleted) {
    return;
  }
  try {
    // On récupère la catégorie et la difficulté sélectionnées
    const payload = {
      category_code   : currentCategory   || 'all',
      difficulty_level: currentDifficulty || 'all',
      question_count:   MAX_QUESTIONS,
      total_score     : score
    };
    // Ici on suppose que le serveur saura transformer
    // categoryCode → category_id, difficultyCode → difficulty_id
    const res = await fetch("https://localhost:3000/api/quiz/complete", {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Erreur enregistrement quiz");
    }

    alert("Votre score a bien été enregistré !");
    window.location.href = "profile.html";

  } catch (err) {
    console.error(err);
    alert(err.message);
  }

  // Afficher l'écran final
  showFinalScreen();


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

    const qCount = parseInt(document.getElementById('question-number-select').value,10) || MAX_QUESTIONS;

    MAX_QUESTIONS   = qCount;
    PRELOAD_LIMIT   = qCount;

    currentCategory   = selCat.value;
    currentDifficulty = selDiff.value;
    cfg.style.display  = 'none';
    qbox.style.display = 'block';

    document.getElementById('quit-btn').style.display = 'block';

    try {
      await loadPool(currentCategory, currentDifficulty);
      
      showNextQuestion();
    } catch (e) {
      console.error(e);
      document.querySelector('.question')
        .textContent = 'Impossible de charger : ' + e.message;
    }
  });

  // Gestionnaire pour le bouton "Quit"
  document.getElementById('quit-btn')
  .addEventListener('click', () => {
    resetQuizState();
});


  document.getElementById('next-btn')
    .addEventListener('click', showNextQuestion);

    
    document.getElementById('next-btn')
      .addEventListener('click', () => {
        
        if (questionsAsked > MAX_QUESTIONS) {
          
          document.getElementById('next-btn').style.display = 'none';
        }
      });

});

//le bouton quit s'affiche quand 
async function doLogout() {
  try {
    await fetch("https://localhost:3000/logout", { credentials: "include" });
  } catch { /* ignore, on veut juste effacer quand même */ }

  // on vide les données locales
  localStorage.removeItem("username");
  localStorage.removeItem("password");
  // si tu stockes bestScore_…, tu peux garder ou tout vider :
  // Object.keys(localStorage).forEach(k => k.startsWith('bestScore_') && localStorage.removeItem(k));

  // redirection vers la page de connexion
  window.location.href = "login.html";
}

document.getElementById('logout-btn').addEventListener('click', (e) => {
  doLogout();
});

document.getElementById('new-quiz-btn')
  .addEventListener('click', () => {
    resetQuizState();
});


function resetQuizState() {
  //Arrêter le timer
  clearInterval(timerInterval);
  timerInterval = null;
  timeLeft = 0;

  // Réinitialiser les variables de l'état du quiz
  questionsAsked = 0;
  score          = 0;
  quizCompleted  = false;

  // Vider le pool de questions
  questionPool = [];

  // réinitialiser les éléments de l'interface
  document.getElementById('score').textContent           = '0';
  document.getElementById('timer').textContent           = '';
  document.getElementById('question-counter').textContent = '';
  document.querySelector('.answers').innerHTML           = '';
  
  //Masquer les zones quiz/final et afficher config
  document.getElementById('question-box').style.display   = 'none';
  document.getElementById('final-screen').style.display  = 'none';
  document.getElementById('quit-btn').style.display      = 'none';
  document.getElementById('new-quiz-btn').style.display  = 'none';
  document.getElementById('config').style.display        = 'block';
}


// Gestionnaire pour le bouton "menu"
document.getElementById('menu-btn')
  .addEventListener('click', () => {
    window.location.href = '../menu/menu.html';
  });

// Gestionnaire pour le bouton "profile"
document.getElementById('profile-btn')
  .addEventListener('click', () => {
    window.location.href = '../profile/profile.html';
  });