import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Account = {
  id: string;
  code: string;
  name: string;
};

type Mapping = {
  id: string;
  code: string;
  name: string;
  debit_account_id: string;
  credit_account_id: string;
};

export default function AccountMapping() {
  const [data, setData] = useState<Mapping[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [showForm, setShowForm] = useState(false);

  const [idEdit, setIdEdit] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const [debitSearch, setDebitSearch] = useState("");
  const [creditSearch, setCreditSearch] = useState("");

  const [debitOpen, setDebitOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);

  const [debitAccount, setDebitAccount] = useState("");
  const [creditAccount, setCreditAccount] = useState("");

  // ================= LOAD =================
  async function loadData() {
    const { data } = await supabase
      .from("account_mappings")
      .select("*")
      .order("code");

    setData(data || []);
  }

  async function loadAccounts() {
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .order("code");

    setAccounts(data || []);
  }

  useEffect(() => {
    loadData();
    loadAccounts();
  }, []);

  // ================= RESET =================
  function resetForm() {
    setIdEdit("");
    setCode("");
    setName("");

    setDebitSearch("");
    setCreditSearch("");

    setDebitAccount("");
    setCreditAccount("");

    setDebitOpen(false);
    setCreditOpen(false);
  }

  // ================= SAVE =================
  async function saveData() {
    if (!code || !name) {
      alert("Lengkapi data");
      return;
    }

    const payload = {
      code,
      name,
      debit_account_id: debitAccount || null,
      credit_account_id: creditAccount || null,
    };

    if (idEdit) {
      await supabase
        .from("account_mappings")
        .update(payload)
        .eq("id", idEdit);
    } else {
      await supabase
        .from("account_mappings")
        .insert(payload);
    }

    setShowForm(false);
    resetForm();
    loadData();
  }

  // ================= EDIT =================
  async function editData(row: Mapping) {
    setIdEdit(row.id);
    setCode(row.code);
    setName(row.name);

    setDebitAccount(row.debit_account_id);
    setCreditAccount(row.credit_account_id);

    const debit = accounts.find(
      (a) => a.id === row.debit_account_id
    );

    const credit = accounts.find(
      (a) => a.id === row.credit_account_id
    );

    setDebitSearch(
      debit ? `${debit.code} ${debit.name}` : ""
    );

    setCreditSearch(
      credit ? `${credit.code} ${credit.name}` : ""
    );

    setShowForm(true);
  }

  // ================= DELETE =================
  async function deleteData(id: string) {
    if (!confirm("Hapus mapping?")) return;

    await supabase
      .from("account_mappings")
      .delete()
      .eq("id", id);

    loadData();
  }

  // ================= UI =================
  return (
    <div className="p-4 bg-white rounded shadow">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">

        <h1 className="text-lg font-semibold">
          Account Mapping
        </h1>

        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          + Tambah
        </button>
      </div>

      {/* TABLE */}
      <table className="w-full border text-sm">

        <thead className="bg-gray-400 text-white">
          <tr>
            <th className="border p-2">Kode</th>
            <th className="border p-2">Nama</th>
            <th className="border p-2">Debit</th>
            <th className="border p-2">Kredit</th>
            <th className="border p-2">Aksi</th>
          </tr>
        </thead>

        <tbody>
          {data.map((row) => {
            const debit = accounts.find(
              (a) => a.id === row.debit_account_id
            );

            const credit = accounts.find(
              (a) => a.id === row.credit_account_id
            );

            return (
              <tr
                key={row.id}
                className="hover:bg-yellow-100"
              >
                <td className="border p-2">{row.code}</td>
                <td className="border p-2">{row.name}</td>

                <td className="border p-2">
                  {debit
                    ? `${debit.code} ${debit.name}`
                    : "-"}
                </td>

                <td className="border p-2">
                  {credit
                    ? `${credit.code} ${credit.name}`
                    : "-"}
                </td>

                <td className="border p-2 text-center">
                  <button
                    onClick={() => editData(row)}
                    className="text-blue-600 mr-2"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteData(row.id)}
                    className="text-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* POPUP */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-start pt-20 z-50">

          <div className="bg-white w-[650px] rounded shadow-lg p-6">

            <h2 className="text-lg font-semibold mb-4 text-center">
              Account Mapping
            </h2>

            {/* FORM */}
            <div className="space-y-3">

              {/* CODE */}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Kode Mapping"
                className="border px-3 py-2 rounded w-full"
              />

              {/* NAME */}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Mapping"
                className="border px-3 py-2 rounded w-full"
              />

              {/* DEBIT */}
              <div className="relative">

                <label className="text-sm font-semibold">
                  Akun Debit
                </label>

                <input
                  value={debitSearch}
                  placeholder="Cari akun debit..."
                  className="border px-3 py-2 rounded w-full"
                  onFocus={() => setDebitOpen(true)}
                  onClick={() => setDebitOpen(true)}
                  onChange={(e) => {
                    setDebitSearch(e.target.value);
                    setDebitOpen(true);
                  }}
                />

                {debitOpen && (
                  <div className="absolute bg-white border w-full max-h-48 overflow-auto z-20 shadow rounded">

                    <div className="px-2 py-1 text-xs bg-gray-100">
                      -- PILIH AKUN --
                    </div>

                    {accounts
                      .filter((a) =>
                        `${a.code} ${a.name}`
                          .toLowerCase()
                          .includes(
                            debitSearch.toLowerCase()
                          )
                      )
                      .map((a) => (
                        <div
                          key={a.id}
                          className="px-2 py-1 hover:bg-blue-100 cursor-pointer"
                          onClick={() => {
                            setDebitAccount(a.id);
                            setDebitSearch(
                              `${a.code} ${a.name}`
                            );
                            setDebitOpen(false);
                          }}
                        >
                          {a.code} {a.name}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* CREDIT */}
              <div className="relative">

                <label className="text-sm font-semibold">
                  Akun Kredit
                </label>

                <input
                  value={creditSearch}
                  placeholder="Cari akun kredit..."
                  className="border px-3 py-2 rounded w-full"
                  onFocus={() => setCreditOpen(true)}
                  onClick={() => setCreditOpen(true)}
                  onChange={(e) => {
                    setCreditSearch(e.target.value);
                    setCreditOpen(true);
                  }}
                />

                {creditOpen && (
                  <div className="absolute bg-white border w-full max-h-48 overflow-auto z-20 shadow rounded">

                    <div className="px-2 py-1 text-xs bg-gray-100">
                      -- PILIH AKUN --
                    </div>

                    {accounts
                      .filter((a) =>
                        `${a.code} ${a.name}`
                          .toLowerCase()
                          .includes(
                            creditSearch.toLowerCase()
                          )
                      )
                      .map((a) => (
                        <div
                          key={a.id}
                          className="px-2 py-1 hover:bg-blue-100 cursor-pointer"
                          onClick={() => {
                            setCreditAccount(a.id);
                            setCreditSearch(
                              `${a.code} ${a.name}`
                            );
                            setCreditOpen(false);
                          }}
                        >
                          {a.code} {a.name}
                        </div>
                      ))}
                  </div>
                )}
              </div>

            </div>

            {/* ACTION */}
            <div className="flex justify-end gap-2 mt-5">

              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="bg-gray-400 text-white px-3 py-1 rounded"
              >
                Batal
              </button>

              <button
                onClick={saveData}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Simpan
              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}