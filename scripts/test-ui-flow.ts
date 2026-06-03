// Drives the deployed lumeemaison.com pages over plain HTTP and asserts
// each one renders with the expected copy. Catches missing translations,
// broken routes, banner-trigger query params, and locale parity.

const SITE = process.env.SITE_BASE_URL ?? 'http://localhost:3000';

const checks: Array<{ url: string; mustContain: string[]; mustNotContain?: string[]; label: string }> = [
  // English signup + login surfaces
  { url: '/en/account/signup', label: 'EN signup page',
    mustContain: ['Create your account', 'Forgot your password?', 'Sign in'] },
  { url: '/en/account/login', label: 'EN login page (no banner)',
    mustContain: ['Welcome back', 'Forgot your password?', 'Create one'],
    // Banner markup (`role="status"`) only renders when a query flag is set;
    // i18n message strings always ship to the client via next-intl, so we
    // check for the wrapper markup rather than the copy itself.
    mustNotContain: ['role="status"'] },
  { url: '/en/account/login?checkInbox=1', label: 'EN login w/ check-inbox banner',
    mustContain: ['confirmation email was sent'] },
  { url: '/en/account/login?confirmed=1', label: 'EN login w/ confirmed banner',
    mustContain: ['Email confirmed'] },
  { url: '/en/account/login?confirmError=expired', label: 'EN login w/ expired-link banner',
    mustContain: ['confirmation link has expired'] },
  { url: '/en/account/login?confirmError=invalid_link', label: 'EN login w/ invalid-link banner',
    mustContain: ['link is invalid'] },
  { url: '/en/account/login?passwordReset=1', label: 'EN login w/ password-reset banner',
    mustContain: ['Password updated'] },

  // English reset surfaces
  { url: '/en/account/forgot-password', label: 'EN forgot-password page',
    mustContain: ['Reset your password', 'Send code', 'Back to sign in'] },
  { url: '/en/account/reset-password', label: 'EN reset-password page',
    mustContain: ['Enter your code', '4-digit code', 'Check the code',
                  'Enter the new password', 'Confirm the password', 'Save password'] },

  // Russian surfaces — parity check
  { url: '/ru/account/signup', label: 'RU signup page',
    mustContain: ['Создайте аккаунт', 'Забыли пароль?'] },
  { url: '/ru/account/login?checkInbox=1', label: 'RU login w/ check-inbox banner',
    mustContain: ['Письмо с подтверждением отправлено'] },
  { url: '/ru/account/forgot-password', label: 'RU forgot-password page',
    mustContain: ['Сброс пароля', 'Отправить код'] },
  { url: '/ru/account/reset-password', label: 'RU reset-password page',
    mustContain: ['Введите код', '4-значный код', 'Проверить код',
                  'Введите новый пароль', 'Подтвердите пароль', 'Сохранить пароль'] },
];

async function main() {
  let failures = 0;
  for (const c of checks) {
    process.stdout.write(`\n${c.label.padEnd(45)} ${c.url}\n`);
    const res = await fetch(`${SITE}${c.url}`, { redirect: 'manual' });
    if (res.status !== 200) {
      console.log(`  ❌  HTTP ${res.status}`);
      failures += 1;
      continue;
    }
    const body = await res.text();
    let pageOk = true;
    for (const needle of c.mustContain) {
      if (!body.includes(needle)) {
        console.log(`  ❌  missing: ${needle}`);
        pageOk = false;
      }
    }
    for (const needle of c.mustNotContain ?? []) {
      if (body.includes(needle)) {
        console.log(`  ❌  unexpectedly present: ${needle}`);
        pageOk = false;
      }
    }
    if (pageOk) console.log('  OK');
    else failures += 1;
  }

  // Confirm-callback edge: invalid token_hash should redirect to login with
  // confirmError=invalid, not 500.
  process.stdout.write('\n/auth/confirm with bogus token                ');
  {
    const res = await fetch(
      `${SITE}/auth/confirm?token_hash=bogus&type=email&next=/en/account`,
      { redirect: 'manual' },
    );
    const loc = res.headers.get('location') ?? '';
    if ((res.status === 307 || res.status === 302 || res.status === 303) && loc.includes('confirmError=')) {
      console.log(`OK  ${res.status} → ${loc}`);
    } else {
      console.log(`❌  ${res.status} → ${loc}`);
      failures += 1;
    }
  }

  // /auth/confirm with missing token_hash should redirect with invalid_link.
  process.stdout.write('/auth/confirm with no token                   ');
  {
    const res = await fetch(`${SITE}/auth/confirm`, { redirect: 'manual' });
    const loc = res.headers.get('location') ?? '';
    if ((res.status === 307 || res.status === 302) && loc.includes('confirmError=invalid_link')) {
      console.log(`OK  ${res.status} → ${loc}`);
    } else {
      console.log(`❌  ${res.status} → ${loc}`);
      failures += 1;
    }
  }

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} failures`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
