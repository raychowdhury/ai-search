import { describe, it, expect } from "vitest";
import { openDatabase } from "@/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createUser, authenticate } from "@/lib/auth/users";
import { createSession, findUserBySessionToken, deleteSession } from "@/lib/auth/session";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("anything", "garbage")).toBe(false);
  });
});

describe("users and sessions", () => {
  it("creates a user, authenticates, and round-trips a session", async () => {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "Owner@Example.com ", "a-long-password");
    expect(user.email).toBe("owner@example.com");
    expect(await authenticate(db, "owner@example.com", "a-long-password")).not.toBeNull();
    expect(await authenticate(db, "owner@example.com", "nope")).toBeNull();
    expect(await authenticate(db, "missing@example.com", "nope")).toBeNull();

    const { token } = createSession(db, user.id);
    expect(findUserBySessionToken(db, token)?.id).toBe(user.id);
    expect(findUserBySessionToken(db, "0".repeat(64))).toBeNull();
    expect(findUserBySessionToken(db, undefined)).toBeNull();
    deleteSession(db, token);
    expect(findUserBySessionToken(db, token)).toBeNull();
  });
});
