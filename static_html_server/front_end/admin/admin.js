// admin.js


// Fonction pour afficher le modal de confirmation
function showConfirmationModal(message, onConfirm, options = {}) {
  const modal = document.getElementById('confirmation-modal');
  const modalMessage = document.getElementById('modal-message');
  const confirmBtn = document.getElementById('modal-btn-confirm');
  const cancelBtn = document.getElementById('modal-btn-cancel');
  
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
    };
    
    confirmBtn.addEventListener('click', confirmHandler);
    cancelBtn.addEventListener('click', cancelHandler);
  }
}



document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn    = document.getElementById('logout-btn');
  const menuBtn      = document.getElementById('menu-btn');
  const usersList    = document.getElementById('users-list');
  const adminMessage = document.getElementById('admin-message');

  // Déconnexion
  logoutBtn.addEventListener('click', async () => {
    await fetch('https://localhost:3000/logout', { method: 'GET', credentials: 'include' });
    window.location.href = '../login/login.html';
  });

  // Retour au menu principal
  menuBtn.addEventListener('click', () => {
    window.location.href = '../menu/menu.html';
  });

  // Chargement de la liste des utilisateurs
  async function loadUsers() {
    try {
      const res = await fetch('https://localhost:3000/api/admin/users', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { users } = await res.json();

      usersList.innerHTML = '';
      users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
          <span class="usr">Username: ${user.username}</span>
          <span class="fn">Firstname: ${user.first_name}</span>
          <span class="ln">Lastname: ${user.last_name}</span>
          <span class="ca">User created at: ${user.created_at}</span>
          <button class="delete-user-btn">Delete Account</button>
        `;

        // Bouton Supprimer
        li.querySelector('.delete-user-btn').addEventListener('click', async () => {
                  showConfirmationModal(`Delete user « ${user.username} » permanently ?`, async () => {
            try {
              const del = await fetch(
                `https://localhost:3000/api/admin/users/${encodeURIComponent(user.username)}`,
                {
                  method:      'DELETE',
                  credentials: 'include'
                }
              );
              if (!del.ok) throw new Error(`HTTP ${del.status}`);
              li.remove();
            } catch (err) {
              console.error('Erreur suppression utilisateur :', err);
              alert('Impossible de supprimer cet utilisateur.');
            }
          });
        });

        usersList.appendChild(li);
      });
    } catch (err) {
      console.error('Erreur chargement users :', err);
      adminMessage.textContent = 'You have not access to the admin dashboard';
    }
  }

  loadUsers();
});

async function doLogout() {
  try {
    await fetch("https://localhost:3000/logout", { credentials: "include" });
  } catch { /* ignore */ }
  window.location.href = "../login/login.html";
}

/**
 * 3) Au chargement du DOM, on initialise tout
 */
document.addEventListener("DOMContentLoaded", () => {
  // Charger les utilisateurs
  loadUsers();

  // Bouton Menu
  const menuBtn = document.getElementById("menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      window.location.href = "../menu/menu.html";
    });
  }

  // Bouton Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      doLogout();
    });
  }
});
