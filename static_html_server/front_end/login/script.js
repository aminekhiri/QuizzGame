// script.js

// Navigation vers la page d'inscription
document.getElementById("register-btn").addEventListener("click", () => {
  window.location.href = "../register/register.html";
});

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

document.getElementById("login").addEventListener("click", async (e) => {
  e.preventDefault();

  // Récupération des éléments
  const username = document.getElementById("identifiant").value.trim();
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("error-message");
  
  // Masquer tout message d'erreur précédent
  errorMessage.textContent = "";
  errorMessage.classList.remove("visible");

  if (!username || !password) {
    // Afficher l'erreur dans l'interface plutôt qu'avec une alerte
    errorMessage.textContent = "Please enter your username and password.";
    errorMessage.classList.add("visible");
    return;
  }

  try {
    const res = await fetch("https://localhost:3000/login", {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",  // pour recevoir le cookie JWT
      body:        JSON.stringify({ username, password })
    });

    // Récupérer tout le JSON renvoyé
    const body = await res.json();

    // Si le back renvoie une erreur, on lèvera ici
    if (!res.ok) {
      throw new Error(body.message || "Échec de la connexion");
    }

    // Connexion réussie → on stocke le token et le username
    const token = body.token;
    
    if (!token) {
      console.warn("Server did not return a token despite successful login");
    } else {
      console.log("Token received and stored in sessionStorage");
      
      // Décoder le token pour vérification
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log("Token expiration:", new Date(payload.exp * 1000));
        console.log("Current time:", new Date());
        
        const remainingTime = payload.exp * 1000 - Date.now();
        console.log("Token valid for:", Math.floor(remainingTime / 3600000), "hours");
        
        if (remainingTime <= 0) {
          console.error("Received an expired token!");
        }
      } catch (tokenErr) {
        console.error("Failed to decode token:", tokenErr);
      }
    }
    
    sessionStorage.setItem("jwt", token);
    sessionStorage.setItem("username", username);

    // Initialiser un score global si nécessaire
    if (!sessionStorage.getItem("bestScore_all_all")) {
      sessionStorage.setItem("bestScore_all_all", "0");
    }

    // Rediriger vers le quiz
    window.location.href = "../menu/menu.html";

  } catch (err) {
    console.error(err);
    // Afficher le message d'erreur dans l'interface
    errorMessage.textContent = "Incorrect username or password";
    errorMessage.classList.add("visible");
  }
});
