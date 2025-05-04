// profile.js

document.addEventListener('DOMContentLoaded', async () => {
  // 1) Récupérer les éléments du DOM
  const elUsername  = document.getElementById('p-username');
  const elFirstname = document.getElementById('p-firstname');
  const elLastname  = document.getElementById('p-lastname');
  const ulScores    = document.getElementById('scores-list');

  // 2) Charger le profil
  let username = '', first_name = '', last_name = '';
  try {
    const res = await fetch('https://localhost:3000/api/me', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ({ username, first_name, last_name } = await res.json());
  } catch (err) {
    console.error('Erreur récupération profil :', err);
  }

  // 3) Injecter les infos
  if (elUsername)  elUsername.textContent  = username    || '—';
  if (elFirstname) elFirstname.textContent = first_name  || '—';
  if (elLastname)  elLastname.textContent  = last_name   || '—';

  // 4) Charger les best scores pour CE user
  let bestScores = [];
  try {
    const res = await fetch('https://localhost:3000/api/best-scores', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bestScores = await res.json();
  } catch (err) {
    console.error('Erreur récupération best-scores :', err);
  }

  // 5) Afficher la liste
  ulScores.innerHTML = '';
  if (bestScores.length === 0) {
    ulScores.innerHTML = '<li>Aucun meilleur score enregistré.</li>';
  } else {
    bestScores.forEach(({ category, difficulty, question_count, best_score }) => {
      const li = document.createElement('li');
      li.textContent = 
        `${category} — ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} — ` +
        `${question_count} questions : ${best_score}`;
      ulScores.appendChild(li);
    });
  }
});
