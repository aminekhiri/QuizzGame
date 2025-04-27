document.getElementById("login").addEventListener("click", function() {
    const username = document.getElementById("identifiant").value;
    const password = document.getElementById("password").value;
  
    if (!username || !password) {
      alert("Veuillez entrer votre identifiant et mot de passe.");
      return;
    }
  
    const loginData = { username, password };
  
    fetch("http://localhost:3000/login", {    // ← /login au lieu de /
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData),
      credentials: 'include'  // pour envoyer/recevoir le cookie si besoin
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Erreur lors de la connexion');
      }
      return response.json();
    })
    .then(data => {
      console.log("Réponse du serveur : ", data);
      window.location.href = "quizz.html"; // Redirige vers la page quiz
    })
    .catch(error => {
      console.error("Erreur : ", error);
      alert("Échec de la connexion.");
    });
  });
  