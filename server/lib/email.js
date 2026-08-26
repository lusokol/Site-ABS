const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const FROM = `ABS91 <${process.env.SMTP_USER}>`;
const BASE_URL = process.env.BASE_URL;

async function sendMagicLink(email, token) {
    const link = `${BASE_URL}/app/set-password.html?token=${token}`;
    await transporter.sendMail({
        from: FROM,
        to: email,
        subject: 'ABS91 — Créez votre mot de passe',
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: auto;">
                <h2 style="color: #005564;">Bienvenue à l'ABS91 !</h2>
                <p>Un compte a été créé pour vous sur l'espace membres de l'Amicale Badminton Spinolienne.</p>
                <p>Cliquez sur le bouton ci-dessous pour définir votre mot de passe :</p>
                <p style="text-align: center; margin: 2em 0;">
                    <a href="${link}" style="background: #005564; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Définir mon mot de passe</a>
                </p>
                <p style="color: #666; font-size: 0.875em;">Ce lien expire dans 48 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
            </div>
        `,
    });
}

async function sendBookingConfirmation(email, { slotDate, slotTime, location, paymentMethod }) {
    const paymentText = paymentMethod === 'card'
        ? 'Paiement par carte effectué'
        : 'Paiement en espèces à régler lors du cours';

    await transporter.sendMail({
        from: FROM,
        to: email,
        subject: 'ABS91 — Confirmation de réservation',
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: auto;">
                <h2 style="color: #005564;">Réservation confirmée !</h2>
                <p>Votre cours particulier est réservé :</p>
                <ul>
                    <li><strong>Date :</strong> ${slotDate}</li>
                    <li><strong>Heure :</strong> ${slotTime}</li>
                    <li><strong>Lieu :</strong> ${location}</li>
                    <li><strong>Paiement :</strong> ${paymentText}</li>
                </ul>
                <p>À bientôt sur les terrains !</p>
                <p style="color: #666; font-size: 0.875em;">— L'équipe ABS91</p>
            </div>
        `,
    });
}

async function sendContactMessage({ name, email, phone, subject, message }) {
    await transporter.sendMail({
        from: FROM,
        to: process.env.SMTP_USER,
        replyTo: email,
        subject: `ABS91 — Contact : ${subject}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                <h2 style="color: #005564;">Nouveau message depuis le site</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0; font-weight: bold; width: 100px;">Nom</td><td style="padding: 8px 0;">${name}</td></tr>
                    <tr><td style="padding: 8px 0; font-weight: bold;">Email</td><td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
                    ${phone ? `<tr><td style="padding: 8px 0; font-weight: bold;">Téléphone</td><td style="padding: 8px 0;">${phone}</td></tr>` : ''}
                    <tr><td style="padding: 8px 0; font-weight: bold;">Sujet</td><td style="padding: 8px 0;">${subject}</td></tr>
                </table>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 1em 0;">
                <p style="white-space: pre-wrap;">${message}</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 1em 0;">
                <p style="color: #666; font-size: 0.875em;">Vous pouvez répondre directement à cet email pour contacter ${name}.</p>
            </div>
        `,
    });
}

async function sendBookingCancellation(email, { slotDate, slotTime, location, hasCredit, creditAmount, cancelledByAdmin }) {
    const reason = cancelledByAdmin
        ? 'Le créneau a été annulé par l\'administrateur.'
        : 'Vous avez annulé votre réservation.';
    const creditText = hasCredit
        ? `<p style="background:#e8f8f5;padding:12px;border-radius:6px;"><strong>Un avoir de ${(creditAmount / 100).toFixed(2).replace('.', ',')} € a été enregistré</strong> sur votre compte. Il sera déduit de votre prochaine réservation.</p>`
        : '';

    await transporter.sendMail({
        from: FROM,
        to: email,
        subject: 'ABS91 — Réservation annulée',
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: auto;">
                <h2 style="color: #005564;">Réservation annulée</h2>
                <p>${reason}</p>
                <ul>
                    <li><strong>Date :</strong> ${slotDate}</li>
                    <li><strong>Heure :</strong> ${slotTime}</li>
                    <li><strong>Lieu :</strong> ${location}</li>
                </ul>
                ${creditText}
                <p style="color: #666; font-size: 0.875em;">— L'équipe ABS91</p>
            </div>
        `,
    });
}

async function sendPaymentConfirmation(email, { slotDate, slotTime, location, amount }) {
    await transporter.sendMail({
        from: FROM,
        to: email,
        subject: 'ABS91 — Paiement confirmé',
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: auto;">
                <h2 style="color: #005564;">Paiement confirmé !</h2>
                <p>Votre paiement de <strong>${(amount / 100).toFixed(2).replace('.', ',')} €</strong> a bien été reçu.</p>
                <ul>
                    <li><strong>Date :</strong> ${slotDate}</li>
                    <li><strong>Heure :</strong> ${slotTime}</li>
                    <li><strong>Lieu :</strong> ${location}</li>
                </ul>
                <p>À bientôt sur les terrains !</p>
                <p style="color: #666; font-size: 0.875em;">— L'équipe ABS91</p>
            </div>
        `,
    });
}

module.exports = { sendMagicLink, sendBookingConfirmation, sendBookingCancellation, sendPaymentConfirmation, sendContactMessage };
