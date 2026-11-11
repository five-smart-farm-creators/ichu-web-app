import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type TranslationNode = { readonly [key: string]: unknown };

function readTranslationKeys(fileName: string): string[] {
  // The test run starts in the project root, where public/ holds the translation files served to the app.
  const content = readFileSync(join(process.cwd(), 'public', 'i18n', fileName), 'utf8');
  return flattenKeys(JSON.parse(content) as TranslationNode).sort();
}

function flattenKeys(node: TranslationNode, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object' ? flattenKeys(value as TranslationNode, path) : [path];
  });
}

describe('translation files', () => {
  it('define the same keys in English and Spanish', () => {
    expect(readTranslationKeys('es.json')).toEqual(readTranslationKeys('en.json'));
  });
});
