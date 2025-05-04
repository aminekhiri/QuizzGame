// menu.js

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('solo-btn')
      .addEventListener('click', () => {
        window.location.href = 'quizz.html';
      });
  
    document.getElementById('multi-btn')
      .addEventListener('click', () => {
        window.location.href = 'multiplayer.html';
      });
  });
  