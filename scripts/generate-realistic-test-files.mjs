#!/usr/bin/env node
/**
 * Generate realistic synthetic test files for PII detection
 * Creates invoices, letters, contracts, bills, HR documents, and support emails
 * in multiple formats: TXT, DOCX, XLSX, CSV, PDF
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
// mammoth reserved for future DOCX generation
// import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const fixturesDir = path.join(rootDir, 'test', 'fixtures', 'realistic');

// Ensure directory exists
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// Realistic Swiss data
const swissData = {
  names: {
    de: [
      { first: 'Hans', last: 'Müller', title: 'Herr' },
      { first: 'Anna', last: 'Schmidt', title: 'Frau' },
      { first: 'Peter', last: 'Weber', title: 'Herr' },
      { first: 'Maria', last: 'Fischer', title: 'Frau' },
      { first: 'Thomas', last: 'Wagner', title: 'Herr' },
      { first: 'Lisa', last: 'Becker', title: 'Frau' },
      { first: 'Michael', last: 'Hoffmann', title: 'Herr' },
      { first: 'Sarah', last: 'Schäfer', title: 'Frau' },
    ],
    fr: [
      { first: 'Jean', last: 'Dupont', title: 'M.' },
      { first: 'Marie', last: 'Martin', title: 'Mme' },
      { first: 'Pierre', last: 'Bernard', title: 'M.' },
      { first: 'Sophie', last: 'Dubois', title: 'Mme' },
      { first: 'Luc', last: 'Moreau', title: 'M.' },
      { first: 'Julie', last: 'Laurent', title: 'Mme' },
      { first: 'Antoine', last: 'Simon', title: 'M.' },
      { first: 'Camille', last: 'Michel', title: 'Mme' },
    ],
    en: [
      { first: 'John', last: 'Smith', title: 'Mr.' },
      { first: 'Emma', last: 'Johnson', title: 'Ms.' },
      { first: 'David', last: 'Williams', title: 'Mr.' },
      { first: 'Olivia', last: 'Brown', title: 'Ms.' },
    ],
  },
  companies: [
    { name: 'Swisscom AG', city: 'Bern' },
    { name: 'UBS Group AG', city: 'Zürich' },
    { name: 'Nestlé SA', city: 'Vevey' },
    { name: 'Roche Holding AG', city: 'Basel' },
    { name: 'Credit Suisse Group AG', city: 'Zürich' },
    { name: 'Novartis AG', city: 'Basel' },
    { name: 'Zurich Insurance Group', city: 'Zürich' },
    { name: 'ABB Ltd', city: 'Zürich' },
  ],
  addresses: {
    ch: [
      { street: 'Bahnhofstrasse', number: '42', postal: '8001', city: 'Zürich' },
      { street: 'Rue du Rhône', number: '14', postal: '1204', city: 'Genève' },
      { street: 'Spitalgasse', number: '8', postal: '3011', city: 'Bern' },
      { street: 'Rue de Lausanne', number: '12', postal: '1000', city: 'Lausanne' },
      { street: 'Marktgasse', number: '5', postal: '4001', city: 'Basel' },
      { street: 'Hauptstrasse', number: '23', postal: '9000', city: 'St. Gallen' },
      { street: 'Avenue de la Gare', number: '7', postal: '1950', city: 'Sion' },
      { street: 'Via Nassa', number: '19', postal: '6900', city: 'Lugano' },
    ],
  },
  ibans: [
    'CH93 0076 2011 6238 5295 7',
    'CH56 0483 5012 3456 7800 9',
    'CH44 3199 9123 4567 8901 2',
    'CH36 0880 8001 2345 6789 0',
    'CH65 0023 0230 1234 5678 9',
  ],
  avs: [
    '756.1234.5678.90',
    '756.2345.6789.01',
    '756.3456.7890.12',
    '756.4567.8901.23',
    '756.5678.9012.34',
  ],
  phones: [
    '+41 44 123 45 67',
    '+41 21 234 56 78',
    '+41 31 345 67 89',
    '+41 22 456 78 90',
    '+41 79 123 45 67',
    '+41 78 234 56 78',
  ],
  emails: [
    'hans.mueller@example.ch',
    'anna.schmidt@swisscom.ch',
    'jean.dupont@ubs.com',
    'marie.martin@nestle.com',
    'peter.weber@roche.com',
  ],
};

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate invoice content
function generateInvoice(lang = 'de') {
  const name = getRandom(swissData.names[lang] || swissData.names.de);
  const company = getRandom(swissData.companies);
  const address = getRandom(swissData.addresses.ch);
  const iban = getRandom(swissData.ibans);
  const phone = getRandom(swissData.phones);
  const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}@${company.name.toLowerCase().replace(/\s+/g, '')}.ch`;
  const avs = getRandom(swissData.avs);
  const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
  const date = new Date().toLocaleDateString(lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : 'en-GB');
  
  const templates = {
    de: {
      title: 'RECHNUNG',
      from: `Von:\n${company.name}\n${address.street} ${address.number}\n${address.postal} ${address.city}\n\nTel: ${phone}\nEmail: ${email}`,
      to: `An:\n${name.title} ${name.first} ${name.last}\n${address.street} ${address.number}\n${address.postal} ${address.city}`,
      invoice: `Rechnungsnummer: ${invoiceNo}\nRechnungsdatum: ${date}\nFälligkeitsdatum: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('de-CH')}`,
      items: [
        { desc: 'Beratungsleistungen Q1 2025', qty: 40, price: 150 },
        { desc: 'Entwicklung Software-Modul', qty: 20, price: 200 },
        { desc: 'Projektmanagement', qty: 10, price: 180 },
      ],
      payment: `Zahlungsinformationen:\nIBAN: ${iban}\nReferenz: ${invoiceNo}\n\nAVS-Nummer: ${avs}`,
      footer: 'Vielen Dank für Ihr Vertrauen!',
    },
    fr: {
      title: 'FACTURE',
      from: `De:\n${company.name}\n${address.street} ${address.number}\n${address.postal} ${address.city}\n\nTél: ${phone}\nEmail: ${email}`,
      to: `À:\n${name.title} ${name.first} ${name.last}\n${address.street} ${address.number}\n${address.postal} ${address.city}`,
      invoice: `Numéro de facture: ${invoiceNo}\nDate de facture: ${date}\nDate d'échéance: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('fr-CH')}`,
      items: [
        { desc: 'Services de conseil Q1 2025', qty: 40, price: 150 },
        { desc: 'Développement module logiciel', qty: 20, price: 200 },
        { desc: 'Gestion de projet', qty: 10, price: 180 },
      ],
      payment: `Informations de paiement:\nIBAN: ${iban}\nRéférence: ${invoiceNo}\n\nNuméro AVS: ${avs}`,
      footer: 'Merci de votre confiance!',
    },
    en: {
      title: 'INVOICE',
      from: `From:\n${company.name}\n${address.street} ${address.number}\n${address.postal} ${address.city}\n\nPhone: ${phone}\nEmail: ${email}`,
      to: `To:\n${name.title} ${name.first} ${name.last}\n${address.street} ${address.number}\n${address.postal} ${address.city}`,
      invoice: `Invoice Number: ${invoiceNo}\nInvoice Date: ${date}\nDue Date: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('en-GB')}`,
      items: [
        { desc: 'Consulting Services Q1 2025', qty: 40, price: 150 },
        { desc: 'Software Module Development', qty: 20, price: 200 },
        { desc: 'Project Management', qty: 10, price: 180 },
      ],
      payment: `Payment Information:\nIBAN: ${iban}\nReference: ${invoiceNo}\n\nAVS Number: ${avs}`,
      footer: 'Thank you for your trust!',
    },
  };
  
  const t = templates[lang] || templates.de;
  let subtotal = 0;
  const itemsText = t.items.map(item => {
    const total = item.qty * item.price;
    subtotal += total;
    return `${item.desc} | ${item.qty} h | CHF ${item.price.toFixed(2)} | CHF ${total.toFixed(2)}`;
  }).join('\n');
  
  const vat = subtotal * 0.077;
  const total = subtotal + vat;
  
  return `${t.title}

${t.from}

${t.to}

${t.invoice}

---
Positions:
${itemsText}

---
Zwischensumme: CHF ${subtotal.toFixed(2)}
MwSt (7.7%): CHF ${vat.toFixed(2)}
Total: CHF ${total.toFixed(2)}

${t.payment}

${t.footer}`;
}

// Generate letter content
function generateLetter(lang = 'de') {
  const name = getRandom(swissData.names[lang] || swissData.names.de);
  const company = getRandom(swissData.companies);
  const address = getRandom(swissData.addresses.ch);
  const phone = getRandom(swissData.phones);
  const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}@example.ch`;
  const date = new Date().toLocaleDateString(lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : 'en-GB');
  
  const templates = {
    de: {
      salutation: `Sehr geehrte/r ${name.title} ${name.last},`,
      body: `wir möchten Ihnen mitteilen, dass Ihre Anfrage vom ${date} erfolgreich bearbeitet wurde.

Ihre Kontaktdaten:
- Name: ${name.title} ${name.first} ${name.last}
- Adresse: ${address.street} ${address.number}, ${address.postal} ${address.city}
- Telefon: ${phone}
- E-Mail: ${email}

Falls Sie weitere Fragen haben, stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüssen,
${company.name}`,
      closing: 'Ihr Team',
    },
    fr: {
      salutation: `Cher/Chère ${name.title} ${name.last},`,
      body: `nous souhaitons vous informer que votre demande du ${date} a été traitée avec succès.

Vos coordonnées:
- Nom: ${name.title} ${name.first} ${name.last}
- Adresse: ${address.street} ${address.number}, ${address.postal} ${address.city}
- Téléphone: ${phone}
- E-mail: ${email}

Si vous avez d'autres questions, nous sommes à votre disposition.

Cordialement,
${company.name}`,
      closing: 'Votre équipe',
    },
    en: {
      salutation: `Dear ${name.title} ${name.last},`,
      body: `we would like to inform you that your request from ${date} has been successfully processed.

Your contact details:
- Name: ${name.title} ${name.first} ${name.last}
- Address: ${address.street} ${address.number}, ${address.postal} ${address.city}
- Phone: ${phone}
- Email: ${email}

If you have any further questions, we are happy to help.

Best regards,
${company.name}`,
      closing: 'Your Team',
    },
  };
  
  const t = templates[lang] || templates.de;
  
  return `${t.salutation}

${t.body}

${t.closing}
${date}`;
}

// Generate contract content
function generateContract(lang = 'de') {
  const name = getRandom(swissData.names[lang] || swissData.names.de);
  const company = getRandom(swissData.companies);
  const address = getRandom(swissData.addresses.ch);
  const iban = getRandom(swissData.ibans);
  const phone = getRandom(swissData.phones);
  const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}@example.ch`;
  const avs = getRandom(swissData.avs);
  const date = new Date().toLocaleDateString(lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : 'en-GB');
  
  const templates = {
    de: {
      title: 'ARBEITSVERTRAG',
      parties: `Zwischen

${company.name}
${address.street} ${address.number}
${address.postal} ${address.city}

und

${name.title} ${name.first} ${name.last}
${address.street} ${address.number}
${address.postal} ${address.city}
Geburtsdatum: 15. März 1985
AVS-Nummer: ${avs}`,
      terms: `wird folgender Arbeitsvertrag geschlossen:

1. Position: Senior Software Engineer
2. Startdatum: ${date}
3. Gehalt: CHF 120'000 pro Jahr
4. Arbeitszeit: 100% (42 Stunden pro Woche)

Kontaktdaten:
- Telefon: ${phone}
- E-Mail: ${email}
- IBAN: ${iban}

Dieser Vertrag unterliegt dem schweizerischen Arbeitsrecht.`,
      signature: 'Unterschriften:',
    },
    fr: {
      title: 'CONTRAT DE TRAVAIL',
      parties: `Entre

${company.name}
${address.street} ${address.number}
${address.postal} ${address.city}

et

${name.title} ${name.first} ${name.last}
${address.street} ${address.number}
${address.postal} ${address.city}
Date de naissance: 15 mars 1985
Numéro AVS: ${avs}`,
      terms: `le contrat de travail suivant est conclu:

1. Poste: Ingénieur logiciel senior
2. Date de début: ${date}
3. Salaire: CHF 120'000 par an
4. Temps de travail: 100% (42 heures par semaine)

Coordonnées:
- Téléphone: ${phone}
- E-mail: ${email}
- IBAN: ${iban}

Ce contrat est régi par le droit du travail suisse.`,
      signature: 'Signatures:',
    },
    en: {
      title: 'EMPLOYMENT CONTRACT',
      parties: `Between

${company.name}
${address.street} ${address.number}
${address.postal} ${address.city}

and

${name.title} ${name.first} ${name.last}
${address.street} ${address.number}
${address.postal} ${address.city}
Date of birth: 15 March 1985
AVS Number: ${avs}`,
      terms: `the following employment contract is concluded:

1. Position: Senior Software Engineer
2. Start date: ${date}
3. Salary: CHF 120,000 per year
4. Working time: 100% (42 hours per week)

Contact details:
- Phone: ${phone}
- Email: ${email}
- IBAN: ${iban}

This contract is governed by Swiss labor law.`,
      signature: 'Signatures:',
    },
  };
  
  const t = templates[lang] || templates.de;
  
  return `${t.title}

${t.parties}

${t.terms}

${t.signature}

_________________          _________________
${company.name}            ${name.title} ${name.last}
${date}`;
}

// Generate bill/receipt content
function generateBill(lang = 'de') {
  const name = getRandom(swissData.names[lang] || swissData.names.de);
  const address = getRandom(swissData.addresses.ch);
  const phone = getRandom(swissData.phones);
  const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}@example.ch`;
  const date = new Date().toLocaleDateString(lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : 'en-GB');
  
  const templates = {
    de: {
      title: 'QUITTUNG',
      customer: `Kunde: ${name.title} ${name.first} ${name.last}
Adresse: ${address.street} ${address.number}, ${address.postal} ${address.city}
Telefon: ${phone}
E-Mail: ${email}`,
      items: [
        { desc: 'Produkt A', price: 45.90 },
        { desc: 'Service B', price: 120.00 },
        { desc: 'Beratung', price: 85.50 },
      ],
      footer: `Bezahlt am: ${date}
Vielen Dank für Ihren Einkauf!`,
    },
    fr: {
      title: 'REÇU',
      customer: `Client: ${name.title} ${name.first} ${name.last}
Adresse: ${address.street} ${address.number}, ${address.postal} ${address.city}
Téléphone: ${phone}
E-mail: ${email}`,
      items: [
        { desc: 'Produit A', price: 45.90 },
        { desc: 'Service B', price: 120.00 },
        { desc: 'Conseil', price: 85.50 },
      ],
      footer: `Payé le: ${date}
Merci pour votre achat!`,
    },
    en: {
      title: 'RECEIPT',
      customer: `Customer: ${name.title} ${name.first} ${name.last}
Address: ${address.street} ${address.number}, ${address.postal} ${address.city}
Phone: ${phone}
Email: ${email}`,
      items: [
        { desc: 'Product A', price: 45.90 },
        { desc: 'Service B', price: 120.00 },
        { desc: 'Consultation', price: 85.50 },
      ],
      footer: `Paid on: ${date}
Thank you for your purchase!`,
    },
  };
  
  const t = templates[lang] || templates.de;
  const total = t.items.reduce((sum, item) => sum + item.price, 0);
  const itemsText = t.items.map(item => 
    `${item.desc.padEnd(30)} CHF ${item.price.toFixed(2)}`,
  ).join('\n');
  
  return `${t.title}

${t.customer}

---
${itemsText}
---
Total: CHF ${total.toFixed(2)}

${t.footer}`;
}

// Generate HR document content
function generateHRDocument(lang = 'de') {
  const name = getRandom(swissData.names[lang] || swissData.names.de);
  const company = getRandom(swissData.companies);
  const address = getRandom(swissData.addresses.ch);
  const phone = getRandom(swissData.phones);
  const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}@${company.name.toLowerCase().replace(/\s+/g, '')}.ch`;
  const avs = getRandom(swissData.avs);
  const iban = getRandom(swissData.ibans);
  const date = new Date().toLocaleDateString(lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : 'en-GB');
  
  const templates = {
    de: {
      title: 'MITARBEITERDATEN',
      info: `Personalien:
Name: ${name.title} ${name.first} ${name.last}
Geburtsdatum: 15. März 1985
AVS-Nummer: ${avs}

Kontaktdaten:
Adresse: ${address.street} ${address.number}, ${address.postal} ${address.city}
Telefon: ${phone}
E-Mail: ${email}

Arbeitsverhältnis:
Firma: ${company.name}
Position: Senior Software Engineer
Eintrittsdatum: ${date}
Gehalt: CHF 120'000 pro Jahr

Bankverbindung:
IBAN: ${iban}

Notfallkontakt:
Name: ${name.first === 'Hans' ? 'Anna' : 'Hans'} ${name.last}
Telefon: ${phone.replace(/(\d{2})\s(\d{2})/, '$1 $2').replace(/(\d{3})\s(\d{2})/, '$1 $2')}`,
      footer: 'Diese Daten sind vertraulich und unterliegen dem Datenschutzgesetz.',
    },
    fr: {
      title: 'DONNÉES EMPLOYÉ',
      info: `Données personnelles:
Nom: ${name.title} ${name.first} ${name.last}
Date de naissance: 15 mars 1985
Numéro AVS: ${avs}

Coordonnées:
Adresse: ${address.street} ${address.number}, ${address.postal} ${address.city}
Téléphone: ${phone}
E-mail: ${email}

Relation de travail:
Entreprise: ${company.name}
Poste: Ingénieur logiciel senior
Date d'entrée: ${date}
Salaire: CHF 120'000 par an

Coordonnées bancaires:
IBAN: ${iban}

Contact d'urgence:
Nom: ${name.first === 'Jean' ? 'Marie' : 'Jean'} ${name.last}
Téléphone: ${phone.replace(/(\d{2})\s(\d{2})/, '$1 $2').replace(/(\d{3})\s(\d{2})/, '$1 $2')}`,
      footer: 'Ces données sont confidentielles et soumises à la loi sur la protection des données.',
    },
    en: {
      title: 'EMPLOYEE DATA',
      info: `Personal Information:
Name: ${name.title} ${name.first} ${name.last}
Date of birth: 15 March 1985
AVS Number: ${avs}

Contact Details:
Address: ${address.street} ${address.number}, ${address.postal} ${address.city}
Phone: ${phone}
Email: ${email}

Employment:
Company: ${company.name}
Position: Senior Software Engineer
Start date: ${date}
Salary: CHF 120,000 per year

Bank Details:
IBAN: ${iban}

Emergency Contact:
Name: ${name.first === 'John' ? 'Emma' : 'John'} ${name.last}
Phone: ${phone.replace(/(\d{2})\s(\d{2})/, '$1 $2').replace(/(\d{3})\s(\d{2})/, '$1 $2')}`,
      footer: 'This data is confidential and subject to data protection law.',
    },
  };
  
  const t = templates[lang] || templates.de;
  
  return `${t.title}

${t.info}

${t.footer}`;
}

// Generate support email content
function generateSupportEmail(lang = 'de') {
  const name = getRandom(swissData.names[lang] || swissData.names.de);
  const company = getRandom(swissData.companies);
  const address = getRandom(swissData.addresses.ch);
  const phone = getRandom(swissData.phones);
  const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}@example.ch`;
  const date = new Date().toLocaleString(lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : 'en-GB');
  
  const templates = {
    de: {
      subject: 'Anfrage bezüglich Ihrer Dienstleistungen',
      from: `Von: ${name.title} ${name.first} ${name.last} <${email}>`,
      to: `An: support@${company.name.toLowerCase().replace(/\s+/g, '')}.ch`,
      date: `Datum: ${date}`,
      body: `Sehr geehrte Damen und Herren,

ich wende mich an Sie bezüglich einer Frage zu Ihren Dienstleistungen.

Meine Kontaktdaten:
- Name: ${name.title} ${name.first} ${name.last}
- Adresse: ${address.street} ${address.number}, ${address.postal} ${address.city}
- Telefon: ${phone}
- E-Mail: ${email}

Können Sie mir bitte weitere Informationen zukommen lassen?

Vielen Dank im Voraus.

Mit freundlichen Grüssen,
${name.title} ${name.last}`,
    },
    fr: {
      subject: 'Demande concernant vos services',
      from: `De: ${name.title} ${name.first} ${name.last} <${email}>`,
      to: `À: support@${company.name.toLowerCase().replace(/\s+/g, '')}.ch`,
      date: `Date: ${date}`,
      body: `Madame, Monsieur,

je me permets de vous contacter concernant une question sur vos services.

Mes coordonnées:
- Nom: ${name.title} ${name.first} ${name.last}
- Adresse: ${address.street} ${address.number}, ${address.postal} ${address.city}
- Téléphone: ${phone}
- E-mail: ${email}

Pourriez-vous me fournir de plus amples informations?

Merci d'avance.

Cordialement,
${name.title} ${name.last}`,
    },
    en: {
      subject: 'Inquiry regarding your services',
      from: `From: ${name.title} ${name.first} ${name.last} <${email}>`,
      to: `To: support@${company.name.toLowerCase().replace(/\s+/g, '')}.ch`,
      date: `Date: ${date}`,
      body: `Dear Sir or Madam,

I am contacting you regarding a question about your services.

My contact details:
- Name: ${name.title} ${name.first} ${name.last}
- Address: ${address.street} ${address.number}, ${address.postal} ${address.city}
- Phone: ${phone}
- Email: ${email}

Could you please provide me with further information?

Thank you in advance.

Best regards,
${name.title} ${name.last}`,
    },
  };
  
  const t = templates[lang] || templates.de;
  
  return `${t.subject}

${t.from}
${t.to}
${t.date}

${t.body}`;
}

// Generate CSV content
function generateCSV(lang = 'de') {
  const names = swissData.names[lang] || swissData.names.de;
  const addresses = swissData.addresses.ch;
  const phones = swissData.phones;
  
  const headers = lang === 'de' 
    ? ['Name', 'Adresse', 'Telefon', 'E-Mail', 'IBAN', 'AVS-Nummer']
    : lang === 'fr'
      ? ['Nom', 'Adresse', 'Téléphone', 'E-mail', 'IBAN', 'Numéro AVS']
      : ['Name', 'Address', 'Phone', 'Email', 'IBAN', 'AVS Number'];
  
  const rows = [];
  for (let i = 0; i < 10; i++) {
    const name = getRandom(names);
    const address = getRandom(addresses);
    const phone = getRandom(phones);
    const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}@example.ch`;
    const iban = getRandom(swissData.ibans);
    const avs = getRandom(swissData.avs);
    
    rows.push([
      `${name.title} ${name.first} ${name.last}`,
      `${address.street} ${address.number}, ${address.postal} ${address.city}`,
      phone,
      email,
      iban,
      avs,
    ]);
  }
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Main generation function
async function generateAllFiles() {
  console.log('Generating realistic test files...');
  
  const documentTypes = ['invoice', 'letter', 'contract', 'bill', 'hr', 'support-email'];
  const languages = ['de', 'fr', 'en'];
  // formats reserved for future multi-format generation
  // const formats = ['txt', 'csv'];
  
  // Generate TXT files
  for (const docType of documentTypes) {
    for (const lang of languages) {
      let content;
      switch (docType) {
        case 'invoice':
          content = generateInvoice(lang);
          break;
        case 'letter':
          content = generateLetter(lang);
          break;
        case 'contract':
          content = generateContract(lang);
          break;
        case 'bill':
          content = generateBill(lang);
          break;
        case 'hr':
          content = generateHRDocument(lang);
          break;
        case 'support-email':
          content = generateSupportEmail(lang);
          break;
      }
      
      const filename = `${docType}-${lang}.txt`;
      fs.writeFileSync(path.join(fixturesDir, filename), content, 'utf-8');
      console.log(`✓ Created ${filename}`);
    }
  }
  
  // Generate CSV files
  for (const lang of languages) {
    const content = generateCSV(lang);
    const filename = `contacts-${lang}.csv`;
    fs.writeFileSync(path.join(fixturesDir, filename), content, 'utf-8');
    console.log(`✓ Created ${filename}`);
  }
  
  // Generate Excel files
  for (const lang of languages) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contacts');
    
    const headers = lang === 'de' 
      ? ['Name', 'Adresse', 'Telefon', 'E-Mail', 'IBAN', 'AVS-Nummer']
      : lang === 'fr'
        ? ['Nom', 'Adresse', 'Téléphone', 'E-mail', 'IBAN', 'Numéro AVS']
        : ['Name', 'Address', 'Phone', 'Email', 'IBAN', 'AVS Number'];
    
    worksheet.addRow(headers);
    
    for (let i = 0; i < 10; i++) {
      const name = getRandom(swissData.names[lang] || swissData.names.de);
      const address = getRandom(swissData.addresses.ch);
      const phone = getRandom(swissData.phones);
      const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}@example.ch`;
      const iban = getRandom(swissData.ibans);
      const avs = getRandom(swissData.avs);
      
      worksheet.addRow([
        `${name.title} ${name.first} ${name.last}`,
        `${address.street} ${address.number}, ${address.postal} ${address.city}`,
        phone,
        email,
        iban,
        avs,
      ]);
    }
    
    const filename = `contacts-${lang}.xlsx`;
    await workbook.xlsx.writeFile(path.join(fixturesDir, filename));
    console.log(`✓ Created ${filename}`);
  }
  
  // Generate invoice Excel files
  for (const lang of languages) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoice');
    
    const name = getRandom(swissData.names[lang] || swissData.names.de);
    const company = getRandom(swissData.companies);
    const address = getRandom(swissData.addresses.ch);
    const iban = getRandom(swissData.ibans);
    const avs = getRandom(swissData.avs);
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
    
    // Header
    worksheet.addRow([lang === 'de' ? 'RECHNUNG' : lang === 'fr' ? 'FACTURE' : 'INVOICE']);
    worksheet.addRow([]);
    worksheet.addRow([lang === 'de' ? 'Von:' : lang === 'fr' ? 'De:' : 'From:', company.name]);
    worksheet.addRow([address.street, address.number]);
    worksheet.addRow([address.postal, address.city]);
    worksheet.addRow([]);
    worksheet.addRow([lang === 'de' ? 'An:' : lang === 'fr' ? 'À:' : 'To:', `${name.title} ${name.first} ${name.last}`]);
    worksheet.addRow([]);
    worksheet.addRow([lang === 'de' ? 'Rechnungsnummer:' : lang === 'fr' ? 'Numéro de facture:' : 'Invoice Number:', invoiceNo]);
    worksheet.addRow([]);
    
    // Items
    const itemHeaders = lang === 'de'
      ? ['Beschreibung', 'Menge', 'Preis', 'Total']
      : lang === 'fr'
        ? ['Description', 'Quantité', 'Prix', 'Total']
        : ['Description', 'Quantity', 'Price', 'Total'];
    worksheet.addRow(itemHeaders);
    
    const items = [
      { desc: lang === 'de' ? 'Beratung' : lang === 'fr' ? 'Conseil' : 'Consulting', qty: 10, price: 150 },
      { desc: lang === 'de' ? 'Entwicklung' : lang === 'fr' ? 'Développement' : 'Development', qty: 20, price: 200 },
    ];
    
    items.forEach(item => {
      worksheet.addRow([item.desc, item.qty, item.price, item.qty * item.price]);
    });
    
    worksheet.addRow([]);
    const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    worksheet.addRow(['Total:', '', '', total]);
    worksheet.addRow([]);
    worksheet.addRow(['IBAN:', iban]);
    worksheet.addRow([lang === 'de' ? 'AVS-Nummer:' : lang === 'fr' ? 'Numéro AVS:' : 'AVS Number:', avs]);
    
    const filename = `invoice-${lang}.xlsx`;
    await workbook.xlsx.writeFile(path.join(fixturesDir, filename));
    console.log(`✓ Created ${filename}`);
  }
  
  console.log(`\n✅ All test files generated in ${fixturesDir}`);
  console.log('\nGenerated files:');
  console.log(`- ${documentTypes.length * languages.length} TXT files (${documentTypes.join(', ')} × ${languages.join(', ')})`);
  console.log(`- ${languages.length} CSV files`);
  console.log(`- ${languages.length * 2} XLSX files (contacts + invoices)`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllFiles().catch(console.error);
}

export { generateAllFiles, generateInvoice, generateLetter, generateContract, generateBill, generateHRDocument, generateSupportEmail, generateCSV };


