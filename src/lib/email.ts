import nodemailer from "nodemailer";
import crypto from "crypto";

// SMTP configuration
const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const fromEmail =
  process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@example.com";
const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

// Create transporter
const transporter = nodemailer.createTransport(smtpConfig);

// Generic email sender
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP not configured, skipping email send");
    return;
  }

  try {
    await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    });
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// Generate secure random token
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Email templates
const emailTemplates = {
  verification: (name: string | null, token: string) => ({
    subject: "Verify your email address",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Verify Your Email</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${name || "there"},</p>
            <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/api/auth/verify-email?token=${token}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${baseUrl}/api/auth/verify-email?token=${token}</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
            <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `,
  }),

  passwordReset: (name: string | null, token: string) => ({
    subject: "Reset your password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Reset Your Password</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${name || "there"},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/reset-password?token=${token}" style="background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #f5576c;">${baseUrl}/reset-password?token=${token}</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `,
  }),

  passwordChanged: (name: string | null) => ({
    subject: "Your password has been changed",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Password Changed</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${name || "there"},</p>
            <p>Your password has been successfully changed.</p>
            <p>If you didn't make this change, please contact support immediately.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">Stay secure!</p>
          </div>
        </body>
      </html>
    `,
  }),

  welcome: (name: string | null, organizationName: string) => ({
    subject: "Welcome to AI-Powered Project Management!",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${name || "there"},</p>
            <p>Welcome to AI-Powered Project Management! Your organization <strong>${organizationName}</strong> has been created.</p>
            <p>Here's what you can do to get started:</p>
            <ul>
              <li>Create your first board</li>
              <li>Add team members to your organization</li>
              <li>Start managing tasks with our Kanban boards</li>
              <li>Use AI to generate tasks and plan sprints (Pro/Enterprise plans)</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/boards" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Get Started</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">Happy project managing!</p>
          </div>
        </body>
      </html>
    `,
  }),

  subscriptionWelcome: (
    name: string | null,
    organizationName: string,
    planName: string
  ) => ({
    subject: `Welcome to ${planName}!`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Subscription Activated!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${name || "there"},</p>
            <p>Congratulations! Your organization <strong>${organizationName}</strong> is now subscribed to the <strong>${planName}</strong> plan.</p>
            <p>With ${planName}, you now have access to:</p>
            <ul>
              <li>AI-powered task generation</li>
              <li>AI sprint planning</li>
              <li>Advanced features and higher limits</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/boards" style="background: #11998e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Start Using Features</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for your subscription!</p>
          </div>
        </body>
      </html>
    `,
  }),

  subscriptionRequired: (name: string | null, organizationName: string) => ({
    subject: "Upgrade to unlock AI features",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Unlock AI Features</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${name || "there"},</p>
            <p>Your organization <strong>${organizationName}</strong> is currently on the Free plan.</p>
            <p>To access AI-powered features like task generation and sprint planning, upgrade to Pro or Enterprise:</p>
            <ul>
              <li><strong>Pro:</strong> AI features, advanced collaboration</li>
              <li><strong>Enterprise:</strong> All Pro features, priority support, custom integrations</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/billing" style="background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Upgrade Now</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">Questions? Contact our support team.</p>
          </div>
        </body>
      </html>
    `,
  }),

  taskAssignment: (
    name: string | null,
    taskTitle: string,
    boardName: string
  ) => ({
    subject: `You've been assigned to: ${taskTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">New Task Assignment</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${name || "there"},</p>
            <p>You've been assigned to a new task:</p>
            <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4facfe;">
              <h2 style="margin: 0 0 10px 0; color: #333;">${taskTitle}</h2>
              <p style="margin: 0; color: #666;">Board: ${boardName}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/boards" style="background: #4facfe; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Task</a>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  boardInvitation: (
    inviterName: string | null,
    boardName: string,
    token: string
  ) => ({
    subject: `You've been invited to ${boardName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Board Invitation</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi there,</p>
            <p><strong>${
              inviterName || "Someone"
            }</strong> has invited you to join the board <strong>${boardName}</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/api/boards/invite/accept?token=${token}" style="background: #fa709a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Accept Invitation</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">This invitation will expire in 7 days.</p>
          </div>
        </body>
      </html>
    `,
  }),

  organizationInvitation: (
    inviterName: string | null,
    organizationName: string,
    token: string
  ) => ({
    subject: `You've been invited to ${organizationName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Organization Invitation</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi there,</p>
            <p><strong>${
              inviterName || "Someone"
            }</strong> has invited you to join the organization <strong>${organizationName}</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/api/organizations/invite/accept?token=${token}" style="background: #30cfd0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Accept Invitation</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">This invitation will expire in 7 days.</p>
          </div>
        </body>
      </html>
    `,
  }),

  paymentFailed: (name: string | null, organizationName: string) => ({
    subject: "Payment failed - Action required",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Payment Failed</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${name || "there"},</p>
            <p>We were unable to process the payment for your organization <strong>${organizationName}</strong>.</p>
            <p>Please update your payment method to continue using your subscription:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/billing" style="background: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Update Payment Method</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any questions, please contact our support team.</p>
          </div>
        </body>
      </html>
    `,
  }),

  subscriptionCancelled: (
    name: string | null,
    organizationName: string,
    planName: string
  ) => ({
    subject: "Subscription cancelled",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Subscription Cancelled</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${name || "there"},</p>
            <p>Your <strong>${planName}</strong> subscription for <strong>${organizationName}</strong> has been cancelled.</p>
            <p>You'll continue to have access until the end of your current billing period. After that, your organization will be moved to the Free plan.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/billing" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Manage Subscription</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">We're sorry to see you go! If you change your mind, you can reactivate your subscription anytime.</p>
          </div>
        </body>
      </html>
    `,
  }),
};

// Email helper functions
export async function sendEmailVerificationEmail(
  user: { email: string; name: string | null },
  token: string
) {
  const template = emailTemplates.verification(user.name, token);
  await sendEmail(user.email, template.subject, template.html);
}

export async function sendPasswordResetEmail(
  user: { email: string; name: string | null },
  token: string
) {
  const template = emailTemplates.passwordReset(user.name, token);
  await sendEmail(user.email, template.subject, template.html);
}

export async function sendPasswordChangedEmail(user: {
  email: string;
  name: string | null;
}) {
  const template = emailTemplates.passwordChanged(user.name);
  await sendEmail(user.email, template.subject, template.html);
}

export async function sendWelcomeEmail(
  user: { email: string; name: string | null },
  organization: { name: string }
) {
  const template = emailTemplates.welcome(user.name, organization.name);
  await sendEmail(user.email, template.subject, template.html);
}

export async function sendSubscriptionWelcomeEmail(
  user: { email: string; name: string | null },
  organization: { name: string },
  plan: { name: string }
) {
  const template = emailTemplates.subscriptionWelcome(
    user.name,
    organization.name,
    plan.name
  );
  await sendEmail(user.email, template.subject, template.html);
}

export async function sendSubscriptionRequiredEmail(
  user: { email: string; name: string | null },
  organization: { name: string }
) {
  const template = emailTemplates.subscriptionRequired(
    user.name,
    organization.name
  );
  await sendEmail(user.email, template.subject, template.html);
}

export async function sendTaskAssignmentEmail(
  assignee: { email: string; name: string | null },
  task: { title: string },
  board: { name: string }
) {
  const template = emailTemplates.taskAssignment(
    assignee.name,
    task.title,
    board.name
  );
  await sendEmail(assignee.email, template.subject, template.html);
}

export async function sendBoardInvitationEmail(
  inviter: { name: string | null },
  board: { name: string },
  inviteeEmail: string,
  token: string
) {
  const template = emailTemplates.boardInvitation(
    inviter.name,
    board.name,
    token
  );
  await sendEmail(inviteeEmail, template.subject, template.html);
}

export async function sendOrganizationInvitationEmail(
  inviter: { name: string | null },
  organization: { name: string },
  inviteeEmail: string,
  token: string
) {
  const template = emailTemplates.organizationInvitation(
    inviter.name,
    organization.name,
    token
  );
  await sendEmail(inviteeEmail, template.subject, template.html);
}

export async function sendPaymentFailedEmail(
  user: { email: string; name: string | null },
  organization: { name: string },
  subscription: { id: string }
) {
  const template = emailTemplates.paymentFailed(user.name, organization.name);
  await sendEmail(user.email, template.subject, template.html);
}

export async function sendSubscriptionCancelledEmail(
  user: { email: string; name: string | null },
  organization: { name: string },
  plan: { name: string }
) {
  const template = emailTemplates.subscriptionCancelled(
    user.name,
    organization.name,
    plan.name
  );
  await sendEmail(user.email, template.subject, template.html);
}
