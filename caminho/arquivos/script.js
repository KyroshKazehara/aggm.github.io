document.getElementById('fechar-alerta').addEventListener('click', function() {
  document.getElementById('alerta-vidro-liquido').style.display = 'none';
});
window.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    document.getElementById('alerta-vidro-liquido').style.display = 'none';
  }
});