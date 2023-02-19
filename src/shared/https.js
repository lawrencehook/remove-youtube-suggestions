// const DONORS_LIST_HOST = 'http://localhost:8080/rys/donors.json';
const DONORS_LIST_HOST = 'https://lawrencehook.com/rys/donors.json';

function sendHTTPRequest(type, url, jsonParams, token) {
  const request = new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open(type, url, true);

    req.timeout = 5 * 1000; // 5 seconds

    if (token) req.setRequestHeader('Authorization', 'Bearer ' + token);

    if (jsonParams) {
      req.setRequestHeader('Content-Type', 'application/json');
      req.send(JSON.stringify(jsonParams));
    } else {
      req.send(null);
    }

    // Successful response
    req.addEventListener('load', res => {

      // Log out if token is expired.
      if (req.status === 500) {
        const response = JSON.parse(req.response)
        if (response.message === 'Invalid Token') {
          browser.storage.local.remove('user');
          browser.storage.local.remove('login_token');
          HTML?.removeAttribute('logged-in');
        }
      }

      resolve(req.response);
    });

    // Error response
    req.addEventListener('error', res => {
      console.log(req);
      console.log(res);
      reject('HTTP Error');
    });
  });

  return request;
}


function sendGetDonorsRequest() {
  const url = DONORS_LIST_HOST;
  const request = sendHTTPRequest('GET', url);
  return request;
}
