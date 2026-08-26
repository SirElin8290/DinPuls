(() => {
  const loginView = document.getElementById('loginView');
  const appView = document.getElementById('appView');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logout = document.getElementById('logout');
  const navItems = [...document.querySelectorAll('.nav-item')];
  const views = [...document.querySelectorAll('.view')];

  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
  }

  function showLogin() {
    appView.hidden = true;
    loginView.hidden = false;
  }

  function showView(id) {
    views.forEach(view => { view.hidden = view.id !== id; });
    navItems.forEach(item => item.classList.toggle('active', item.dataset.view === id));
  }

  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) {
      loginError.hidden = false;
      return;
    }
    loginError.hidden = true;
    sessionStorage.setItem('dinpuls_company_demo', '1');
    showApp();
  });

  document.getElementById('forgot').addEventListener('click', event => {
    event.preventDefault();
    alert('Återställning av lösenord ansluts när företagskonton och backend är på plats.');
  });

  logout.addEventListener('click', () => {
    sessionStorage.removeItem('dinpuls_company_demo');
    showLogin();
  });

  navItems.forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => showView(button.dataset.open)));

  if (sessionStorage.getItem('dinpuls_company_demo') === '1') showApp();
})();