(() => {
  const config = window.pgAdminConfig || {};
  const allowedAdmins = config.allowedAdmins || [];
  const gate = document.getElementById('auth-gate');
  const messageEl = document.getElementById('auth-message');
  const signInBtn = document.getElementById('google-signin');

  function setMessage(text) {
    if (messageEl) messageEl.textContent = text;
  }

  function hideGate() {
    gate?.classList.add('is-hidden');
  }

  function showGate() {
    gate?.classList.remove('is-hidden');
  }

  const requireAuth = config.requireAuth !== false;

  const installBypass = () => {
    window.pgAdminAuth = {
      onReady(callback) {
        if (typeof callback === 'function') {
          setTimeout(() => callback(null), 0);
        }
      },
      async getIdToken() {
        return null;
      },
      signOut() {},
    };
    hideGate();
  };

  if (!requireAuth || config.bypassAuth) {
    installBypass();
    return;
  }

  const app = firebase.initializeApp(config.firebase);
  const auth = firebase.auth(app);
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  let currentUser = null;
  const readyCallbacks = [];
  let ready = false;

  function notifyReady(user) {
    ready = true;
    while (readyCallbacks.length) {
      const cb = readyCallbacks.shift();
      if (typeof cb === 'function') cb(user);
    }
  }

  window.pgAdminAuth = {
    onReady(callback) {
      if (ready && currentUser) callback(currentUser);
      else readyCallbacks.push(callback);
    },
    async getIdToken() {
      if (!currentUser) return null;
      return currentUser.getIdToken();
    },
    signOut: () => auth.signOut(),
  };

  signInBtn?.addEventListener('click', async () => {
    try {
      signInBtn.disabled = true;
      setMessage('Opening Google sign-in…');
      await auth.signInWithPopup(provider);
    } catch (err) {
      console.error(err);
      setMessage('Sign-in cancelled. Try again.');
      signInBtn.disabled = false;
    }
  });

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      currentUser = null;
      showGate();
      signInBtn && (signInBtn.disabled = false);
      setMessage('Use the authorised Google account to continue.');
      return;
    }
    if (!allowedAdmins.includes(user.email)) {
      setMessage('This Google account is not authorised. Please switch.');
      await auth.signOut();
      return;
    }
    currentUser = user;
    hideGate();
    setMessage(`Signed in as ${user.email}`);
    notifyReady(user);
  });
})();
