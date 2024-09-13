import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);


async function sendVerificationEmail(toEmail, token, uId) {

    const verificationUrl = `http://localhost:8001/api/v1/users/verify?token=${token}&uId=${uId}`; // Replace with your actual domain
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
        from: 'noreply@createwithdeb.com', // Replace with your sender email address
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
  
export {
    sendVerificationEmail
}