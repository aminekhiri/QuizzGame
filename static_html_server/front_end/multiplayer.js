// multiplayer.js

const WS_URL = "wss://localhost:3000/multiplayer";

let socket;
let yourScore = 0;
let theirScore = 0;
let timerInterval = null;

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function startTimer(sec) {
  clearInterval(timerInterval);
  const disp = document.getElementById('timer');
  let t = sec;
  disp.textContent = t;
  timerInterval = setInterval(() => {
    t--;
    disp.textContent = t;
    if (t <= 0) clearInterval(timerInterval);
  }, 1000);
}

function renderQuestion(q) {
  const txt = document.getElementById('question-text');
  const ans = document.getElementById('answers');
  ans.innerHTML = '';
  txt.textContent = q.question;
  startTimer(q.time);
  q.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.textContent = choice;
    btn.onclick = () => {
      socket.send(JSON.stringify({ type: 'answer', answer: choice }));
      // disable further clicks
      ans.querySelectorAll('button').forEach(b => b.disabled = true);
    };
    ans.appendChild(btn);
  });

  ans.innerHTML = '';
  selectedBtn = null;

  q.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.textContent = choice;
    btn.onclick = () => {
      if (selectedBtn) selectedBtn.classList.remove('selected');
      selectedBtn = btn;
      btn.classList.add('selected');        // ⓵ met en surbrillance le choix
      socket.send(JSON.stringify({ type: 'answer', answer: choice }));
      // on continue à recevoir scores + highlight à la fin du chrono
    };
    ans.appendChild(btn);
  })
}

function updateScores(data) {
  yourScore   = data.you;
  theirScore  = data.them;
  document.getElementById('score-you').textContent  = yourScore;
  document.getElementById('score-them').textContent = theirScore;
}

function showResult(outcome) {
  clearInterval(timerInterval);
  hide(document.getElementById('question-box'));
  const txt = document.getElementById('result-text');
  if (outcome === 'win')        txt.textContent = 'You won ! 🎉';
  else if (outcome === 'lose')  txt.textContent = 'you lost.';
  else                           txt.textContent = 'Draw.';
  show(document.getElementById('result-screen'));
}

window.addEventListener('DOMContentLoaded', () => {
  const status       = document.getElementById('status');
  const matchInfo    = document.getElementById('match-info');
  const opponentName = document.getElementById('opponent-name');
  const questionBox  = document.getElementById('question-box');
  const nextBtn      = document.getElementById('next-btn');
  const playAgain    = document.getElementById('play-again');
  const backMenu     = document.getElementById('back-menu');

  socket = new WebSocket(WS_URL);
  socket.onopen = () => {
    status.textContent = 'En attente d’un adversaire…';
    // envoie ton username pour identification
    const me = localStorage.getItem('username') || 'Invité';
    socket.send(JSON.stringify({ type: 'join', username: me }));
  };

  socket.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case 'matched':
        status.style.display = 'none';
        opponentName.textContent = msg.opponent;
        show(matchInfo);
        break;
      case 'question':
        hide(matchInfo);
        show(questionBox);
        hide(nextBtn);
        renderQuestion(msg);
        break;
      case 'scores':
        updateScores(msg);
        document.querySelectorAll('.answers button').forEach(b => {
            if (b.textContent === msg.correct) 
              b.classList.add('correct');
            });
            // ⓷ si on a fait un mauvais choix, on le colore en rouge
            if (selectedBtn && !selectedBtn.classList.contains('correct')) {
                selectedBtn.classList.add('wrong');
            }
            document.getElementById('score-you').textContent  = msg.you;
            document.getElementById('score-them').textContent = msg.them;
        break;
      case 'end':
        showResult(msg.outcome);
        break;
    }
  };

  socket.onerror = () => status.textContent = 'Erreur de connexion au serveur.';
  socket.onclose = () => status.textContent = 'Connexion fermée.';

  nextBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'next' }));
  });

  playAgain.addEventListener('click', () => location.reload());
  backMenu.addEventListener('click', () => window.location.href = 'menu.html');
});



// Gestionnaire pour le bouton "menu"
document.getElementById('menu-btn')
  .addEventListener('click', () => {
    window.location.href = 'menu.html';
  });