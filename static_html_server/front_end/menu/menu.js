// menu.js


document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('solo-btn')
    .addEventListener('click', () => window.location.href = '../quizz/quizz.html');
  document.getElementById('multi-btn')
    .addEventListener('click', () => window.location.href = '../multiplayer/multiplayer.html');
  document.getElementById('logout-btn')
    .addEventListener('click', doLogout);
    document.getElementById('admin-btn')
    .addEventListener('click', () => window.location.href = '../admin/admin.html'
    );
});




//le bouton quit s'affiche quand 
async function doLogout() {
  try {
    await fetch("https://localhost:3000/logout", { credentials: "include" });
  } catch { // on ignore les erreurs
    }

  // on vide les données locales
  localStorage.removeItem("username");
  localStorage.removeItem("password");
  
  // redirection vers la page de connexion
  window.location.href = "../login/login.html";



}


