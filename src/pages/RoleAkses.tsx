// src/pages/RoleAkses.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/solid";


interface Role {
  id: string;
  name: string;
  access: string[];
  created_at: string;
}

export default function RoleAkses() {
  const [roles, setRoles] = useState<Role[]>([]);
  const navigate = useNavigate();

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from("custom_roles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) alert("Gagal ambil role: " + error.message);
    else setRoles(data as Role[]);
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const deleteRole = async (roleId: string) => {
    if (!confirm("Yakin ingin menghapus role ini?")) return;
    const { error } = await supabase
      .from("custom_roles")
      .delete()
      .eq("id", roleId);
    if (error) alert("Gagal hapus role: " + error.message);
    else setRoles(roles.filter((r) => r.id !== roleId));
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      {/* Tombol Tambah Role */}
        <div className="mb-4" style={{padding: "10px"}}>
          <button
            onClick={() => navigate("/edit-role")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tambah Role
          </button>
        </div>

        {/* Daftar Role */}
        <div className="overflow-visible rounded-lg border border-black">
          <table className="w-full table-fixed border-separate border border-black">
            <thead className="bg-gray-100">
              <tr>
                <th className="border w-[20%]">Role</th>
                <th className="border w-[65%]">Hak Akses</th>
                <th className="border w-[15%] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {roles.length > 0 ? (
                roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="border border-black px-2 py-2 truncate">{role.name}</td>
                    <td className="border border-black px-2 py-2">
                      {role.access && role.access.length > 0
                        ? role.access.join(", ")
                        : "-"}
                    </td>
                    <td className="border px-2 py-2 text-center">
                      <div className="flex gap-3 justify-center items-center">
                        <button
                          onClick={() => navigate(`/edit-role?id=${role.id}`)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-500 hover:bg-green-600 text-white text-sm shadow-sm transition"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => deleteRole(role.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm shadow-sm transition"
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td> 
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center border border-black px-4 py-6 text-gray-500"
                  >
                    Belum ada role yang dibuat
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}
