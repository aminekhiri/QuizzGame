// admin.js

/**
 * 1) Charge la liste des utilisateurs
 */
async function loadUsers() {
  try {
    const res = await fetch("https://localhost:3000/api/admin/users", {
      credentials: "include"
    });
    if (!res.ok) {
      console.error("Erreur", await res.text());
      return;
    }
    const { users } = await res.json();
    const ul = document.getElementById("users-list");
    if (!ul) return;
    ul.innerHTML = "";
    users.forEach(u => {
      const li = document.createElement("li");
      li.innerHTML = `
        Username: ${u.username}
        First name: ${u.first_name}
        Last name: ${u.last_name}
      `;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error("Erreur fetch users:", err);
  }
}

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
