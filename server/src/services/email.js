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
        Data: 'Sign in to RYS',
        Charset: 'UTF-8',
      },
      Body: {
        Text: {
          Data: `Here's your sign-in link for RYS:\n\n${magicLinkUrl}\n\nLink expires in 15 minutes. If you didn't request this, just ignore it.\n\n— Lawrence`,
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
  <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
    Here's your sign-in link for RYS:
  </p>
  <p style="margin: 24px 0;">
    <a href="${magicLinkUrl}"
       style="background-color: #0600FB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
      Sign In
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">
    Link expires in 15 minutes. If you didn't request this, just ignore it.
  </p>
  <p style="color: #999; font-size: 13px; margin-top: 32px;">
    — Lawrence
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
