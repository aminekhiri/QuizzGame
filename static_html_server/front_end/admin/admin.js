// admin.js


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
          if (!confirm(`Supprimer définitivement l’utilisateur « ${user.username} » ?`)) return;
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
            alert(`Utilisateur « ${user.username} » supprimé.`);
          } catch (err) {
            console.error('Erreur suppression utilisateur :', err);
            alert('Impossible de supprimer cet utilisateur.');
          }
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

/**
 * 2) Déconnecte l’utilisateur
 */
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



