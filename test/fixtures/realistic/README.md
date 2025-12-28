# Realistic Test Files

This directory contains synthetically generated test files designed to be as realistic as possible for PII detection testing. All files contain realistic Swiss/EU PII including names, addresses, phone numbers, emails, IBANs, and AVS numbers.

## File Structure

### Document Types

- **Invoice** (`invoice-{lang}.txt`, `invoice-{lang}.xlsx`) - Business invoices with customer data, payment information, IBANs, AVS numbers
- **Letter** (`letter-{lang}.txt`) - Business correspondence with salutations, contact information
- **Contract** (`contract-{lang}.txt`) - Employment contracts with personal data, salary, bank details
- **Bill/Receipt** (`bill-{lang}.txt`) - Payment receipts with customer information
- **HR Document** (`hr-{lang}.txt`) - Employee records with personal data, emergency contacts
- **Support Email** (`support-email-{lang}.txt`) - Customer support emails with contact details

### Languages

All document types are available in:
- **German (de)** - 40% of files
- **French (fr)** - 30% of files  
- **English (en)** - 30% of files

### Formats

- **TXT** - Plain text files (18 files)
- **CSV** - Contact lists with headers (3 files)
- **XLSX** - Excel spreadsheets (6 files: 3 contact lists + 3 invoices)

## PII Content

Each file contains realistic:

### Personal Information
- Swiss names (German, French, Italian)
- Titles (Herr/Frau, M./Mme, Mr./Ms.)
- Birth dates (formatted per locale)

### Contact Information
- Swiss addresses (Zürich, Geneva, Bern, Lausanne, Basel, etc.)
- Phone numbers (+41 format)
- Email addresses (realistic domains)

### Financial Information
- IBANs (Swiss format: CH93 0076...)
- AVS numbers (Swiss social security: 756.XXXX.XXXX.XX)
- Salary information (CHF amounts)
- Invoice numbers and references

### Business Information
- Company names (Swisscom, UBS, Nestlé, Roche, etc.)
- Job titles and positions
- Contract terms and dates

## Usage

### For Testing

```bash
# Generate all files
node scripts/generate-realistic-test-files.mjs

# Use in tests
import { readFileSync } from 'fs';
const invoice = readFileSync('test/fixtures/realistic/invoice-de.txt', 'utf-8');
```

### For Quality Validation

These files can be used with Story 8.6 (Integration Tests & Quality Validation) to:
- Test DenyList filtering (table headers like "Montant", "Beschreibung")
- Test ContextEnhancement (names with "Nom:", "Name:", etc.)
- Measure precision/recall per document type
- Create golden snapshots for regression testing

## Example Content

### Invoice (German)
```
RECHNUNG

Von:
Swisscom AG
Bahnhofstrasse 42
8001 Zürich

An:
Herr Hans Müller
Bahnhofstrasse 42
8001 Zürich

Rechnungsnummer: INV-123456
Rechnungsdatum: 24.12.2025

Positions:
Beratungsleistungen Q1 2025 | 40 h | CHF 150.00 | CHF 6000.00
...

Zahlungsinformationen:
IBAN: CH93 0076 2011 6238 5295 7
AVS-Nummer: 756.1234.5678.90
```

### Letter (French)
```
Cher M. Jean Dupont,

nous souhaitons vous informer que votre demande du 24.12.2025 a été traitée avec succès.

Vos coordonnées:
- Nom: M. Jean Dupont
- Adresse: Rue de Lausanne 12, 1000 Lausanne
- Téléphone: +41 21 234 56 78
- E-mail: jean.dupont@example.ch
```

## File Count

- **Total**: 27 files
  - 18 TXT files (6 types × 3 languages)
  - 3 CSV files (1 type × 3 languages)
  - 6 XLSX files (2 types × 3 languages)

## Notes

- All PII is synthetic and randomly generated
- Files are regenerated each time the script runs (content may vary)
- For consistent testing, consider committing specific generated files to version control
- Files are designed to trigger both ML-based and rule-based PII detection
- Some files contain table headers and labels that should be filtered by DenyList (Story 8.1)

## Future Enhancements

- Add DOCX generation using mammoth
- Add PDF generation with realistic formatting
- Add more document types (medical records, insurance claims, etc.)
- Add annotated versions with ground truth PII labels
- Add files with obfuscated PII (for Story 8.7 testing)


