const USERNAME_MATCHING_MODE = "case-insensitive";

function normalizeUsername(username) {
  if (typeof username !== "string") {
    return "";
  }

  if (USERNAME_MATCHING_MODE === "case-insensitive") {
    return username.trim().toLowerCase();
  }

  return username.trim();
}

const users = [
  {
    id: "player-1",
    username: "Adminplayer",
    normalized_username: normalizeUsername("Adminplayer"),
    password: "1234",
    role: "PLAYER",
  },
  {
    id: "gm-1",
    username: "Admingm",
    normalized_username: normalizeUsername("Admingm"),
    password: "1234",
    role: "GM",
  },
  {
    id: "helper-1",
    username: "Admingmhelper",
    normalized_username: normalizeUsername("Admingmhelper"),
    password: "1234",
    role: "HELPER",
  },
];

export function findUserByUsername(username) {
  const normalizedUsername = normalizeUsername(username);

  if (normalizedUsername.length === 0) {
    return null;
  }

  return users.find((user) => user.normalized_username === normalizedUsername) ?? null;
}

export function validatePassword(user, password) {
  if (!user || typeof user.password !== "string") {
    return false;
  }

  return user.password === password;
}

export function authenticateUser(username, password) {
  const user = findUserByUsername(username);
  if (!user || !validatePassword(user, password)) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

export function getUsernameMatchingMode() {
  return USERNAME_MATCHING_MODE;
}
