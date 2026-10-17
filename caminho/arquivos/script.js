document.getElementById('fechar-alerta').addEventListener('click', function() {
  document.getElementById('alerta-vidro-liquido').style.display = 'none';
});
window.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    document.getElementById('alerta-vidro-liquido').style.display = 'none';
  }
});

// Atualização para 0.1.7 Beta
if (window.location.href.includes('0.1.6')) {
  window.location.href = window.location.href.replace('0.1.6', '0.1.7');
}

// Adicionando notificações de atualização
if (window.location.href.includes('0.1.7')) {
  alert('Atualização para 0.1.7 Beta concluída!');
}
