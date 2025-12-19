import { PdfToMarkdown as _PdfToMarkdown } from './dist/converters/PdfToMarkdown.js';

const testText = "Conformémentà l'art";

console.log('Testing "Conformémentà"...\n');
console.log('Input:', testText);
console.log('Length:', testText.length);
console.log('\nCharacter breakdown:');
for (let i = 0; i < testText.length; i++) {
  const char = testText[i];
  const code = char.charCodeAt(0);
  const hex = code.toString(16).toUpperCase().padStart(4, '0');
  console.log(`[${i}] '${char}' (U+${hex})`);
}

// Check what the lowercase-to-uppercase pattern would match
const pattern = /([a-zà-ÿ])([A-ZÀ-Ÿ])/g;
const matches = [...testText.matchAll(pattern)];
console.log('\nLowercase-to-uppercase pattern matches:', matches.length);
matches.forEach((m, i) => {
  console.log(`  Match ${i+1}: "${m[1]}" → "${m[2]}" at position ${m.index}`);
});

// Test each pattern individually
console.log('\n--- Testing individual patterns from fixMergedWords ---\n');

let test1 = testText;
console.log('1. After punctuation spacing: ([,.:;])([A-ZÀ-Ÿa-zà-ÿ])');
test1 = test1.replace(/([,.:;])([A-ZÀ-Ÿa-zà-ÿ])/g, '$1 $2');
console.log('  ', test1);

let test2 = testText;
console.log('\n2. After quotes/parentheses spacing:');
test2 = test2.replace(/(['")\\]])([A-ZÀ-Ÿa-zà-ÿ])/g, '$1 $2');
console.log('  ', test2);

let test3 = testText;
console.log('\n3. Before quotes/parentheses:');
test3 = test3.replace(/([A-ZÀ-Ÿa-zà-ÿ])(['"(\\[])/g, '$1 $2');
console.log('  ', test3);

let test4 = testText;
console.log('\n4. After lowercase-to-uppercase split (NEW PATTERN):');
test4 = test4.replace(/([a-zà-ÿ])([A-ZÀ-ÖØ-Þ])/g, '$1 $2');
console.log('  ', test4);
