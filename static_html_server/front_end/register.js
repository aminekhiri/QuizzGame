// signup.js

function togglePassword() {
  const input = document.getElementById("password");
  const eye = document.querySelector(".toggle-eye");

  if (input.type === "password") {
      input.type = "text";
      eye.src = "eye-closed.png";
  } else {
      input.type = "password";
      eye.src = "eye-open.png";
  }
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('signup-btn');
  
    btn.addEventListener('click', async () => {
      const first_name = document.getElementById('first_name').value.trim();
      const last_name  = document.getElementById('last_name').value.trim();
      const username   = document.getElementById('username').value.trim();
      const password   = document.getElementById('password').value;
  
      if (!first_name || !last_name || !username || !password) {
        alert("Merci de remplir tous les champs.");
        return;
      }
  
      try {
        const res = await fetch("https://localhost:3000/signup", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ first_name, last_name, username, password })
        });
  
        if (res.status === 201) {
          alert("Inscription réussie ! Vous pouvez maintenant vous connecter.");
          window.location.href = "login.html";
        } else if (res.status === 409) {
          const { message } = await res.json();
          alert(message);
        } else {
          const { message } = await res.json();
          alert("Erreur : " + message);
        }
      } catch (err) {
        console.error(err);
        alert("Impossible de contacter le serveur.");
      }
    });
  });
  