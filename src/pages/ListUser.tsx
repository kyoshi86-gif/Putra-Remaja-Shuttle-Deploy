// src/pages/ListUser.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import bcrypt from "bcryptjs";

interface User {
  id: string;
  user_id: string;
  name: string;
  password?: string;
  role: string;
  created_at: string;
  access?: string[];
  username?: string;
}

interface Role {
  id: string;
  name: string;
  access?: string[];
  created_at?: string;
}

interface UpdateUserData {
  name: string;
  role: string;
  access: string[];
  password?: string;
}

export default function ListUser() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("");

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingPassword, setEditingPassword] = useState("");
  const [editingRole, setEditingRole] = useState("");

  // Fetch users
  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("custom_users")
      .select("id, user_id, name, username, role, access, created_at")
      .order("created_at", { ascending: true });
    if (error) alert("Gagal ambil user: " + error.message);
    else setUsers(data as User[]);
  };

  // Fetch roles
  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from("custom_roles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) alert("Gagal ambil roles: " + error.message);
    else setRoles(data as Role[]);
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  // Tambah user baru
  const addUser = async () => {
    if (!newName.trim() || !newPassword || !newRole) {
      return alert("Nama, password, dan role wajib diisi");
    }

    setLoading(true);

    try {
      const cleanName = newName.trim();

      // Cek nama duplikat (case-insensitive)
      const { data: existingUsers, error: checkError } = await supabase
        .from("custom_users")
        .select("id")
        .ilike("name", cleanName); // ✅ case-insensitive

      if (checkError) throw checkError;
      if (existingUsers && existingUsers.length > 0) {
        alert("User dengan nama ini sudah ada!");
        return;
      }

      // Ambil user_id terakhir
      const { data: lastUser } = await supabase
        .from("custom_users")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextId = "01";
      if (lastUser?.id) {
        const last = parseInt(lastUser.id);
        const next = isNaN(last) ? 1 : last + 1;
        nextId = String(next).padStart(2, "0");
      }

      const selectedRole = roles.find((r) => r.name === newRole);
      const accessFromRole = selectedRole?.access ?? [];

      const genUsername =
        cleanName.toLowerCase().replace(/\s+/g, "") +
        Date.now().toString().slice(-4);

      const hashedPassword = bcrypt.hashSync(newPassword, 10);

      const { error } = await supabase
        .from("custom_users")
        .insert([
          {
            id: nextId,
            name: cleanName,
            username: genUsername,
            password: hashedPassword,
            role: newRole,
            access: accessFromRole,
          },
        ])
        .select("*")
        .single();

      if (error) throw error;

      await fetchUsers(); // ✅ refresh data
      setNewName("");
      setNewPassword("");
      setNewRole("");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Gagal tambah user: " + message);
    } finally {
      setLoading(false);
    }
  };

  // Update user
  const updateUser = async (userId: string) => {
    if (!editingName || !editingRole)
      return alert("Nama dan role wajib diisi");

    const selectedRole = roles.find((r) => r.name === editingRole);
    const accessFromRole = selectedRole?.access ?? [];

    const updateData: UpdateUserData = {
      name: editingName,
      role: editingRole,
      access: accessFromRole,
    };
    if (editingPassword)
      updateData.password = bcrypt.hashSync(editingPassword, 10);

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("custom_users")
        .update(updateData)
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;

      setUsers(users.map((u) => (u.id === userId ? (data as User) : u)));
      setEditingUserId(null);
      setEditingPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Gagal update user: " + message);
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!userId || typeof userId !== "string") {
      alert("❌ ID user tidak valid");
      return;
    }

    if (!confirm("Yakin ingin menghapus user ini?")) return;

    const { error } = await supabase
      .from("custom_users")
      .delete()
      .eq("id", userId);

    if (error) {
      alert("Gagal hapus user: " + error.message);
    } else {
      await fetchUsers(); // ✅ refresh data
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      {/* Form tambah user */}
      <div
        style={{
          margin: "20px 0",
          border: "1px solid #d1d5db",
          padding: "16px",
          borderRadius: "8px",
          backgroundColor: "#f9fafb",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Nama"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "0.875rem",
              flex: "1",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "0.875rem",
              flex: "1",
            }}
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "0.875rem",
              flex: "1",
            }}
          >
            <option value="">Pilih Role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            onClick={addUser}
            disabled={loading}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              fontSize: "0.875rem",
              cursor: "pointer",
              minWidth: "120px",
            }}
          >
            {loading ? "Memproses..." : "Tambah User"}
          </button>
        </div>
      </div>

      {/* Tabel user */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead className="bg-gray-400 text-white">
          <tr>
            <th style={{ border: "1px solid #000", padding: "8px" }}>Nama</th>
            <th style={{ border: "1px solid #000", padding: "8px" }}>Role</th>
            <th style={{ border: "1px solid #000", padding: "8px" }}>User id</th>
            <th style={{ border: "1px solid #000", padding: "8px" }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={user.user_id || user.id || index}>
              <td style={{ textAlign: "center", border: "1px solid #000", padding: "8px" }}>
                {editingUserId === user.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    style={{ padding: "4px" }}
                  />
                ) : (
                  user.name
                )}
              </td>
              <td style={{ textAlign: "center", border: "1px solid #000", padding: "8px" }}>
                {editingUserId === user.id ? (
                  <select value={editingRole} onChange={(e) => setEditingRole(e.target.value)}>
                    {roles.map((r) => (
                      <option key={r.id || r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  user.role
                )}
              </td>
              <td style={{ textAlign: "center", border: "1px solid #000", padding: "8px" }}>
                {user.user_id || user.id}
              </td>
              <td style={{ textAlign: "center", border: "1px solid #000", padding: "8px" }}>
                {editingUserId === user.id ? (
                  <>
                    <input
                      type="password"
                      placeholder="Password baru"
                      value={editingPassword}
                      onChange={(e) => setEditingPassword(e.target.value)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        fontSize: "0.875rem",
                      }}
                    />
                    <button
                      onClick={() => updateUser(user.id)}
                      style={{
                        backgroundColor: "#16a34a",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        border: "none",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      Simpan
                    </button>
                    <button
                      onClick={() => setEditingUserId(null)}
                      style={{
                        backgroundColor: "#9ca3af",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        border: "none",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      Batal
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingUserId(user.id);
                        setEditingName(user.name);
                        setEditingRole(user.role);
                        setEditingPassword("");
                      }}
                      style={{
                        marginRight: "10px",
                        backgroundColor: "#3b82f6",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        border: "none",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (!user.id) {
                          alert("❌ ID user tidak valid");
                          return;
                        }
                        deleteUser(user.id);
                      }}
                      style={{
                        backgroundColor: "#ef4444",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        border: "none",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
