document.addEventListener('DOMContentLoaded', async () => {
  // 0) Récupérer le token JWT stocké (sessionStorage)
  const token = sessionStorage.getItem('jwt');

  // 1) Récupérer les éléments du DOM
  const elUsername  = document.getElementById('p-username');
  const elFirstname = document.getElementById('p-firstname');
  const elLastname  = document.getElementById('p-lastname');
  const ulScores    = document.getElementById('scores-list');

  // 2) Charger le profil
  let username = '', first_name = '', last_name = '';
  try {
    const res = await fetch('https://localhost:3000/api/me', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bestScores = await res.json();
  } catch (err) {
    console.error('Erreur récupération best-scores :', err);
  }

  // 5) Afficher la liste
  ulScores.innerHTML = '';
  if (bestScores.length === 0) {
    ulScores.innerHTML = '<li>No best score recorded</li>';
  } else {
    bestScores.forEach(({ category, difficulty, question_count, best_score }) => {
      const li = document.createElement('li');
      li.textContent =
        `${category} — ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} — ` +
        `${question_count} questions : ${best_score}`;
      ulScores.appendChild(li);
    });
  }

  // 6) Bouton de suppression de compte
  const deleteBtn = document.getElementById('delete-account-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement votre compte ?')) {
        return;
      }
      try {
        const res = await fetch('https://localhost:3000/api/me', {
          method:      'DELETE',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // rediriger après suppression
        alert('Votre compte a été supprimé.');
        window.location.href = '../login/login.html';
      } catch (err) {
        console.error('Erreur suppression compte :', err);
        alert('Une erreur est survenue lors de la suppression de votre compte.');
      }
    });
  }
});
