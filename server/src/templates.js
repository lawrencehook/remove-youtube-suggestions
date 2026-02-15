// Shared HTML page templates — styled to match lawrencehook.com/rys

const RYS_LOGO_URL = 'https://lawrencehook.com/rys/assets/rys.svg';
const RYS_HOME_URL = 'https://lawrencehook.com/rys/';

function renderPage({ title, heading, message, icon }) {
  const iconHTML = icon === 'check'
    ? `<div class="icon check">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      </div>`
    : icon === 'error'
    ? `<div class="icon error">
        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — RYS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }

    header {
      height: 64px;
      padding: 0 24px;
      background: #fff;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    header a {
      display: flex;
      align-items: center;
      text-decoration: none;
    }

    header img {
      height: 24px;
      width: 24px;
    }

    header .title {
      font-size: 20px;
      font-weight: normal;
      color: #1a1a1a;
    }

    header .premium-badge {
      font-size: 12px;
      font-weight: 500;
      color: #0600fb;
      letter-spacing: 0.02em;
    }

    main {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }

    .card {
      text-align: center;
      padding: 48px 40px;
      background: #fff;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      max-width: 420px;
      width: 100%;
    }

    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 auto 20px;
    }

    .icon svg {
      width: 28px;
      height: 28px;
      fill: white;
    }

    .icon.check { background: #4CAF50; }
    .icon.error { background: #f44336; }

    h1 {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    p {
      color: #666;
      font-size: 15px;
      line-height: 1.5;
    }

    footer {
      height: 48px;
      background: #fff;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 32px;
    }

    footer a {
      color: #666;
      font-size: 14px;
      text-decoration: none;
    }

    footer a:hover {
      color: #1a1a1a;
    }
  </style>
</head>
<body>
  <header>
    <a href="${RYS_HOME_URL}">
      <img src="${RYS_LOGO_URL}" alt="RYS">
    </a>
    <span class="title">RYS</span>
    <span class="premium-badge">Premium</span>
  </header>

  <main>
    <div class="card">
      ${iconHTML}
      <h1>${heading}</h1>
      <p>${message}</p>
    </div>
  </main>

  <footer>
    <a href="https://docs.google.com/forms/d/1AzQQxTWgG6M5N87jinvXKQkGS6Mehzg19XV4mjteTK0" target="_blank">Feedback</a>
    <a href="${RYS_HOME_URL}" target="_blank">Homepage</a>
  </footer>
</body>
</html>
  `.trim();
}

module.exports = { renderPage };
