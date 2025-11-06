// src/pages/EditRole.tsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

interface Role {
  id?: string;
  name: string;
  access: string[];
}

interface MenuItem {
  id: string;
  label: string;
  access: string;
  parent: string | null;
}

export default function EditRole() {
  const [searchParams] = useSearchParams();
  const roleId = searchParams.get("id");
  const [roleName, setRoleName] = useState("");
  const [access, setAccess] = useState<string[]>([]);
  const [menuStructure, setMenuStructure] = useState<Record<string, MenuItem[]>>({});
  const [activeTab, setActiveTab] = useState("");
  const navigate = useNavigate();

  // 🔹 Ambil menu dari Supabase (otomatis)
  useEffect(() => {
    const loadMenus = async () => {
      const { data, error } = await supabase.from("menus").select("*").order("order", { ascending: true });
      if (error) {
        console.error("Gagal memuat menus:", error);
        return;
      }

      // Susun parent → child
      const parents = data.filter((m) => !m.parent);

      const structure: Record<string, MenuItem[]> = {};

      parents.forEach((parent) => {
        const children = data.filter((child) => child.parent === parent.id);
        const grandchildren = data.filter((g) => children.some((c) => g.parent === c.id));

        structure[parent.label] = [...children, ...grandchildren].map((item) => ({
          id: item.id,
          label: item.label,
          access: item.access,
          parent: item.parent,
        }));
      });

      setMenuStructure(structure);
      if (parents.length > 0) setActiveTab(parents[0].label);
    };

    loadMenus();
  }, []);

  // 🔹 Ambil data role
  useEffect(() => {
    if (roleId) {
      supabase
        .from("custom_roles")
        .select("*")
        .eq("id", roleId)
        .single()
        .then(({ data }) => {
          if (data) {
            setRoleName(data.name);
            setAccess(data.access || []);
          }
        });
    }
  }, [roleId]);

  const toggleAccess = (item: string) => {
    setAccess((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const handleSave = async () => {
    const trimmedName = roleName.trim();
    if (!trimmedName) return alert("Nama role wajib diisi");

    // 🔎 Cek duplikat nama
    const { data: existingRoles, error: checkError } = await supabase
      .from("custom_roles")
      .select("id")
      .eq("name", trimmedName);

    if (checkError) return alert("Gagal cek role: " + checkError.message);
    if (existingRoles && existingRoles.length > 0 && existingRoles[0].id !== roleId)
      return alert("Nama role sudah digunakan!");

    const payload: Role = { name: trimmedName, access };

    let saveError = null;
    if (roleId) {
      const { error } = await supabase.from("custom_roles").update(payload).eq("id", roleId);
      saveError = error;
    } else {
      const { error } = await supabase.from("custom_roles").insert([payload]);
      saveError = error;
    }

    if (saveError) return alert("Gagal menyimpan role: " + saveError.message);

    // 🔄 Update access user yang punya role ini
    const { error: updateUsersError } = await supabase
      .from("custom_users")
      .update({ access })
      .eq("role", trimmedName);

    if (updateUsersError) {
      alert("Role tersimpan, tapi gagal update user: " + updateUsersError.message);
    } else {
      alert("Role berhasil disimpan!");
    }

    // 🧩 Tambahkan ini:
setTimeout(() => {
  window.location.reload();
}, 500);
    navigate("/role-akses");
  };

  return (
    <div className="p-6 bg-white rounded shadow border border-gray-300">
      <h2 className="text-xl font-bold mb-4">{roleId ? "Edit Role" : "Tambah Role"}</h2>

      <input
        type="text"
        placeholder="Nama Role"
        value={roleName}
        onChange={(e) => setRoleName(e.target.value)}
        className="mb-4 p-2 border rounded w-full"
      />

      {/* 🔹 Tab Menu */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.keys(menuStructure).map((menu) => (
          <button
            key={menu}
            onClick={() => setActiveTab(menu)}
            className={`px-4 py-2 rounded ${
              activeTab === menu ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            {menu}
          </button>
        ))}
      </div>

      {/* 🔹 Sub Menu */}
      <div className="border p-4 rounded bg-gray-50">
        {activeTab && menuStructure[activeTab]?.length > 0 && (
          <>
            {/* Tombol centang semua */}
            <div className="mb-2">
              <button
                onClick={() => {
                  const allAccess = menuStructure[activeTab].map((item) => item.access);
                  const isAllChecked = allAccess.every((a) => access.includes(a));
                  setAccess((prev) =>
                    isAllChecked
                      ? prev.filter((a) => !allAccess.includes(a))
                      : [...prev, ...allAccess.filter((a) => !prev.includes(a))]
                  );
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Centang Semua / Hapus Semua
              </button>
            </div>

            {/* Checkbox Submenu */}
            {menuStructure[activeTab].map((item) => (
              <div key={item.id} className="mb-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={access.includes(item.access)}
                    onChange={() => toggleAccess(item.access)}
                  />
                  <span>{item.label}</span>
                </label>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Tombol Aksi */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Simpan
        </button>
        <button
          onClick={() => navigate("/role-akses")}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
