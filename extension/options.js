document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const saved = $('saved');

  // defaults devem ficar iguais aos do maps.js
  const defaults = {
    openNow: true,
    minRating: 4.3,
    maxDistanceKm: 3,
    price: "$$"
  };

  chrome.storage.sync.get(defaults, (res) => {
    $('openNow').checked = res.openNow;
    $('minRating').value = res.minRating;
    $('maxDistanceKm').value = res.maxDistanceKm;
    $('price').value = res.price;
  });

  $('save').addEventListener('click', () => {
    const prefs = {
      openNow: $('openNow').checked,
      minRating: parseFloat($('minRating').value) || 0,
      maxDistanceKm: parseFloat($('maxDistanceKm').value) || 3,
      price: $('price').value
    };
    chrome.storage.sync.set(prefs, () => {
      saved.style.display = 'inline';
      setTimeout(() => saved.style.display = 'none', 1200);
    });
  });
});
