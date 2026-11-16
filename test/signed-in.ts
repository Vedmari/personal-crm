// Who is signed in, for the `db` tests. test/setup-db.ts puts this in place
// of src/lib/current-user.ts, so the server actions work for the user the
// test chose, without a browser and a sign-in cookie.

// Two users, A and B, are made before every test (test/setup-db.ts), and the
// test is signed in as A. Rows belong to A unless a test says otherwise.
export const USER_A = "user-a";
export const USER_B = "user-b";

let signedInUserId: string | null = null;

export function signInAs(userId: string | null): void {
  signedInUserId = userId;
}

export function signedInAs(): string | null {
  return signedInUserId;
}
