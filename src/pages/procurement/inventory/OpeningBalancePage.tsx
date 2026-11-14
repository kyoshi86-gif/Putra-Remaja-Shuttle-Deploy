import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { parseNumberInput, formatNumberInput } from "../utils/format";
import DateInput from "@/components/common/DateInput";
import Pagination from "@/components/common/Pagination";
import SearchableSelect, { type SearchableSelectOption } from "@/components/common/SearchableSelect";
import { createPaginationMeta } from "@/lib/pagination/types";
import { usePagination } from "@/lib/pagination/usePagination";
import { supabase } from "@/lib/supabaseClient";
import { getCustomUser } from "@/lib/authUser";

interface Props { entityId?: string | null; }

type Status = "DRAFT" | "POSTED" | "CANCELLED";
type Store = { id:string; entity_id:string; code:string; name:string };
type Category = { id:string; inventory_account_id:string|null };
type Item = {
  id:string; code:string|null; name:string; unit_id:string|null;
  standard_cost:number|null; inventory_account_id:string|null;
  category_id:string|null; category:Category|null;
};
type Account = { id:string; code:string; name:string };
type Detail = {
  id?:string; opening_balance_id?:string; item_id:string; unit_id:string|null;
  quantity:number; unit_price:number; total_amount:number;
  debit_account_id:string; credit_account_id:string; item?:Item|null;
};
type Document = {
  id:string; entity_id:string; store_id:string; opening_number:string;
  opening_date:string; status:Status; notes?:string|null;
  created_by?:string|null; posted_by?:string|null; posted_at?:string|null;
  created_at:string; store?:Store|null;
};
type FormState = {
  store_id:string; opening_number:string; opening_date:string;
  notes:string; details:Detail[];
};

const statusLabel:Record<Status,string> = {
  DRAFT:"Draft", POSTED:"Posted", CANCELLED:"Cancelled",
};
const statusClass:Record<Status,string> = {
  DRAFT:"bg-yellow-100 text-yellow-700",
  POSTED:"bg-green-100 text-green-700",
  CANCELLED:"bg-red-100 text-red-700",
};

const today = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime()-offset).toISOString().slice(0,10);
};
const numberValue = (value:unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const formatNumber = (value:number) =>
  new Intl.NumberFormat("id-ID",{maximumFractionDigits:2}).format(value);
const formatMoney = (value:number) =>
  new Intl.NumberFormat("id-ID",{
    style:"currency", currency:"IDR", minimumFractionDigits:0,
    maximumFractionDigits:0,
  }).format(value);
const createForm = ():FormState => ({
  store_id:"", opening_number:"", opening_date:today(), notes:"", details:[],
});

export default function OpeningBalancePage({ entityId:propEntityId=null }:Props) {
  const currentUser = getCustomUser();
  const customUserId = currentUser?.id ?? null;
  const entityId = propEntityId ?? currentUser?.entity_id ?? null;

  const [documents,setDocuments] = useState<Document[]>([]);
  const [totalCount,setTotalCount] = useState(0);
  const [stores,setStores] = useState<Store[]>([]);
  const [items,setItems] = useState<Item[]>([]);
  const [accounts,setAccounts] = useState<Account[]>([]);
  const [loading,setLoading] = useState(false);
  const [loadingMasters,setLoadingMasters] = useState(false);
  const [saving,setSaving] = useState(false);
  const [showForm,setShowForm] = useState(false);
  const [viewOnly,setViewOnly] = useState(false);
  const [editing,setEditing] = useState<Document|null>(null);
  const [form,setForm] = useState<FormState>(createForm);

  const [search,setSearch] = useState("");
  const [selectedStore,setSelectedStore] = useState("");
  const [startDate,setStartDate] = useState("");
  const [endDate,setEndDate] = useState("");

  const [selectedItemId,setSelectedItemId] = useState("");
  const [inputQty,setInputQty] = useState("1");
  const [inputPrice,setInputPrice] = useState("");
  const [inputCreditAccountId,setInputCreditAccountId] = useState("");

  const { page,pageSize,setPage,setPageSize,resetPage } = usePagination();

  const loadMasters = useCallback(async () => {
  if (!entityId) {
    setStores([]);
    setItems([]);
    setAccounts([]);
    return;
  }

  setLoadingMasters(true);

    try {
      const [storeRes, itemRes, accountRes] = await Promise.all([
        supabase
          .from("stores")
          .select("id, entity_id, code, name")
          .eq("entity_id", entityId)
          .eq("is_active", true)
          .order("code"),

        supabase
          .from("items")
          .select(`
            id,
            code,
            name,
            unit_id,
            standard_cost,
            inventory_account_id,
            category_id,
            category:item_categories (
              id,
              inventory_account_id
            )
          `)
          .eq("entity_id", entityId)
          .eq("is_active", true)
          .order("name"),

        /*
        * COA project saat ini adalah global.
        * Banyak data accounts memiliki entity_id = NULL.
        * Karena itu JANGAN filter entity_id di sini.
        */
        supabase
          .from("accounts")
          .select(`
            id,
            code,
            name,
            category_code,
            account_type,
            is_active,
            is_posting,
            entity_id
          `)
          .eq("is_active", true)
          .eq("is_posting", true)
          .order("code"),
      ]);

      if (storeRes.error) {
        throw storeRes.error;
      }

      if (itemRes.error) {
        throw itemRes.error;
      }

      if (accountRes.error) {
        throw accountRes.error;
      }

      setStores((storeRes.data ?? []) as Store[]);

      setItems(
        ((itemRes.data ?? []) as unknown as Item[]).map(
          (item) => ({
            ...item,
            category: Array.isArray(item.category)
              ? item.category[0] ?? null
              : item.category ?? null,
          })
        )
      );

      setAccounts((accountRes.data ?? []) as Account[]);

    } catch (error) {
      console.error(
        "Opening balance master error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal memuat master Saldo Awal."
      );
    } finally {
      setLoadingMasters(false);
    }
  }, [entityId]);

  const loadDocuments = useCallback(async () => {
    if (!entityId) {
      setDocuments([]); setTotalCount(0);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("inventory_opening_balances")
        .select(`
          *,
          store:stores ( id, entity_id, code, name )
        `,{count:"exact"})
        .eq("entity_id",entityId)
        .order("opening_date",{ascending:false})
        .order("created_at",{ascending:false});

      if (selectedStore) query=query.eq("store_id",selectedStore);
      if (startDate) query=query.gte("opening_date",startDate);
      if (endDate) query=query.lte("opening_date",endDate);

      const keyword=search.trim();
      if (keyword) {
        query=query.or([
          `opening_number.ilike.%${keyword}%`,
          `notes.ilike.%${keyword}%`,
        ].join(","));
      }

      const from=(page-1)*pageSize;
      const to=from+pageSize-1;
      const {data,error,count}=await query.range(from,to);
      if (error) throw error;

      setDocuments((data ?? []) as Document[]);
      setTotalCount(count ?? 0);
    } catch (error) {
      console.error("Opening balance document error:",error);
      setDocuments([]); setTotalCount(0);
    } finally {
      setLoading(false);
    }
  },[endDate,entityId,page,pageSize,search,selectedStore,startDate]);

  useEffect(()=>{ void loadMasters(); },[loadMasters]);
  useEffect(()=>{ void loadDocuments(); },[loadDocuments]);

  const itemOptions=useMemo<SearchableSelectOption[]>(
    ()=>items.map(item=>({
      value:item.id,
      label:`${item.code ?? "-"} - ${item.name}`,
    })),[items]
  );

  const accountOptions = useMemo<SearchableSelectOption[]>(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.code} - ${account.name}`,
        searchText: `${account.code} ${account.name}`,
      })),
    [accounts]
  );

  const storeOptions=useMemo<SearchableSelectOption[]>(
    ()=>stores.map(store=>({
      value:store.id,
      label:`${store.code} - ${store.name}`,
    })),[stores]
  );

  const paginationMeta=useMemo(
    ()=>createPaginationMeta(totalCount,page,pageSize),
    [totalCount,page,pageSize]
  );

  const totalQuantity=useMemo(
    ()=>form.details.reduce((sum,row)=>sum+numberValue(row.quantity),0),
    [form.details]
  );

  const totalAmount=useMemo(
    ()=>form.details.reduce(
      (sum,row)=>sum+numberValue(row.quantity)*numberValue(row.unit_price),0
    ),[form.details]
  );

  const resetLineInput=()=>{
    setSelectedItemId("");
    setInputQty("");
    setInputPrice("");
    
  };

  const closeForm=()=>{
    setShowForm(false);
    setViewOnly(false);
    setEditing(null);
    setForm(createForm());
    resetLineInput();
  };

  const generateOpeningNumber=async(storeId:string)=>{
    if (!entityId || !storeId) return "";
    const store=stores.find(x=>x.id===storeId);
    if (!store) return "";

    const {count,error}=await supabase
      .from("inventory_opening_balances")
      .select("id",{count:"exact",head:true})
      .eq("entity_id",entityId)
      .eq("store_id",storeId);

    if (error) throw error;

    return `SA-${store.code.toUpperCase()}-${String((count ?? 0)+1).padStart(4,"0")}`;
  };

  const openCreate=()=>{
    setEditing(null);
    setViewOnly(false);
    setForm(createForm());
    resetLineInput();
    setShowForm(true);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const handleFormStoreChange=async(storeId:string)=>{
    setForm(current=>({
      ...current, store_id:storeId, opening_number:"",
    }));

    if (!storeId || editing) return;

    try {
      const openingNumber=await generateOpeningNumber(storeId);
      setForm(current=>({
        ...current, store_id:storeId, opening_number:openingNumber,
      }));
    } catch (error) {
      console.error("Generate opening number error:",error);
      alert(error instanceof Error ? error.message : "Gagal membuat nomor Saldo Awal.");
    }
  };

  const addOpeningBalanceLine=()=>{
    if (!selectedItemId) {
      alert("Pilih artikel.");
      return;
    }

    const item=items.find(x=>x.id===selectedItemId);
    if (!item) {
      alert("Artikel tidak ditemukan.");
      return;
    }

    const quantity=numberValue(inputQty);
    if (quantity<=0) {
      alert("Qty harus lebih dari 0.");
      return;
    }

    const unitPrice=numberValue(inputPrice);
    if (unitPrice<0) {
      alert("Harga tidak valid.");
      return;
    }

    if (!inputCreditAccountId) {
      alert("Pilih akun.");
      return;
    }

    const debitAccountId=
      item.inventory_account_id ||
      item.category?.inventory_account_id ||
      "";

    if (!debitAccountId) {
      alert(
        `Akun persediaan artikel "${item.code ?? "-"} - ${item.name}" belum diset pada artikel atau kategori.`
      );
      return;
    }

    if (form.details.some(row=>row.item_id===item.id)) {
      alert("Artikel tersebut sudah ada pada detail.");
      return;
    }

    setForm(current=>({
      ...current,
      details:[
        ...current.details,
        {
          item_id:item.id,
          unit_id:item.unit_id ?? null,
          quantity,
          unit_price:unitPrice,
          total_amount:quantity*unitPrice,
          debit_account_id:debitAccountId,
          credit_account_id:inputCreditAccountId,
          item,
        },
      ],
    }));

    resetLineInput();
  };

  const removeLine=(index:number)=>{
    setForm(current=>({
      ...current,
      details:current.details.filter((_,i)=>i!==index),
    }));
  };

  const loadDetails=async(openingId:string):Promise<Detail[]>=>{
    const {data,error}=await supabase
      .from("inventory_opening_balance_items")
      .select(`
        *,
        item:items (
          id, code, name, unit_id, standard_cost, inventory_account_id, category_id,
          category:item_categories ( id, inventory_account_id )
        )
      `)
      .eq("opening_balance_id",openingId)
      .order("created_at");

    if (error) throw error;

    return ((data ?? []) as unknown as Detail[]).map(row=>({
      ...row,
      item:row.item ? {
        ...row.item,
        category:Array.isArray(row.item.category)
          ? row.item.category[0] ?? null
          : row.item.category ?? null,
      } : null,
    }));
  };

  const fillDocumentForm=(document:Document,details:Detail[])=>{
    setForm({
      store_id:document.store_id,
      opening_number:document.opening_number,
      opening_date:document.opening_date,
      notes:document.notes ?? "",
      details:details.map(row=>({
        ...row,
        quantity:numberValue(row.quantity),
        unit_price:numberValue(row.unit_price),
        total_amount:numberValue(row.total_amount),
        debit_account_id:row.debit_account_id ?? "",
        credit_account_id:row.credit_account_id ?? "",
      })),
    });
  };

  const openView=async(document:Document)=>{
    try {
      const details=await loadDetails(document.id);
      setEditing(document);
      setViewOnly(true);
      fillDocumentForm(document,details);
      resetLineInput();
      setShowForm(true);
      window.scrollTo({top:0,behavior:"smooth"});
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal memuat detail Saldo Awal.");
    }
  };

  const openEdit=async(document:Document)=>{
    if (document.status!=="DRAFT") {
      alert("Hanya dokumen Draft yang dapat diedit.");
      return;
    }

    try {
      const details=await loadDetails(document.id);
      setEditing(document);
      setViewOnly(false);
      fillDocumentForm(document,details);
      resetLineInput();
      setShowForm(true);
      window.scrollTo({top:0,behavior:"smooth"});
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal memuat detail Saldo Awal.");
    }
  };

  const handleSubmit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if (viewOnly || saving) return;

    if (!entityId) {
      alert("Entity aktif tidak ditemukan.");
      return;
    }

    if (!form.store_id) {
      alert("Store wajib dipilih.");
      return;
    }

    if (!form.opening_number.trim()) {
      alert("Nomor Saldo Awal belum terbentuk.");
      return;
    }

    if (!form.opening_date) {
      alert("Tanggal wajib diisi.");
      return;
    }

    if (form.details.length===0) {
      alert("Tambahkan minimal satu artikel.");
      return;
    }

    for (const row of form.details) {
      if (!row.item_id || numberValue(row.quantity)<=0) {
        alert("Terdapat detail artikel atau Qty yang tidak valid.");
        return;
      }

      if (!row.debit_account_id) {
        alert("Akun debit persediaan belum tersedia.");
        return;
      }

      if (!row.credit_account_id) {
        alert("Akun kredit wajib dipilih.");
        return;
      }
    }

    setSaving(true);
    try {
      let headerId=editing?.id ?? "";

      if (editing) {
        const {error:headerError}=await supabase
          .from("inventory_opening_balances")
          .update({
            store_id:form.store_id,
            opening_number:form.opening_number,
            opening_date:form.opening_date,
            notes:form.notes || null,
            updated_at:new Date().toISOString(),
          })
          .eq("id",editing.id);

        if (headerError) throw headerError;

        const {error:deleteDetailError}=await supabase
          .from("inventory_opening_balance_items")
          .delete()
          .eq("opening_balance_id",editing.id);

        if (deleteDetailError) throw deleteDetailError;
      } else {
        const {data,error:headerError}=await supabase
          .from("inventory_opening_balances")
          .insert({
            entity_id:entityId,
            store_id:form.store_id,
            opening_number:form.opening_number,
            opening_date:form.opening_date,
            status:"DRAFT",
            notes:form.notes || null,
            created_by:null,
          })
          .select("id")
          .single();

        if (headerError) throw headerError;
        headerId=String(data.id);
      }

      const detailRows=form.details.map(row=>({
        opening_balance_id:headerId,
        item_id:row.item_id,
        unit_id:row.unit_id ?? null,
        quantity:numberValue(row.quantity),
        unit_price:numberValue(row.unit_price),
        total_amount:numberValue(row.quantity)*numberValue(row.unit_price),
        debit_account_id:row.debit_account_id || null,
        credit_account_id:row.credit_account_id || null,
      }));

      const {error:detailError}=await supabase
        .from("inventory_opening_balance_items")
        .insert(detailRows);

      if (detailError) throw detailError;

      alert(editing
        ? "Draft Saldo Awal berhasil diperbarui."
        : "Draft Saldo Awal berhasil disimpan.");

      closeForm();
      await loadDocuments();
    } catch (error) {
      console.error("Save opening balance error:",error);
      alert(error instanceof Error ? error.message : "Gagal menyimpan Saldo Awal.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete=async(document:Document)=>{
    if (document.status!=="DRAFT") {
      alert("Hanya Draft yang dapat dihapus.");
      return;
    }

    if (!window.confirm(`Hapus Saldo Awal ${document.opening_number}?`)) return;

    try {
      const {error:detailError}=await supabase
        .from("inventory_opening_balance_items")
        .delete()
        .eq("opening_balance_id",document.id);

      if (detailError) throw detailError;

      const {error:headerError}=await supabase
        .from("inventory_opening_balances")
        .delete()
        .eq("id",document.id);

      if (headerError) throw headerError;

      await loadDocuments();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal menghapus Saldo Awal.");
    }
  };

  /*
  * =================================
  * POST
  * =================================
  */
  const handlePost = async (
    document: typeof documents[number]
  ): Promise<void> => {
    if (document.status !== "DRAFT") {
      return;
    }

    const confirmed = window.confirm(
      `Posting Saldo Awal ${document.opening_number}?\n\n` +
      "Setelah diposting, dokumen tidak dapat diedit."
    );

    if (!confirmed) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc(
        "post_inventory_opening_balance",
        {
          p_opening_balance_id: document.id,
          p_posted_by: customUserId,
        }
      );

      if (error) {
        console.error(
          "Post opening balance RPC error:",
          error
        );

        const errorMessage =
          typeof error.message === "string" &&
          error.message.trim() !== ""
            ? error.message
            : "Gagal posting Saldo Awal.";

        alert(errorMessage);
        return;
      }

      console.log(
        "Opening balance post result:",
        data
      );

      if (
        typeof data === "object" &&
        data !== null &&
        !Array.isArray(data) &&
        "success" in data &&
        data.success === false
      ) {
        const errorMessage =
          "message" in data &&
          typeof data.message === "string"
            ? data.message
            : "Gagal posting Saldo Awal.";

        alert(errorMessage);
        return;
      }

      const successMessage =
        typeof data === "object" &&
        data !== null &&
        !Array.isArray(data) &&
        "message" in data &&
        typeof data.message === "string"
          ? data.message
          : "Saldo Awal berhasil diposting.";

      alert(successMessage);

      await loadDocuments();

    } catch (error: unknown) {
      console.error(
        "Post opening balance error:",
        error
      );

      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.trim() !== ""
          ? error.message
          : "Gagal posting Saldo Awal.";

      alert(errorMessage);
    }
  };

  const changeFilter=(setter:(value:string)=>void,value:string)=>{
    setter(value);
    resetPage();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            Saldo Awal Stok
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Input saldo stok awal sebelum transaksi inventory berjalan.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={()=>void loadDocuments()}
            className="rounded border px-4 py-2 hover:bg-slate-50"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreate}
            disabled={loadingMasters || !entityId}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18}/>
            Tambah Saldo Awal
          </button>
        </div>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-lg border bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                {viewOnly ? "Detail Saldo Awal" : editing ? "Edit Saldo Awal" : "Tambah Saldo Awal"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Debit otomatis mengikuti akun persediaan artikel/kategori. Pilih artikel, isi qty dan harga, lalu pilih akun kredit.
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              className="rounded border px-4 py-2 hover:bg-slate-50"
            >
              Tutup
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Store</label>
              <SearchableSelect
                options={storeOptions}
                value={form.store_id}
                onChange={(value)=>void handleFormStoreChange(value)}
                placeholder="Pilih Store..."
                disabled={viewOnly || Boolean(editing)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Nomor Saldo Awal</label>
              <input
                type="text"
                value={form.opening_number}
                readOnly
                placeholder="Otomatis setelah Store dipilih"
                className="w-full rounded border bg-slate-50 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Tanggal</label>
              <DateInput
                value={form.opening_date}
                disabled={viewOnly}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    opening_date: value,
                  }))
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Catatan</label>
              <input
                type="text"
                value={form.notes}
                disabled={viewOnly}
                placeholder="Catatan"
                onChange={(event)=>setForm(current=>({
                  ...current, notes:event.target.value,
                }))}
                className="w-full rounded border px-3 py-2 disabled:bg-slate-50"
              />
            </div>
          </div>

          {!viewOnly && (
            <div className="rounded-lg border p-4">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-slate-800">
                  Input Artikel Saldo Awal
                </h3>
                <p className="text-sm text-slate-500">
                  Pilih artikel, isi qty dan harga, pilih akun kredit, lalu klik tombol tambah.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <label className="mb-1 block text-sm font-medium">Artikel</label>
                  <SearchableSelect
                    options={itemOptions}
                    value={selectedItemId}
                    onChange={(value) => {
                      setSelectedItemId(value);

                      const item =
                        items.find(
                          (current) =>
                            current.id === value
                        );

                      if (
                        item &&
                        !inputPrice &&
                        numberValue(item.standard_cost) > 0
                      ) {
                        setInputPrice(
                          String(
                            numberValue(
                              item.standard_cost
                            )
                          )
                        );
                      }
                    }}
                    placeholder="Cari kode atau nama artikel..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Qty
                  </label>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputQty}
                    onChange={(
                      event: React.ChangeEvent<HTMLInputElement>
                    ) => {
                      setInputQty(event.target.value);
                    }}
                    className="w-full rounded border px-3 py-2 text-right"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Harga
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(inputPrice)}
                    onChange={(
                      event: React.ChangeEvent<HTMLInputElement>
                    ) => {
                      const value = parseNumberInput(event.target.value);

                      setInputPrice(
                        value === 0
                          ? ""
                          : String(value)
                      );
                    }}
                    className="w-full rounded border px-3 py-2 text-right"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="mb-1 block text-sm font-medium">Akun Kredit</label>
                  <SearchableSelect
                    value={inputCreditAccountId}
                    options={accountOptions}
                    placeholder="Cari akun..."
                    emptyMessage="Akun tidak ditemukan."
                    onChange={setInputCreditAccountId}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addOpeningBalanceLine}
                    className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    <Plus size={18}/>
                    Tambah
                  </button>
                </div>
              </div>

              {accounts.length===0 && !loadingMasters && (
                <p className="mt-2 text-sm text-red-600">
                  Tidak ada akun posting aktif untuk entity ini. Pastikan COA akun kredit sudah aktif dan is_posting = true.
                </p>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-3 py-3 text-center">No</th>
                  <th className="border-b px-3 py-3 text-left">Artikel</th>
                  <th className="border-b px-3 py-3 text-right">Qty</th>
                  <th className="border-b px-3 py-3 text-right">Harga</th>
                  <th className="border-b px-3 py-3 text-right">Total</th>
                  <th className="border-b px-3 py-3 text-left">Akun Kredit</th>
                  <th className="border-b px-3 py-3 text-center">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {form.details.length===0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Belum ada artikel.
                    </td>
                  </tr>
                ) : form.details.map((row,index)=>{
                  const item=row.item ?? items.find(current=>current.id===row.item_id);
                  const account=accounts.find(current=>current.id===row.credit_account_id);

                  return (
                    <tr key={row.id ?? `line-${index}`}>
                      <td className="border-b px-3 py-3 text-center">{index+1}</td>
                      <td className="border-b px-3 py-3">
                        {item ? `${item.code ?? "-"} - ${item.name}` : "-"}
                      </td>
                      <td className="border-b px-3 py-3 text-right">
                        {formatNumber(numberValue(row.quantity))}
                      </td>
                      <td className="border-b px-3 py-3 text-right">
                        {formatMoney(numberValue(row.unit_price))}
                      </td>
                      <td className="border-b px-3 py-3 text-right font-medium">
                        {formatMoney(numberValue(row.quantity)*numberValue(row.unit_price))}
                      </td>
                      <td className="border-b px-3 py-3">
                        {account ? `${account.code} - ${account.name}` : "-"}
                      </td>
                      <td className="border-b px-3 py-3 text-center">
                        {!viewOnly && (
                          <button
                            type="button"
                            title="Hapus baris"
                            onClick={()=>removeLine(index)}
                            className="rounded p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={17}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {form.details.length>0 && (
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={2} className="px-3 py-3 text-right">Total</td>
                    <td className="px-3 py-3 text-right">
                      {formatNumber(totalQuantity)}
                    </td>
                    <td/>
                    <td className="px-3 py-3 text-right">
                      {formatMoney(totalAmount)}
                    </td>
                    <td colSpan={2}/>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={closeForm}
              className="rounded border px-4 py-2 hover:bg-slate-50"
            >
              {viewOnly ? "Tutup" : "Batal"}
            </button>

            {!viewOnly && (
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan Draft"}
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
            <SearchableSelect
              options={[{value:"",label:"Semua Store"},...storeOptions]}
              value={selectedStore}
              onChange={(value)=>changeFilter(setSelectedStore,value)}
              placeholder="Semua Store"
            />

            <DateInput
              value={startDate}
              onChange={(value) => changeFilter(setStartDate, value)}
            />

            <DateInput
              value={endDate}
              onChange={(value) => changeFilter(setEndDate, value)}
            />

            <input
              type="search"
              value={search}
              onChange={(event)=>changeFilter(setSearch,event.target.value)}
              placeholder="Cari nomor atau keterangan..."
              className="rounded border px-3 py-2"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-3 py-3 text-left">Nomor Saldo Awal</th>
                  <th className="border-b px-3 py-3 text-left">Tanggal</th>
                  <th className="border-b px-3 py-3 text-left">Store</th>
                  <th className="border-b px-3 py-3 text-left">Keterangan</th>
                  <th className="border-b px-3 py-3 text-center">Status</th>
                  <th className="border-b px-3 py-3 text-center">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Memuat data...
                  </td></tr>
                ) : documents.length===0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Belum ada data Saldo Awal.
                  </td></tr>
                ) : documents.map(document=>(
                  <tr key={document.id}>
                    <td className="border-b px-3 py-3 font-medium">{document.opening_number}</td>
                    <td className="border-b px-3 py-3">{document.opening_date}</td>
                    <td className="border-b px-3 py-3">
                      {document.store ? `${document.store.code} - ${document.store.name}` : "-"}
                    </td>
                    <td className="border-b px-3 py-3">{document.notes || "-"}</td>
                    <td className="border-b px-3 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass[document.status]}`}>
                        {statusLabel[document.status]}
                      </span>
                    </td>
                    <td className="border-b px-3 py-3">
                      <div className="flex justify-center gap-1">
                        <button
                          type="button"
                          title="Lihat"
                          onClick={()=>void openView(document)}
                          className="rounded p-2 text-slate-600 hover:bg-slate-100"
                        >
                          <Eye size={17}/>
                        </button>

                        {document.status==="DRAFT" && (
                          <>
                            <button
                              type="button"
                              title="Edit"
                              onClick={()=>void openEdit(document)}
                              className="rounded p-2 text-blue-600 hover:bg-blue-50"
                            >
                              <Pencil size={17}/>
                            </button>

                            <button
                              type="button"
                              title="Posting"
                              onClick={()=>void handlePost(document)}
                              className="rounded p-2 text-green-600 hover:bg-green-50"
                            >
                              <Check size={17}/>
                            </button>

                            <button
                              type="button"
                              title="Hapus"
                              onClick={()=>void handleDelete(document)}
                              className="rounded p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={17}/>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            meta={paginationMeta}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}
