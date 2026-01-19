const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const config = require('../config');

const sesClient = new SESClient({ region: config.AWS_REGION });

async function sendMagicLinkEmail(email, magicLinkUrl) {
  const params = {
    Source: config.EMAIL_FROM,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: 'Sign in to Remove YouTube Suggestions',
        Charset: 'UTF-8',
      },
      Body: {
        Text: {
          Data: `Click the link below to sign in to Remove YouTube Suggestions:\n\n${magicLinkUrl}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this email, you can safely ignore it.`,
          Charset: 'UTF-8',
        },
        Html: {
          Data: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Sign in to Remove YouTube Suggestions</h2>
  <p style="color: #555; font-size: 16px; line-height: 1.5;">
    Click the button below to sign in:
  </p>
  <p style="margin: 30px 0;">
    <a href="${magicLinkUrl}"
       style="background-color: #ff0000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
      Sign In
    </a>
  </p>
  <p style="color: #888; font-size: 14px;">
    This link will expire in 15 minutes.
  </p>
  <p style="color: #888; font-size: 14px;">
    If you didn't request this email, you can safely ignore it.
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #aaa; font-size: 12px;">
    Remove YouTube Suggestions - Take back control of your YouTube experience
  </p>
</body>
</html>
          `.trim(),
          Charset: 'UTF-8',
        },
      },
    },
  };

  const command = new SendEmailCommand(params);
  return sesClient.send(command);
}

module.exports = {
  sendMagicLinkEmail,
};
