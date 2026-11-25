(function reportStoredFixtureData() {
  'use strict';
  const output = document.createElement('pre');
  output.id = 'fixture-stored-output';
  const automated = new URLSearchParams(location.search).has('auto');
  output.hidden = !automated;
  document.body.appendChild(output);
  let clicked = false;
  setInterval(async () => {
    const { cart } = await globalThis.PGYCartStorage.getCart();
    if (automated && !clicked && !cart.creators['000000101']) {
      const button = document.querySelector('#pgy-cart-add-button');
      if (button) {
        clicked = true;
        button.click();
      }
    }
    output.textContent = JSON.stringify(cart.creators['000000101'] || {}, null, 2);
  }, 100);
})();
