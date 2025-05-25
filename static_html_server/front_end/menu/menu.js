// menu.js

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('solo-btn')
    .addEventListener('click', () => window.location.href = '../quizz/quizz.html');
  document.getElementById('multi-btn')
    .addEventListener('click', () => window.location.href = '../multiplayer/multiplayer.html');
  document.getElementById('logout-btn')
    .addEventListener('click', doLogout);
  document.getElementById('admin-btn')
    .addEventListener('click', () => window.location.href = '../admin/admin.html');
});

// Logout function
async function doLogout() {
  try {
    console.log("Logging out...");
    await fetch("https://localhost:3000/logout", { 
      method: 'POST',
      credentials: "include" 
    });
  } catch (err) {
    console.error("Logout error:", err);
  } finally {
    // Always clear the local storage and redirect
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("password");
    sessionStorage.removeItem("jwt");
    
    // Redirect to login page
    window.location.href = "../login/login.html";
  }
}


