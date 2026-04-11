const USERNAME_MATCHING_MODE = "case-insensitive";

const AUTH_USERS = [
  {
    user_id: "player-1",
    username: "Adminplayer",
    password: "1234",
    role: "PLAYER",
  },
  {
    user_id: "player-2",
    username: "Adminplayer2",
    password: "1234",
    role: "PLAYER",
  },
  {
    user_id: "player-3",
    username: "Adminplayer3",
    password: "1234",
    role: "PLAYER",
  },
  {
    user_id: "gm-1",
    username: "Admingm",
    password: "1234",
    role: "GM",
  },
  {
    user_id: "helper-1",
    username: "Admingmhelper",
    password: "1234",
    role: "HELPER",
  },
];

function normalizeUsername(username) {
  if (typeof username !== "string") {
    return "";
  }

  if (USERNAME_MATCHING_MODE === "case-insensitive") {
    return username.trim().toLowerCase();
  }

  return username.trim();
}

export function findAuthUserByUsername(username) {
  const normalizedUsername = normalizeUsername(username);

  if (normalizedUsername.length === 0) {
    return null;
  }

  return AUTH_USERS.find((user) => normalizeUsername(user.username) === normalizedUsername) ?? null;
}


export function findUserByUsername(username) {
  return findAuthUserByUsername(username);
}

export function validatePassword(user, password) {
  if (!user || typeof user.password !== "string") {
    return false;
  }

  return user.password === password;
}

export function verifyCredentials(username, password) {
  const user = findAuthUserByUsername(username);

  if (!user || user.password !== password) {
    return null;
  }

  return {
    user_id: user.user_id,
    username: user.username,
    role: user.role,
  };
}

export function authenticateUser(username, password) {
  const authenticatedUser = verifyCredentials(username, password);

  if (!authenticatedUser) {
    return null;
  }

  return {
    id: authenticatedUser.user_id,
    username: authenticatedUser.username,
    role: authenticatedUser.role,
  };
}

export function getUsernameMatchingMode() {
  return USERNAME_MATCHING_MODE;
}
