import nodemailer from "nodemailer";

// Transporter is created once at module load — never inside the function
const transporter = nodemailer.createTransport({
  host: process.env["EMAIL_HOST"] || "smtp.gmail.com",
  port: parseInt(process.env["EMAIL_PORT"] || "587"),
  secure: false, // false = STARTTLS on port 587
  auth: {
    user: process.env["EMAIL_USER"],
    pass: process.env["EMAIL_PASS"],
  },
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
