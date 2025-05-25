// signup.js

function togglePassword() {
  const input = document.getElementById("password");
  const eye = document.querySelector(".toggle-eye");

  if (input.type === "password") {
      input.type = "text";
      eye.src = "../media/eye-closed.png";
  } else {
      input.type = "password";
      eye.src = "../media/eye-open.png";
  }
}


document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('signup-btn');
  
    btn.addEventListener('click', async () => {
      const first_name = document.getElementById('first_name').value.trim();
      const last_name  = document.getElementById('last_name').value.trim();
      const username   = document.getElementById('username').value.trim();
      const password   = document.getElementById('password').value;
      
      // Récupérer les éléments pour afficher les messages
      const errorMsg = document.getElementById('error-message');
      const successMsg = document.getElementById('success-message');
      
      // Cacher les messages précédents
      errorMsg.textContent = '';
      errorMsg.classList.remove('visible');
      successMsg.textContent = '';
      successMsg.classList.remove('visible');
  
      if (!first_name || !last_name || !username || !password) {
        errorMsg.textContent = "Please fill in all fields.";
        errorMsg.classList.add('visible');
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
          // Afficher le message de succès
          successMsg.innerHTML = "Account created successfully! You can now <a href='../login/login.html'>log in</a>.";
          successMsg.classList.add('visible');
          
          // Réinitialiser le formulaire
          document.getElementById('first_name').value = '';
          document.getElementById('last_name').value = '';
          document.getElementById('username').value = '';
          document.getElementById('password').value = '';
          
          // Rediriger après un délai pour laisser l'utilisateur voir le message
          setTimeout(() => {
            window.location.href = "../login/login.html";
          }, 3000);
        } else if (res.status === 500) {
          const { message } = await res.json();
          errorMsg.textContent = "Username already exists. Please choose another one.";
          errorMsg.classList.add('visible');
        } else {
          const { message } = await res.json();
          errorMsg.textContent = "Error: " + message;
          errorMsg.classList.add('visible');
        }
      } catch (err) {
        console.error(err);
        errorMsg.textContent = "Unable to contact the server. Please try again later.";
        errorMsg.classList.add('visible');
      }
    });
  });
  