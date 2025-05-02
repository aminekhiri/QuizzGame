// profile.js

const BASE = 'https://the-trivia-api.com';

// Charge la map label→codes pour traduire code→label
async function fetchCategoriesMap() {
  const res = await fetch(`${BASE}/api/categories`);
  return res.ok ? await res.json() : {};
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1) Récupérer le profil depuis le backend
  let username = '', first_name = '', last_name = '';
  try {
    const res = await fetch('http://localhost:3000/api/me', {
      credentials: 'include'
    });
    if (res.ok) {
      ({ username, first_name, last_name } = await res.json());
    }
  } catch {
    console.warn("Impossible de récupérer le profil depuis le back");
  }

  // Injecter les infos dans le DOM
  document.getElementById('p-username').textContent  = username || 'Anonyme';
  document.getElementById('p-firstname').textContent = first_name || '—';
  document.getElementById('p-lastname').textContent  = last_name  || '—';

  // 2) Récupérer les scores depuis le backend
  const ul = document.getElementById('scores-list');
  ul.innerHTML = '';

    // 2) Récupérer les meilleurs scores depuis le backend
    try {
      const res = await fetch('http://localhost:3000/api/best-scores', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Impossible de récupérer les scores.");
  
      const scores = await res.json();  // [{category, difficulty, score}, …]
      scores.forEach(({ category, difficulty, score }) => {
        const li = document.createElement('li');
        li.textContent = `${category} — ${difficulty} : ${score}`;
        ul.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      const li = document.createElement('li');
      li.textContent = 'Erreur lors du chargement des scores.';
      ul.appendChild(li);
    }
  

  // 3) Si aucun score pour cet utilisateur
  if (!ul.children.length) {
    const li = document.createElement('li');
    li.textContent = 'Aucun score enregistré pour vous.';
    ul.appendChild(li);
  }
});
