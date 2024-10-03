import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);


async function sendVerificationEmail(toEmail, token, uId) {

    const verificationUrl = `http://localhost:8001/api/v1/users/verify?token=${token}&uId=${uId}`;
    const subject = 'Email Verification';

    const htmlContent = `
      <html>
        <body>
          <p>Hello,</p>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${verificationUrl}">Verify Email</a>
          <p>If you did not request this verification, please ignore this email.</p>
        </body>
      </html>
    `;
  
    try {
      const response = await resend.emails.send({
        from: 'noreply@createwithdeb.com',
        to: toEmail,
        subject: subject,
        html: htmlContent,
      });
  
      console.log('Email sent successfully:', response);
      return response;
    } catch (error) {
      console.error('Failed to send email:', error);
      return ;
    }
}

async function sendForgotPassword(toEmail, token, uId) {
  const verificationUrl = `http://localhost:8001/api/v1/users/forgotPassword?token=${token}&uId=${uId}`;
  
  try {
    const response = await resend.emails.send({
      from: 'noreply@createwithdeb.com', // Your verified sender email
      to: toEmail,
      subject: 'Reset Your Password',
      html: `
        <p>Hi,</p>
        <p>Click the link below to reset your password:</p>
        <a href="${verificationUrl}">Reset Password</a>
        <p>If you did not request a password reset, please ignore this email.</p>
      `,
    });

    console.log('Email sent:', response);
    return response;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send the password reset email.');
  }
}
  
export {
    sendVerificationEmail,
    sendForgotPassword
}