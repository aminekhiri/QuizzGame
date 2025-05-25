console.log("===== PROFILE.JS LOADING =====");

document.addEventListener('DOMContentLoaded', () => {
  console.log("===== DOM READY =====");

  // 0) Récupérer token
  const token = sessionStorage.getItem('jwt');
  console.log("Token:", token);

  // Préparer headers
  const headers = { 'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`  // On ajoutera le token si présent
   };


  // 1) Récupérer éléments du DOM
  const elU = document.getElementById('p-username');
  const elF = document.getElementById('p-firstname');
  const elL = document.getElementById('p-lastname');
  const ul  = document.getElementById('scores-list');
  const btn = document.getElementById('delete-account-btn');

  // 2) Charger profil
  (async () => {
    try {
      console.log("Fetching /api/me …");
      const r = await fetch('https://localhost:3000/api/me', {
        method:      'GET',
        credentials: 'include',
        headers
      });
      console.log("Profile status:", r.status);
      if (!r.ok) throw new Error(await r.text());
      const { username, first_name, last_name } = await r.json();
      elU.textContent = username;
      elF.textContent = first_name;
      elL.textContent = last_name;
    } catch (e) {
      console.error("❌ Cannot load profile:", e);
    }
  })();


  //c'est une partie que je n'ai pas réussi à faire fonctionner
  // // 3) Charger best-scores
  // (async () => {
  //   try {
  //     console.log("Fetching /api/best-scores …");
  //     const r = await fetch('https://localhost:3000/api/best-scores', {
  //       method:      'GET',
  //       credentials: 'include',
  //       headers
  //     });
  //     console.log("Scores status:", r.status);
  //     if (!r.ok) throw new Error(await r.text());
  //     const scores = await r.json();
  //     ul.innerHTML = scores.length
  //       ? scores.map(s => `<li>${s.category} — ${s.difficulty} — ${s.question_count} q. : ${s.best_score}</li>`).join('')
  //       : '<li>No best score recorded</li>';
  //   } catch (e) {
  //     console.error("❌ Cannot load scores:", e);
  //     ul.innerHTML = '<li>Unable to load scores</li>';
  //   }
  // })();

  // 4) Supprimer le compte
  if (!btn) {
    console.error("❌ #delete-account-btn not found");
    return;
  }
  
  // Récupérer les éléments du modal
  const modal = document.getElementById('confirmation-modal');
  const modalMessage = document.getElementById('modal-message');
  const confirmBtn = document.getElementById('modal-btn-confirm');
  const cancelBtn = document.getElementById('modal-btn-cancel');
  
  // Fonction pour afficher le modal avec options
  function showModal(message, onConfirm, options = {}) {
    modalMessage.textContent = message;
    modal.style.display = 'flex';
    
    // Afficher un seul bouton pour redirection si spécifié
    if (options.redirectButton) {
      // Cacher le bouton annuler
      cancelBtn.style.display = 'none';
      
      // Changer le texte du bouton confirmer et ajouter la classe de style
      confirmBtn.textContent = options.redirectButton;
      confirmBtn.classList.add('modal-btn-redirect');
      
      // Handler unique pour la redirection
      const redirectHandler = () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', redirectHandler);
        confirmBtn.classList.remove('modal-btn-redirect');
        if (onConfirm) onConfirm();
      };
      
      confirmBtn.addEventListener('click', redirectHandler);
    } else {
      // Configuration normale à deux boutons
      cancelBtn.style.display = 'inline-block';
      confirmBtn.textContent = 'Delete';
      
      // Gérer les boutons du modal
      const confirmHandler = async () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', confirmHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        if (onConfirm) await onConfirm();
      };
      
      const cancelHandler = () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', confirmHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        console.log("→ Deletion cancelled");
      };
      
      confirmBtn.addEventListener('click', confirmHandler);
      cancelBtn.addEventListener('click', cancelHandler);
    }
  }
  
  console.log("→ delete-account-btn found, attaching listener");
  btn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    console.log("→ Click on delete-account-btn");
    
    // Afficher le modal de confirmation
    showModal("Are you sure you want to delete your account? This action is irreversible.", async () => {
      try {
        console.log("Deleting via DELETE /api/me …");
        const r = await fetch('https://localhost:3000/api/me', {
          method: 'DELETE',
          credentials: 'include',
          headers
        });
        console.log("Delete response status:", r.status);
        if (r.status === 204) {
          // Afficher le modal de succès avec un seul bouton de redirection
          showModal('Votre compte a été supprimé avec succès.', 
            () => {
              window.location.href = '../login/login.html';
            },
            { redirectButton: 'Back to the login page' }
          );
        } else {
          const text = await r.text();
          throw new Error(`${r.status} ${text}`);
        }
      } catch (e) {
        console.error("❌ Delete account failed:", e);
        showModal("Erreur lors de la suppression du compte : " + e.message, () => {});
      }
    });
  });
});
