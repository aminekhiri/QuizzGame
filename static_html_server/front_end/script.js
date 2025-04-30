// script.js

// Navigation vers la page d'inscription
document.getElementById("register-btn").addEventListener("click", () => {
  window.location.href = "register.html";
});

document.getElementById("login").addEventListener("click", async (e) => {
  e.preventDefault();

  const username = document.getElementById("identifiant").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    alert("Veuillez entrer votre identifiant et mot de passe.");
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/login", {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",  // pour recevoir le cookie JWT
      body:        JSON.stringify({ username, password })
    });

    const body = await res.json();
    if (!res.ok) {
      // Affiche le message d’erreur renvoyé par le back
      throw new Error(body.message || "Échec de la connexion");
    }

    // Connexion réussie → on stocke le pseudo
    localStorage.setItem("username", username);

    // Initialiser un score global si nécessaire
    if (!localStorage.getItem("bestScore_all_all")) {
      localStorage.setItem("bestScore_all_all", "0");
    }

    // Rediriger vers le quiz
    window.location.href = "quizz.html";

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});
