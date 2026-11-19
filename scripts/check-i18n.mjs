#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const localesDir = fileURLToPath(new URL("../src/i18n/locales", import.meta.url));
const reference = "zh-CN";
const others = ["en-US"];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse ${file}: ${error.message}`);
  }
}

function flatten(value, prefix = "", out = new Map()) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
}

function placeholders(value) {
  if (typeof value !== "string") {
    return [];
  }
  return [...value.matchAll(/\{\{\s*([\w.-]+)/g)].map((match) => match[1]).sort();
}

function jsonFiles(locale) {
  try {
    return readdirSync(join(localesDir, locale))
      .filter((file) => file.endsWith(".json"))
      .sort();
  } catch {
    return null;
  }
}

const issues = [];
const referenceFiles = jsonFiles(reference);

if (!referenceFiles) {
  console.error(`i18n check failed: missing locale directory "${reference}"`);
  process.exit(1);
}

if (referenceFiles.length === 0) {
  console.error(`i18n check failed: no JSON files found for "${reference}"`);
  process.exit(1);
}

let keyCount = 0;

for (const locale of others) {
  const localeFiles = jsonFiles(locale);
  if (!localeFiles) {
    issues.push(`missing locale directory "${locale}"`);
    continue;
  }

  for (const file of referenceFiles) {
    if (!localeFiles.includes(file)) {
      issues.push(`"${locale}" is missing file ${file}`);
    }
  }
  for (const file of localeFiles) {
    if (!referenceFiles.includes(file)) {
      issues.push(`"${reference}" is missing file ${file}`);
    }
  }

  for (const file of referenceFiles) {
    if (!localeFiles.includes(file)) {
      continue;
    }

    const base = flatten(readJson(join(localesDir, reference, file)));
    const translated = flatten(readJson(join(localesDir, locale, file)));
    keyCount = Math.max(keyCount, base.size);

    for (const [key, value] of base) {
      if (!translated.has(key)) {
        issues.push(`"${locale}/${file}" is missing key ${key}`);
        continue;
      }
      const translatedValue = translated.get(key);
      if (typeof value === "string" && value.trim() === "") {
        issues.push(`"${reference}/${file}" has an empty value for ${key}`);
      }
      if (typeof translatedValue === "string" && translatedValue.trim() === "") {
        issues.push(`"${locale}/${file}" has an empty value for ${key}`);
      }
      const expected = placeholders(value);
      const actual = placeholders(translatedValue);
      if (expected.join("|") !== actual.join("|")) {
        issues.push(
          `"${locale}/${file}" placeholder mismatch for ${key}: ` +
            `[${expected.join(", ")}] vs [${actual.join(", ")}]`,
        );
      }
    }

    for (const key of translated.keys()) {
      if (!base.has(key)) {
        issues.push(`"${locale}/${file}" has an extra key ${key}`);
      }
    }
  }
}

if (issues.length > 0) {
  console.error("i18n check failed:");
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

console.log(
  `i18n check passed: ${referenceFiles.length} files × ${others.length + 1} locales, ` +
    `up to ${keyCount} keys per file.`,
);
