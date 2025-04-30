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
  // Pour le mot de passe, on le lit du localStorage (stocké au login)
  document.getElementById('p-password').textContent  =
    localStorage.getItem('password') || '—';

  // 2) Charger la catégorie→codes
  const categoriesMap = await fetchCategoriesMap();

  // 3) Parcourir les clés bestScore_username_cat_diff
  const ul = document.getElementById('scores-list');
  ul.innerHTML = '';

  Object.keys(localStorage)
    .filter(key => key.startsWith(`bestScore_${username}_`))
    .forEach(key => {
      // key = "bestScore_<username>_<catCode>_<diff>"
      const parts = key.split('_');
      // ["bestScore","<username>","<catCode>","<diff>"]
      const catCode = parts[2];
      const diff    = parts[3];

      // trouver le label de la catégorie
      let label = 'Toutes catégories';
      if (catCode !== 'all') {
        const entry = Object.entries(categoriesMap)
          .find(([lbl, codes]) => codes.includes(catCode));
        if (entry) label = entry[0];
      }

      // formater la difficulté
      const diffLabel = diff === 'all'
        ? 'Toutes difficultés'
        : diff.charAt(0).toUpperCase() + diff.slice(1);

      const score = localStorage.getItem(key);

      const li = document.createElement('li');
      li.textContent = `${label} — ${diffLabel} : ${score}`;
      ul.appendChild(li);
    });

  // 4) Si aucun score pour cet utilisateur
  if (!ul.children.length) {
    const li = document.createElement('li');
    li.textContent = 'Aucun score enregistré pour vous.';
    ul.appendChild(li);
  }
});
