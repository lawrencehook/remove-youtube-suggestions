const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const config = require('../config');

const sesClient = new SESClient({ region: config.AWS_REGION });

async function sendMagicLinkEmail(email, magicLinkUrl, { isPremium = false } = {}) {
  const premiumBadge = isPremium
    ? ' <span style="font-size: 12px; font-weight: 500; color: #0600fb; letter-spacing: 0.02em;">Premium</span>'
    : '';
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 0; margin: 0; color: #333; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="padding: 16px 24px; border-bottom: 1px solid rgba(0,0,0,0.1);">
    <a href="https://lawrencehook.com/rys/" style="text-decoration: none; font-size: 18px; font-weight: 600; color: #1a1a1a;">RYS</a>${premiumBadge}
  </div>
  <div style="padding: 32px 24px 40px;">
  <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
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
  </div>
  </div>
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

async function sendWelcomeEmail(email) {
  const params = {
    Source: config.EMAIL_FROM,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: 'Welcome to RYS Premium',
        Charset: 'UTF-8',
      },
      Body: {
        Text: {
          Data: `Welcome to RYS Premium!\n\nThank you for subscribing. Your premium features are now active.\n\n— Lawrence`,
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 0; margin: 0; color: #333; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="padding: 16px 24px; border-bottom: 1px solid rgba(0,0,0,0.1);">
    <a href="https://lawrencehook.com/rys/" style="text-decoration: none; font-size: 18px; font-weight: 600; color: #1a1a1a;">RYS</a> <span style="font-size: 12px; font-weight: 500; color: #0600fb; letter-spacing: 0.02em;">Premium</span>
  </div>
  <div style="padding: 32px 24px 40px;">
  <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
    Welcome to RYS Premium!
  </p>
  <p style="font-size: 15px; line-height: 1.5; color: #444; margin: 0 0 16px 0;">
    Thank you for subscribing. Your premium features are now active.
  </p>
  <p style="color: #999; font-size: 13px; margin-top: 32px;">
    — Lawrence
  </p>
  </div>
  </div>
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

const FEEDBACK_URL = 'https://docs.google.com/forms/d/1AzQQxTWgG6M5N87jinvXKQkGS6Mehzg19XV4mjteTK0';

async function sendCancellationEmail(email) {
  const params = {
    Source: config.EMAIL_FROM,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: 'Your RYS Premium subscription has been canceled',
        Charset: 'UTF-8',
      },
      Body: {
        Text: {
          Data: `Your RYS Premium subscription has been canceled.\n\nThe free version of RYS is still yours to use anytime.\n\nIf you have a moment, we'd love to hear what we could do better: ${FEEDBACK_URL}\n\nThanks for giving Premium a try.\n\n— Lawrence`,
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 0; margin: 0; color: #333; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="padding: 16px 24px; border-bottom: 1px solid rgba(0,0,0,0.1);">
    <a href="https://lawrencehook.com/rys/" style="text-decoration: none; font-size: 18px; font-weight: 600; color: #1a1a1a;">RYS</a>
  </div>
  <div style="padding: 32px 24px 40px;">
  <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
    Your Premium subscription has been canceled.
  </p>
  <p style="font-size: 15px; line-height: 1.5; color: #444; margin: 0 0 16px 0;">
    The free version of RYS is still yours to use anytime.
  </p>
  <p style="font-size: 15px; line-height: 1.5; color: #444; margin: 0 0 24px 0;">
    If you have a moment, we'd love to hear what we could do better:
  </p>
  <p style="margin: 0 0 24px 0;">
    <a href="${FEEDBACK_URL}"
       style="background-color: #0600FB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; display: inline-block;">
      Share Feedback
    </a>
  </p>
  <p style="font-size: 15px; line-height: 1.5; color: #444; margin: 0 0 16px 0;">
    Thanks for giving Premium a try.
  </p>
  <p style="color: #999; font-size: 13px; margin-top: 32px;">
    — Lawrence
  </p>
  </div>
  </div>
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
  sendWelcomeEmail,
  sendCancellationEmail,
};
