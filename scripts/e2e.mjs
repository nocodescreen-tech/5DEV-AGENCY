#!/usr/bin/env node
/**
 * Test navigateur de bout en bout (Edge installé, aucun téléchargement de navigateur).
 *
 * Couvre ce que les tests unitaires ne peuvent pas voir :
 *   1. connexion en deux étapes (mot de passe + code TOTP), avec session réelle ;
 *   2. suppression protégée : clic sur la corbeille → confirmation → la ligne disparaît ;
 *   3. annulation d'une confirmation : rien n'est supprimé ;
 *   4. carte 3D : le survol produit bien une matrice de transformation ;
 *   5. transition de route active ;
 *   6. prefers-reduced-motion : aucun contenu masqué.
 *
 * Prérequis : API sur :4000, web sur :5173 (npm run dev:api / npm run dev:web).
 * Usage : npm run e2e
 */
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const API = process.env.E2E_API ?? 'http://127.0.0.1:4000';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5173';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@5dev.com';
const PASSWORD = process.env.E2E_PASSWORD ?? '5dev-Studio-2026!';

const results = [];
const record = (ok, label, detail = '') => {
  results.push({ ok, label, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(input) {
  const clean = input.replace(/=+$/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const idx = A32.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function totp(secret, at = Date.now()) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const digest = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const o = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[o] & 0x7f) << 24) | ((digest[o + 1] & 0xff) << 16) | ((digest[o + 2] & 0xff) << 8) | (digest[o + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

/* ------------------------------------------------------------- pré-vol */
const health = await fetch(`${API}/healthz`).catch(() => null);
if (!health?.ok) {
  console.error(`API injoignable sur ${API}. Lancez : npm run dev:api`);
  process.exit(2);
}
const web = await fetch(WEB).catch(() => null);
if (!web?.ok) {
  console.error(`Web injoignable sur ${WEB}. Lancez : npm run dev:web`);
  process.exit(2);
}

/* ----------------------------------------- session API (mot de passe + TOTP) */
let cookie = '';
const api = async (path, opts = {}) => {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* vide */
  }
  return { status: res.status, json };
};

const step1 = await api('/api/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
record(step1.status === 200 && step1.json?.data?.otp_required === true, 'connexion : second facteur exigé');

const secret = step1.json?.data?.secret ?? process.env.E2E_OTP_SECRET;
if (!secret) {
  console.error('Compte déjà enrôlé : fournissez E2E_OTP_SECRET, ou réinitialisez avec');
  console.error('  node apps/api/scripts/otp-reset.mjs admin@5dev.com');
  process.exit(2);
}
const step2 = await api('/api/v1/auth/login/otp', {
  method: 'POST',
  body: JSON.stringify({ challenge: step1.json.data.challenge, code: totp(secret) }),
});
record(step2.status === 200 && Boolean(cookie), 'connexion : session ouverte après le code');

const me = await api('/api/v1/auth/me');
record(me.json?.data?.user?.email === EMAIL, 'session réellement active');

/* ------------------------------------------- données jetables pour le test */
const projects = await api('/api/v1/admin/pm/projects');
const projectId = projects.json?.data?.[0]?.id;
const stamp = Date.now();
const taskTitle = `E2E jetable ${stamp}`;
const created = await api('/api/v1/admin/pm/tasks', {
  method: 'POST',
  body: JSON.stringify({ project_id: projectId, title: taskTitle, due_date: '2026-12-31' }),
});
record(created.status === 201, 'tâche de test créée', taskTitle);

/* ------------------------------------------------------------ navigateur */
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await context.addCookies([
  { name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
]);
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 120)));

/* 1. carte 3D au survol (page publique) */
await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.locator('text=Ce qu’on peut construire ensemble').scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
const card = page.locator('.card3d').first();
const box = await card.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.35);
  await page.waitForTimeout(450);
}
const transform = await card.evaluate((el) => getComputedStyle(el).transform);
record(transform.startsWith('matrix3d'), 'carte 3D inclinée au survol', transform.slice(0, 28) + '…');

/* 2. transition de route */
await page.goto(`${WEB}/services`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const anim = await page.evaluate(() => {
  const el = document.querySelector('.page-transition');
  return el ? getComputedStyle(el).animationName : 'aucune';
});
record(anim === 'page-in', 'transition de route active', anim);

/* 3. suppression avec confirmation, puis annulation */
await page.goto(`${WEB}/admin/taches`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const row = page.locator('tr', { hasText: taskTitle }).first();
record((await row.count()) > 0, 'tâche visible dans la console');

await row.locator('button[aria-label^="Supprimer"]').click();
await page.waitForTimeout(350);
const dialog = page.locator('[role=dialog]');
record(await dialog.isVisible(), 'confirmation affichée avant suppression');

await dialog.getByRole('button', { name: 'Annuler' }).click();
await page.waitForTimeout(350);
record(!(await dialog.isVisible()), 'annulation : dialogue fermé');
record((await page.locator('tr', { hasText: taskTitle }).count()) > 0, 'annulation : tâche toujours là');

/* 4. suppression réelle via l'interface */
await page.locator('tr', { hasText: taskTitle }).first().locator('button[aria-label^="Supprimer"]').click();
await page.waitForTimeout(300);
await page.locator('[role=dialog]').getByRole('button', { name: 'Supprimer' }).click();
await page.waitForTimeout(1400);
record((await page.locator('tr', { hasText: taskTitle }).count()) === 0, 'suppression effective : ligne retirée');

const stillThere = await api(`/api/v1/admin/pm/tasks`);
record(!(stillThere.json?.data ?? []).some((t) => t.title === taskTitle), 'confirmation côté serveur : tâche absente');

/* 5. prefers-reduced-motion : rien d'invisible */
const reducedCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const reducedPage = await reducedCtx.newPage();
await reducedPage.goto(`${WEB}/`, { waitUntil: 'networkidle' });
await reducedPage.waitForTimeout(900);
const hidden = await reducedPage.evaluate(
  () => [...document.querySelectorAll('.reveal')].filter((el) => Number(getComputedStyle(el).opacity) < 0.9).length,
);
record(hidden === 0, 'mode réduit : aucun contenu masqué', `${hidden} masqué(s)`);

record(pageErrors.length === 0, 'aucune erreur JavaScript', pageErrors.join(' | ') || 'aucune');

await browser.close();

/* ---------------------------------------------------------- nettoyage */
if (created.json?.data?.id) {
  await api(`/api/v1/admin/pm/tasks/${created.json.data.id}`, { method: 'DELETE' });
}

// le test a enrôlé un secret aléatoire : on le révoque pour que le prochain run
// puisse réenrôler (sauf si E2E_KEEP_OTP=1, utile pour tester la vérification seule)
if (!process.env.E2E_KEEP_OTP && step1.json?.data?.enroll) {
  try {
    execFileSync(process.execPath, ['apps/api/scripts/otp-reset.mjs', EMAIL], { stdio: 'ignore' });
    console.log('Second facteur réinitialisé après le test (E2E_KEEP_OTP=1 pour le conserver).');
  } catch {
    console.log('Réinitialisation du second facteur impossible — lancez otp-reset.mjs à la main.');
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? `ECHEC : ${failed.map((f) => f.label).join(' | ')}` : `OK : ${results.length} contrôles navigateur passés`}`);
process.exit(failed.length ? 1 : 0);
