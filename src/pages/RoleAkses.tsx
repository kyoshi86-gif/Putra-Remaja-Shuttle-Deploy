// src/pages/RoleAkses.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {FiEdit, FiTrash2} from "react-icons/fi";


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
        <div className="w-full pr-8 flex flex-wrap justify-between items-center mb-4 gap-3">
          <button
            onClick={() => navigate("/edit-role")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tambah Role
          </button>
        </div>

        {/* Daftar Role */}
        <div className="w-full pr-8">
          <table className="w-full table-auto border border-gray-300 text-sm">
            <thead className="bg-gray-400 text-white">
              <tr>
                <th className="border p-2 text-center w-[100px]">Role</th>
                <th className="border p-2 text-center">Hak Akses</th>
                <th className="border p-2 text-center w-[60px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {roles.length > 0 ? (
                roles.map((role) => (
                  <tr key={role.id} className="hover:bg-yellow-300 transition-all duration-150">
                    <td className="p-2 border text-center">{role.name}</td>
                    <td className="p-2 border text-left">
                      {role.access && role.access.length > 0
                        ? role.access.join(", ")
                        : "-"}
                    </td>
                    <td className="p-2 border text-center">
                      <div className="flex justify-center gap-[0.5px]">
                        <button
                          onClick={() => navigate(`/edit-role?id=${role.id}`)}
                          className="text-blue-600 hover:text-blue-800 px-[5px]"
                          title="Edit"
                        >
                          <FiEdit size={16} />
                        </button>
                        <button
                          onClick={() => deleteRole(role.id)}
                           className="text-red-600 hover:text-red-800 px-[5px]"
                           title="Hapus"
                        >
                          <FiTrash2 size={16} />
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
