const BRAND_COLOR = "#FF5A5F";

const baseTemplate = (content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Airbnb</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f7f7f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background-color: ${BRAND_COLOR}; padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .body { padding: 40px; color: #484848; line-height: 1.7; font-size: 15px; }
    .body h2 { color: ${BRAND_COLOR}; font-size: 20px; margin-top: 0; }
    .btn { display: inline-block; margin: 24px 0; padding: 14px 32px; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .detail-box { background: #f9f9f9; border-left: 4px solid ${BRAND_COLOR}; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
    .detail-box p { margin: 6px 0; font-size: 14px; }
    .detail-box strong { color: #222; }
    .footer { padding: 24px 40px; text-align: center; font-size: 13px; color: #9b9b9b; border-top: 1px solid #ebebeb; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>airbnb</h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Airbnb, Inc. · All rights reserved.</p>
      <p>You're receiving this because you have an account on Airbnb.</p>
    </div>
  </div>
</body>
</html>
`;

export const welcomeEmail = (name: string, role: string): string => {
  const roleMessage =
    role === "HOST"
      ? `<p>As a <strong>Host</strong>, you can start earning by listing your first property. Share your space with guests from around the world!</p>
         <a href="#" class="btn">Create Your First Listing</a>`
      : `<p>As a <strong>Guest</strong>, you have access to thousands of unique places to stay around the world. Start exploring!</p>
         <a href="#" class="btn">Explore Listings</a>`;

  return baseTemplate(`
    <h2>Welcome to Airbnb, ${name}! 🎉</h2>
    <p>We're thrilled to have you on board. Your account has been successfully created.</p>
    ${roleMessage}
    <p>If you have any questions, our support team is always here to help.</p>
    <p>Happy travels,<br/><strong>The Airbnb Team</strong></p>
  `);
};

export const bookingConfirmationEmail = (
  guestName: string,
  listingTitle: string,
  location: string,
  checkIn: string,
  checkOut: string,
  totalPrice: number
): string =>
  baseTemplate(`
    <h2>Your Booking is Confirmed! ✅</h2>
    <p>Hi <strong>${guestName}</strong>, your reservation has been confirmed. Here are your booking details:</p>
    <div class="detail-box">
      <p><strong>Property:</strong> ${listingTitle}</p>
      <p><strong>Location:</strong> ${location}</p>
      <p><strong>Check-in:</strong> ${checkIn}</p>
      <p><strong>Check-out:</strong> ${checkOut}</p>
      <p><strong>Total Price:</strong> $${totalPrice.toFixed(2)}</p>
    </div>
    <p><strong>Cancellation Policy:</strong> Free cancellation is available up to 48 hours before check-in. After that, the booking is non-refundable.</p>
    <p>We hope you have an amazing stay!</p>
    <p>Warm regards,<br/><strong>The Airbnb Team</strong></p>
  `);

export const bookingCancellationEmail = (
  guestName: string,
  listingTitle: string,
  checkIn: string,
  checkOut: string
): string =>
  baseTemplate(`
    <h2>Booking Cancelled</h2>
    <p>Hi <strong>${guestName}</strong>, your booking has been cancelled. Here are the details of the cancelled reservation:</p>
    <div class="detail-box">
      <p><strong>Property:</strong> ${listingTitle}</p>
      <p><strong>Check-in:</strong> ${checkIn}</p>
      <p><strong>Check-out:</strong> ${checkOut}</p>
    </div>
    <p>We're sorry to see this booking go! There are plenty of other great places available — we'd love to help you find your next stay.</p>
    <a href="#" class="btn">Find Another Listing</a>
    <p>If you have any concerns, please don't hesitate to reach out to our support team.</p>
    <p>Best regards,<br/><strong>The Airbnb Team</strong></p>
  `);

export const passwordResetEmail = (name: string, resetLink: string): string =>
  baseTemplate(`
    <h2>Reset Your Password</h2>
    <p>Hi <strong>${name}</strong>, we received a request to reset your Airbnb account password.</p>
    <p>Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.</p>
    <a href="${resetLink}" class="btn">Reset Password</a>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: ${BRAND_COLOR}; font-size: 13px;">${resetLink}</p>
    <p style="color: #9b9b9b; font-size: 13px; margin-top: 24px;">If you did not request this, you can safely ignore this email. Your password will not be changed.</p>
  `);
