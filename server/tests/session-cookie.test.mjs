import test from "node:test";
import assert from "node:assert/strict";

import { buildClearSessionCookie, buildSetSessionCookie } from "../fni-auth.mjs";

function withNodeEnv(value, callback) {
  const previous = process.env.NODE_ENV;
  if (value === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = value;

  try {
    callback();
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

function attributes(cookie) {
  return new Set(cookie.split(";").slice(1).map((part) => part.trim()));
}

test("la cookie de acceso en produccion exige HTTPS y conserva sus protecciones", () => {
  withNodeEnv("production", () => {
    const cookie = buildSetSessionCookie("opaque;token=value");
    const flags = attributes(cookie);

    assert.ok(cookie.startsWith("fni_session=opaque%3Btoken%3Dvalue;"));
    for (const flag of ["Secure", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=604800"]) {
      assert.ok(flags.has(flag), `Falta el atributo ${flag}`);
    }
  });
});

test("el cierre de sesion en produccion elimina la misma cookie protegida", () => {
  withNodeEnv("production", () => {
    const cookie = buildClearSessionCookie();
    const flags = attributes(cookie);

    assert.ok(cookie.startsWith("fni_session=;"));
    for (const flag of ["Secure", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"]) {
      assert.ok(flags.has(flag), `Falta el atributo ${flag}`);
    }
  });
});

test("el desarrollo y las pruebas locales pueden usar HTTP sin perder HttpOnly ni SameSite", () => {
  for (const mode of ["development", "test", undefined]) {
    withNodeEnv(mode, () => {
      for (const cookie of [buildSetSessionCookie("local-token"), buildClearSessionCookie()]) {
        const flags = attributes(cookie);
        assert.equal(flags.has("Secure"), false);
        assert.ok(flags.has("HttpOnly"));
        assert.ok(flags.has("SameSite=Lax"));
      }
    });
  }
});
