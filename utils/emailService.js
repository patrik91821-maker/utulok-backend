const nodemailer = require('nodemailer');

// 1. Nastavenie transportu Nodemailer
// Tieto premenné MUSÍTE definovať vo vašom .env súbore a na Renderi!
const transporter = nodemailer.createTransport({
    service: 'Gmail', // Príklad: môžete zmeniť na iného poskytovateľa (napr. 'Outlook')
    auth: {
        user: process.env.EMAIL_USER,    // Váš e-mail, z ktorého sa odosiela (napr. utulokapp@gmail.com)
        pass: process.env.EMAIL_PASS,    // Vaše heslo aplikácie (App Password)
    },
});

/**
 * Funkcia na odoslanie e-mailu.
 * @param {string} toEmail - E-mail príjemcu (útulok).
 * @param {string} subject - Predmet správy.
 * @param {string} body - Telo správy (text od používateľa).
 * @param {string} replyTo - E-mail odosielateľa (používateľ), pre pole CC a Reply-To.
 */
async function sendShelterContactMessage({ toEmail, subject, body, replyTo }) {
    // 2. Telo e-mailu
    const mailOptions = {
        from: process.env.EMAIL_USER, 
        to: toEmail,
        subject: subject,
        
        // Zabezpečí, že útulok odpovedá priamo používateľovi
        replyTo: replyTo, 
        
        // DÔLEŽITÉ: Odoslanie kópie správy aj odosielateľovi (CC)
        cc: replyTo, 
        
        text: `Správa od používateľa (${replyTo}):\n\n${body}`,
        html: `
            <p>Dostali ste novú správu z aplikácie UtulokApp.</p>
            <p><strong>Od:</strong> ${replyTo}</p>
            <p><strong>Predmet:</strong> ${subject}</p>
            <hr>
            <div style="white-space: pre-wrap; padding: 10px; border: 1px solid #ccc; background-color: #f9f9f9;">
                ${body}
            </div>
            <hr>
            <p>Na odpoveď použite funkciu "Odpovedať" vo vašom e-mailovom klientovi, ktorá automaticky nasmeruje odpoveď na adresu odosielateľa: ${replyTo}.</p>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('E-mail úspešne odoslaný:', info.messageId);
        return true;
    } catch (error) {
        console.error('Chyba pri odosielaní e-mailu:', error);
        return false;
    }
}

module.exports = {
    sendShelterContactMessage,
};
