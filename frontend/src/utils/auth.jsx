export function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000;
  } catch (e) {
    return null;
  }
}

export function scheduleTokenRefresh() {
  const token = localStorage.getItem('access_token');
  const expiry = getTokenExpiry(token);
  if (!expiry) return;

  const now = Date.now();
  const delay = expiry - now - 60_000; // refresh 1 min before expiry

  if (delay > 0) {
    setTimeout(async () => {
      try {
        const res = await import('../services/api').then(mod => mod.authService.refreshToken());
        const { access_token, refresh_token } = res.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        scheduleTokenRefresh();
      } catch (err) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }, delay);
  }
}
