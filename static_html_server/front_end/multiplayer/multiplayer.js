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
    if (t <= 0) {
      clearInterval(timerInterval);
      // désactive les boutons
      disableAnswerButtons();

      if (selectedAnswer===null){
              // envoie la dernière réponse mémorisée (ou null si on a répondu à rien)
      socket.send(JSON.stringify({
        type:   'answer',
        answer: selectedAnswer
      }));
      }

    }
  }, 1000);
}

function renderQuestion(q) {
  const txt = document.getElementById('question-text');
  const ans = document.getElementById('answers');

  // reset
  ans.innerHTML     = '';
  selectedAnswer    = null;
  selectedBtn       = null;

  txt.textContent   = q.question;
  startTimer(q.time);

  q.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.textContent = choice;
    btn.onclick = () => {
      // si on avait déjà un bouton sélectionné, on enlève la classe
      if (selectedBtn) selectedBtn.classList.remove('selected');
      // nouveau bouton sélectionné
      selectedBtn    = btn;
      selectedAnswer = choice;
      btn.classList.add('selected');
     
      //on tente 
      socket.send(JSON.stringify({
        type: 'answer',
        answer: selectedAnswer
      }));
    };
    ans.appendChild(btn);
  });
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

  // Affiche le score final
  const youEl   = document.getElementById('final-score-you');
  const themEl  = document.getElementById('final-score-them');
  youEl.textContent  = `Your score: ${yourScore}`;
  themEl.textContent = `Opponent score: ${theirScore}`;

  //affiche l'ecran de résultat
  show(document.getElementById('result-screen'));
}

globalThis.addEventListener('DOMContentLoaded', () => {
  const status       = document.getElementById('status');
  const matchInfo    = document.getElementById('match-info');
  const questionBox  = document.getElementById('question-box');
  const nextBtn      = document.getElementById('next-btn');
  const playAgain    = document.getElementById('play-again');
  const backMenu     = document.getElementById('back-menu');
  const opponentName = document.getElementById('opponent-name');

  socket = new WebSocket(WS_URL);
  socket.onopen = () => {
    
    // envoie ton username pour identification
    const me = sessionStorage.getItem('username') || 'Invité';

    socket.send(JSON.stringify({ type: 'join', username: me }));
  };
  // on active les boutons de réponse
  enableAnswerButtons();

  socket.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case 'matched':
        document.getElementById('waiting').style.display = 'none'; //on cache le waiting
        status.style.display = 'none'; //on cache le server connection

        opponentName.textContent = msg.opponent; //on affiche le nom de l'adversaire
        matchInfo.style.display = 'block'

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
        //on desactive les boutons de réponse
        disableAnswerButtons();
        document.querySelectorAll('.answers button').forEach(b => {
            if (b.textContent === msg.correct) 
              b.classList.add('correct');
            });
            // si on a fait un mauvais choix, on le colore en rouge
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
  backMenu.addEventListener('click', () => window.location.href = '../menu/menu.html');
});



// Gestionnaire pour le bouton "menu"
document.getElementById('menu-btn')
  .addEventListener('click', () => {
    window.location.href = '../menu/menu.html';
  });

// empeche de cliquer sur les boutons de réponse quand le chrono est écoulé
function disableAnswerButtons() {
  document.querySelectorAll('#answers button').forEach(b => b.disabled = true);
}

// réactive les boutons de réponse
function enableAnswerButtons() {
  document.querySelectorAll('#answers button').forEach(b => b.disabled = false);
}
