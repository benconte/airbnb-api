import nodemailer from "nodemailer";

// Transporter is created once at module load — never inside the function
const transporter = nodemailer.createTransport({
  // @ts-ignore
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // false = STARTTLS on port 587
  auth: {
    user: process.env["EMAIL_USER"],
    pass: process.env["EMAIL_PASS"],
  },
  tls: {
    rejectUnauthorized: false
  }
});

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<void> => {
  await transporter.sendMail({
    from: process.env["EMAIL_FROM"] || `"Airbnb" <${process.env["EMAIL_USER"]}>`,
    to,
    subject,
    html,
  });
};
