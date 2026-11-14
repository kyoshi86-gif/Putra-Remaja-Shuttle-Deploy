import jwt from "jsonwebtoken";

export async function authenticateUser(username, password) {
  const user = await findUserInDatabase(username, password);
  if (!user) throw new Error("User tidak ditemukan");

  // Buat JWT dengan claim id sesuai custom_users.id
  const token = jwt.sign(
    {
      sub: user.id, // identifier utama
      id: user.id, // claim tambahan
      role: user.role,
      access: user.access,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  return { ...user, token };
}
