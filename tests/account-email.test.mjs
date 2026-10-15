import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { admin } from "better-auth/plugins";
import { NextRequest } from "next/server.js";
import { loadSource } from "./auth-source.mjs";

const queue = [];
const email = loadSource("src/lib/account-email.ts", { "next/server": { after: job => queue.push(job) }, "node:timers/promises": { setTimeout: async () => {} } });
const options = loadSource("src/lib/auth-options.ts", { "better-auth/plugins": { admin } });
const policy = loadSource("src/lib/auth-policy.ts");
const message = { kind: "reset", name: '<img src=x onerror="alert(1)"> & Pat', email: "fixture@example.invalid", url: "https://www.apextradealliance.com/api/auth/reset-password/test-token?callbackURL=https%3A%2F%2Fwww.apextradealliance.com%2Freset-password&extra=%22" };

const verificationCallback = loadSource("src/app/verify-email/callback/route.ts", { "@/lib/auth-options": options });

test("verification callback uses the configured public origin and preserves destinations and security headers", () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, BETTER_AUTH_URL: process.env.BETTER_AUTH_URL };
  try {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_URL = policy.PUBLIC_ORIGIN + "/";
    const unsafeQuery = new URLSearchParams({ context: "https://evil.invalid", next: "//evil.invalid", callbackURL: "https://evil.invalid" });
    const cases = [
      ["", "/verify-email/success"],
      ["?context=admin", "/verify-email/success?context=admin"],
      ["?error=TOKEN_EXPIRED", "/verify-email/failure"],
      ["?error=INVALID_TOKEN&context=admin", "/verify-email/failure?context=admin"],
      ["?" + unsafeQuery, "/verify-email/success"],
      ["?error=INVALID_TOKEN&" + unsafeQuery, "/verify-email/failure"],
      ["?context=admin&next=https%3A%2F%2Fevil.invalid", "/verify-email/success?context=admin"],
    ];
    for (const requestOrigin of ["http://localhost:3000", "https://localhost:3000", "https://evil.invalid"]) {
      for (const [query, destination] of cases) {
        const request = new NextRequest(requestOrigin + "/verify-email/callback" + query, { headers: { host: "evil.invalid", "x-forwarded-host": "evil.invalid", "x-forwarded-proto": "http", forwarded: "host=evil.invalid;proto=http" } });
        const response = verificationCallback.GET(request);
        assert.equal(response.status, 307);
        assert.equal(response.headers.get("location"), policy.PUBLIC_ORIGIN + destination);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      }
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("verification callback rejects unsafe production configuration and supports local development", () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, BETTER_AUTH_URL: process.env.BETTER_AUTH_URL };
  const request = new NextRequest("https://localhost:3000/verify-email/callback?error=TOKEN_EXPIRED&context=admin");
  try {
    process.env.NODE_ENV = "production";
    for (const origin of [undefined, "", "not-a-url", "//evil.invalid", "javascript:alert(1)", "http://www.apextradealliance.com", "http://localhost:3000", "https://localhost:3000", "https://evil.invalid", "https://www.apextradealliance.com.evil.invalid", policy.PUBLIC_ORIGIN + ":444", policy.PUBLIC_ORIGIN + "/api/auth", policy.PUBLIC_ORIGIN + "?next=https://evil.invalid", policy.PUBLIC_ORIGIN + "#fragment", "https://user:password@www.apextradealliance.com"]) {
      if (origin === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = origin;
      assert.throws(() => verificationCallback.GET(request));
    }
    process.env.NODE_ENV = "development";
    for (const [configured, expected] of [[undefined, "http://localhost:3000"], ["http://localhost:3001/", "http://localhost:3001"]]) {
      if (configured === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = configured;
      const response = verificationCallback.GET(request);
      assert.equal(response.headers.get("location"), expected + "/verify-email/failure?context=admin");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("password policy, production origin and fixed verification routes", () => {
  assert.equal(policy.passwordError("a passphrase with spaces", "a passphrase with spaces"), "");
  for (const password of ["a".repeat(14), "a".repeat(129)]) assert(policy.passwordError(password, password));
  assert(policy.passwordError("a".repeat(15), "b".repeat(15)));
  assert.equal(options.configuredAuthOrigin(false), "http://localhost:3000");
  assert.equal(options.configuredAuthOrigin(true, policy.PUBLIC_ORIGIN + "/"), policy.PUBLIC_ORIGIN);
  for (const origin of [undefined, "http://www.apextradealliance.com", "https://evil.invalid", policy.PUBLIC_ORIGIN + "/api/auth", "https://user:password@www.apextradealliance.com"]) assert.throws(() => options.configuredAuthOrigin(true, origin));
  assert.equal(policy.verificationDestination("expired", "admin"), "/verify-email/failure?context=admin");
  assert.equal(policy.verificationDestination(undefined, "https://evil.invalid"), "/verify-email/success");
});

test("email templates escape text and retain exact URLs in HTML and plain text", () => {
  for (const kind of ["reset", "verification"]) {
    const template = email.accountEmailTemplate({ ...message, kind });
    assert(template.subject.includes("Apex Trade Alliance"));
    assert(!template.html.includes('<img src=x'));
    assert(template.html.includes("&lt;img"));
    assert(template.html.includes(`href="${message.url.replaceAll("&", "&amp;")}"`));
    assert(template.text.includes(message.url));
    assert(template.text.includes(kind === "reset" ? "30 minutes" : "24 hours"));
    assert(!template.html.includes("clicktracking"));
  }
});

test("Resend configuration is runtime-only; deferred delivery masks failures, retries and logs safely", async () => {
  const previous = { fetch: globalThis.fetch, key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, info: console.info, error: console.error };
  const logs = []; const requests = [];
  console.info = console.error = (...values) => logs.push(values);
  try {
    delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM;
    globalThis.fetch = async () => { throw Error("must not send"); };
    assert.equal(await email.deliverAccountEmail(message), false);
    process.env.RESEND_API_KEY = "mock-only-key"; process.env.EMAIL_FROM = "Apex Trade Alliance <no-reply@example.invalid>";
    globalThis.fetch = async (url, init) => { requests.push({ url, init }); return new Response("", { status: requests.length === 1 ? 503 : requests.length === 2 ? 429 : 200 }); };
    email.scheduleAccountEmail(message);
    assert.equal(requests.length, 0);
    await queue.shift()();
    assert.equal(requests.length, 3);
    assert.equal(new Set(requests.map(r => r.init.headers["Idempotency-Key"])).size, 1);
    assert(!requests[0].init.headers["Idempotency-Key"].includes("test-token"));
    assert.deepEqual(JSON.parse(requests[0].init.body).to, [message.email]);
    assert.equal(JSON.parse(requests[0].init.body).text, email.accountEmailTemplate(message).text);
    assert(requests.every(r => r.url === "https://api.resend.com/emails" && r.init.signal));
    let count = 0;
    globalThis.fetch = async () => { count++; return new Response("provider-secret", { status: 401 }); };
    assert.equal(await email.deliverAccountEmail(message), false); assert.equal(count, 1);
    globalThis.fetch = async () => { count++; throw Error(message.url); };
    assert.equal(await email.deliverAccountEmail(message), false); assert.equal(count, 4);
    const logged = JSON.stringify(logs);
    for (const secret of [message.url, message.email, "mock-only-key", "provider-secret", "test-token"]) assert(!logged.includes(secret));
  } finally {
    globalThis.fetch = previous.fetch; console.info = previous.info; console.error = previous.error;
    if (previous.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous.key;
    if (previous.from === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = previous.from;
  }
});

test("security pages enforce session and administrator role on the server", async () => {
  for (const [file, adminPage] of [["src/app/account/security/page.tsx", false], ["src/app/admin/(panel)/security/page.tsx", true]]) {
    for (const session of [null, { user: { name: "Fixture", emailVerified: false, role: "user" } }, { user: { emailVerified: false, role: "admin" } }]) {
      const page = loadSource(file, { "next/headers": { headers: async () => new Headers() }, "next/navigation": { redirect: path => { throw Error("redirect:" + path); } }, "@/lib/auth": { auth: { api: { getSession: async () => session } } }, "@/components/auth/account-form": { AccountForm() {} } });
      if (!session || (adminPage && session.user.role !== "admin")) await assert.rejects(page.default(), /redirect:/);
      else assert(await page.default());
    }
  }
});

function loginPageFixture(file, session, cookie = "", Form = function LoginForm() { return null; }) {
  const requestHeaders = new Headers(cookie ? { cookie } : undefined);
  let sessionChecks = 0;
  const page = loadSource(file, {
    "next/headers": { headers: async () => requestHeaders },
    "next/navigation": { redirect: destination => { throw Object.assign(new Error("Login redirect"), { destination }); } },
    "@/lib/auth": { auth: { api: { getSession: async ({ headers }) => {
      sessionChecks++;
      assert.equal(headers, requestHeaders);
      if (session instanceof Error) throw session;
      return session;
    } } } },
    "./login-form": Form,
  });
  return { page, Form, get sessionChecks() { return sessionChecks; } };
}

test("sign-in pages check sessions on the server and redirect existing buyers and administrators", async () => {
  for (const [file, adminPage] of [["src/app/login/page.tsx", false], ["src/app/admin/login/page.tsx", true]]) {
    const cases = [
      ["", null],
      ["better-auth.session_token=expired", null],
      ["better-auth.session_token=revoked", null],
      ["better-auth.session_token=buyer", { user: { id: "buyer", role: "user" } }],
      ["better-auth.session_token=admin", { user: { id: "admin", role: "admin" } }],
    ];
    for (const [cookie, session] of cases) {
      const fixture = loginPageFixture(file, session, cookie);
      assert.equal(fixture.page.dynamic, "force-dynamic");
      const result = fixture.page.default({ searchParams: Promise.resolve({}) });
      if (session) {
        const destination = adminPage && session.user.role === "admin" ? "/admin" : "/account";
        await assert.rejects(result, error => error.destination === destination);
      } else {
        const element = await result;
        assert.equal(element.type, fixture.Form);
        if (!adminPage) assert.equal(element.props.redirectTo, "/account");
      }
      assert.equal(fixture.sessionChecks, 1);
    }
    const unavailable = loginPageFixture(file, new Error("Session lookup unavailable"));
    await assert.rejects(unavailable.page.default({ searchParams: Promise.resolve({}) }), /Session lookup unavailable/);
    assert.equal(unavailable.sessionChecks, 1);
  }
});

test("buyer sign-in uses the same validated destination for existing sessions and successful form submission", async () => {
  const unsafe = [
    undefined, "", "https://evil.invalid", "https://www.apextradealliance.com/account", "//evil.invalid", "///evil.invalid", "javascript:alert(1)",
    "/\\evil.invalid", "/checkout?next=\\evil.invalid", "/\u0000evil.invalid", "/checkout?x=\n", "/\u007fevil.invalid", "/%5Cevil.invalid", "/%2Fevil.invalid", "/%0alogin", "/%",
    "/login", "/LOGIN", "/login/", "/login?next=/checkout", "/login#form", "/%6cogin", "/account/../login", "/admin/login", "/admin//login/", "/register?next=/checkout",
  ];
  const cases = [
    ...unsafe.map(next => [next, "/account"]),
    ["/", "/"],
    ["/account/orders?status=pending#latest", "/account/orders?status=pending#latest"],
    ["/checkout?source=cart#shipping", "/checkout?source=cart#shipping"],
    ["/products?search=50%25%20off", "/products?search=50%25%20off"],
    ["/orders/../checkout", "/checkout"],
    [["/checkout", "https://evil.invalid"], "/checkout"],
    [["https://evil.invalid", "/checkout"], "/account"],
  ];
  for (const [next, destination] of cases) {
    for (const session of [null, { user: { id: "buyer", role: "user" } }]) {
      const fixture = loginPageFixture("src/app/login/page.tsx", session);
      const result = fixture.page.default({ searchParams: Promise.resolve({ next }) });
      if (session) await assert.rejects(result, error => error.destination === destination);
      else assert.equal((await result).props.redirectTo, destination);
      assert.equal(fixture.sessionChecks, 1);
    }
  }
});

test("anonymous sign-in pages retain their forms, current-password inputs and reset success notices", async () => {
  for (const file of ["src/app/login/page.tsx", "src/app/admin/login/page.tsx"]) {
    const client = loadSource(file.replace("page.tsx", "login-form.tsx"), {
      "next/link": ({ children, ...props }) => createElement("a", props, children),
      "next/navigation": { useRouter: () => ({ push() {}, refresh() {} }), useSearchParams: () => new URLSearchParams("reset=success") },
      "@/lib/auth-client": { authClient: { signIn: { email: async () => ({}) } } },
    });
    const fixture = loginPageFixture(file, null, "", client.default);
    const element = await fixture.page.default({ searchParams: Promise.resolve({ reset: "success" }) });
    const markup = renderToStaticMarkup(element);
    assert(markup.includes("<form"));
    assert(markup.includes("Your password was reset. Sign in with your new password."));
    assert(markup.includes('autoComplete="email"'));
    assert(markup.includes('autoComplete="current-password"'));
    assert(!markup.includes('minLength='));
    assert(markup.includes(file.includes("/admin/") ? 'href="/admin/forgot-password"' : 'href="/forgot-password"'));
  }
});
