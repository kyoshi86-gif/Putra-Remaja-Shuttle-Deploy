  import { useEffect, useMemo, useState } from "react";

  import DateInput from "@/components/common/DateInput";
  import SearchableSelect, {
    type SearchableSelectOption,
  } from "@/components/common/SearchableSelect";

  import type {
    AccountOption,
    StockOpnameLine,
    StockRow,
    StoreOption,
    TransactionKind,
  } from "../types";

  interface InventoryTransactionModalProps {
    open: boolean;

    stores: StoreOption[];
    accounts: AccountOption[];
    stocks: StockRow[];

    transaction: {
      transactionKind: TransactionKind | null;

      transactionStockId: string;
      fromStoreId: string;
      toStoreId: string;
      targetStoreId: string;
      transactionDate: string;
      transactionQty: string;
      offsetAccountId: string;
      reference: string;
      transactionNotes: string;

      setTransactionKind(value: TransactionKind | null): void;
      setTransactionStockId(value: string): void;

      setFromStoreId(value: string): void;
      handleFromStoreChange(value: string): void;

      setToStoreId(value: string): void;

      setTargetStoreId(value: string): void;
      handleTargetStoreChange(value: string): void;

      setTransactionDate(value: string): void;
      setTransactionQty(value: string): void;

      lines: StockOpnameLine[];
      setLines(value: StockOpnameLine[]): void;

      addLine(): void;
      removeLine(id: string): void;

      updateLine(id: string, field: keyof StockOpnameLine, value: string): void;

      setOffsetAccountId(value: string): void;
      setReference(value: string): void;
      setTransactionNotes(value: string): void;

      postingTransaction: boolean;

      postTransaction(): Promise<void>;
      resetForm(): void;
    };

    onClose(): void;
  }

  export default function InventoryTransactionModal({
    open,
    stocks,
    stores,
    accounts,
    transaction,
    onClose,
  }: InventoryTransactionModalProps) {
    const [selectedStockId, setSelectedStockId] = useState("");

    const [transferQty, setTransferQty] = useState("");

    const selectedStock = useMemo(
      () => stocks.find((stock) => stock.id === selectedStockId) ?? null,
      [stocks, selectedStockId],
    );

    const title =
      transaction.transactionKind === "TRANSFER"
        ? "Transfer Stok"
        : transaction.transactionKind === "OPNAME"
          ? "Stock Opname"
          : "Adjustment Persediaan";

    /*
    * =====================================================
    * RESET INPUT SAAT STORE BERUBAH
    * =====================================================
    */

    useEffect(() => {
      setSelectedStockId("");
      setTransferQty("");
    }, [transaction.fromStoreId, transaction.targetStoreId]);

    
    /*
    * =====================================================
    * STOCK YANG TERSEDIA UNTUK MASING-MASING TRANSAKSI
    * =====================================================
    */

    const availableStocks = useMemo(() => {
      if (transaction.transactionKind === "TRANSFER") {
        return stocks.filter(
          (stock) => stock.store_id === transaction.fromStoreId,
        );
      }

      return stocks.filter(
        (stock) => stock.store_id === transaction.targetStoreId,
      );
    }, [
      stocks,
      transaction.transactionKind,
      transaction.fromStoreId,
      transaction.targetStoreId,
    ]);

    /*
    * =====================================================
    * OPTIONS ARTIKEL
    * =====================================================
    */

    const itemOptions = useMemo<SearchableSelectOption[]>(
      () =>
        availableStocks.map((stock) => ({
          value: stock.id,

          label: `${stock.item_code} - ` + stock.item_name,

          searchText: [
            stock.item_code,
            stock.item_name,
            `Stok ${stock.quantity_on_hand}`,
          ].join(" "),
        })),
      [availableStocks],
    );

    /*
    * =====================================================
    * OPTIONS ACCOUNT
    * =====================================================
    */

    const accountOptions = useMemo<SearchableSelectOption[]>(
      () =>
        accounts.map((account) => ({
          value: account.id,

          label: `${account.code} - ${account.name}`,

          searchText: `${account.code} ${account.name}`,
        })),
      [accounts],
    );

    /*
    * =====================================================
    * RESET INPUT BARIS
    * =====================================================
    */

    const resetLineInput = () => {
      setSelectedStockId("");
      setTransferQty("");
    };

    /*
    * =====================================================
    * TAMBAH TRANSFER
    * =====================================================
    */

    const addTransferLine = (): void => {
      if (!selectedStock) {
        window.alert("Pilih artikel.");
        return;
      }

      if (transferQty.trim() === "") {
        window.alert("Qty wajib diisi.");
        return;
      }

      const quantity = parseQuantityInput(transferQty);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        window.alert(
          "Qty harus lebih besar dari 0.",
        );
        return;
      }

      const alreadyExists =
        transaction.lines.some(
          (line) =>
            line.stockId === selectedStock.id,
        );

      if (alreadyExists) {
        window.alert(
          "Artikel tersebut sudah ditambahkan.",
        );
        return;
      }

      const newLine: StockOpnameLine = {
        id: crypto.randomUUID(),
        stockId: selectedStock.id,
        qty: String(quantity),
        accountId: "",
      };

      transaction.setLines([
        ...transaction.lines.filter(
          (line) => line.stockId !== "",
        ),
        newLine,
      ]);

      resetLineInput();
    };

    /*
    * =====================================================
    * TAMBAH STOCK OPNAME
    * Qty fisik BOLEH 0
    * =====================================================
    */

    const addOpnameLine = (): void => {
      if (!selectedStock) {
        window.alert("Pilih artikel.");
        return;
      }

      if (transferQty.trim() === "") {
        window.alert(
          "Qty fisik wajib diisi.",
        );
        return;
      }

      const actualQty =
        parseQuantityInput(transferQty);

      if (
        !Number.isFinite(actualQty) ||
        actualQty < 0
      ) {
        window.alert(
          "Qty fisik harus bernilai 0 atau lebih.",
        );
        return;
      }

      if (!transaction.offsetAccountId) {
        window.alert("Pilih akun.");
        return;
      }

      const alreadyExists =
        transaction.lines.some(
          (line) =>
            line.stockId === selectedStock.id,
        );

      if (alreadyExists) {
        window.alert(
          "Artikel tersebut sudah ditambahkan.",
        );
        return;
      }

      const newLine: StockOpnameLine = {
        id: crypto.randomUUID(),
        stockId: selectedStock.id,
        qty: String(actualQty),
        accountId:
          transaction.offsetAccountId,
      };

      transaction.setLines([
        ...transaction.lines.filter(
          (line) => line.stockId !== "",
        ),
        newLine,
      ]);

      resetLineInput();
    };

    /*
    * =====================================================
    * TAMBAH ADJUSTMENT
    * =====================================================
    */

    const addAdjustmentLine = (): void => {
      if (!selectedStock) {
        window.alert("Pilih artikel.");
        return;
      }

      if (transferQty.trim() === "") {
        window.alert("Qty wajib diisi.");
        return;
      }

      const quantity =
        parseQuantityInput(transferQty);

      if (
        !Number.isFinite(quantity) ||
        quantity < 0
      ) {
        window.alert(
          "Qty harus bernilai 0 atau lebih.",
        );
        return;
      }

      if (!transaction.offsetAccountId) {
        window.alert("Pilih akun.");
        return;
      }

      const alreadyExists =
        transaction.lines.some(
          (line) =>
            line.stockId === selectedStock.id,
        );

      if (alreadyExists) {
        window.alert(
          "Artikel tersebut sudah ditambahkan.",
        );
        return;
      }

      const newLine: StockOpnameLine = {
        id: crypto.randomUUID(),
        stockId: selectedStock.id,
        qty: String(quantity),
        accountId:
          transaction.offsetAccountId,
      };

      transaction.setLines([
        ...transaction.lines.filter(
          (line) => line.stockId !== "",
        ),
        newLine,
      ]);

      resetLineInput();
    };


    const parseQuantityInput = (
      value: string,
    ): number => {
      const normalized = value
        .trim()
        .replace(",", ".");

      const numberValue = Number(normalized);

      return Number.isFinite(numberValue)
        ? numberValue
        : Number.NaN;
    };

    /*
    * =====================================================
    * TUTUP MODAL
    * =====================================================
    */

    const handleClose = (): void => {
      resetLineInput();
      transaction.resetForm();
      onClose();
    };

    /*
    * =====================================================
    * POST
    * =====================================================
    */

    const handlePost = async (): Promise<void> => {
      await transaction.postTransaction();
    };

    /*
    * =====================================================
    * JIKA MODAL TIDAK TERBUKA
    * =====================================================
    */

    if (!open) {
      return null;
    }

    const formatQuantity = (
      value: string | number | null | undefined,
    ): string => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return "";
      }

      const numericValue = Number(value);

      if (!Number.isFinite(numericValue)) {
        return "";
      }

      return new Intl.NumberFormat(
        "id-ID",
        {
          maximumFractionDigits: 4,
        },
      ).format(numericValue);
    };

    return (
      <div
        className="
          fixed
          inset-0
          z-50
          overflow-y-auto
          bg-black/50
          p-4
        "
      >
        {/*
        * items-start + padding top
        * membuat modal sedikit turun
        * dan tidak mepet bagian atas.
        */}

        <div
          className="
            flex
            min-h-full
            items-start
            justify-center
            pt-8
            pb-8
            md:pt-12
          "
        >
          <div
            className="
              flex
              w-full
              max-w-6xl
              max-h-[90vh]
              flex-col
              overflow-hidden
              rounded-xl
              bg-white
              shadow-2xl
            "
          >
            {/* ========================================= */}
            {/* HEADER */}
            {/* ========================================= */}

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                px-6
                py-4
              "
            >
              <div>
                <h2
                  className="
                    text-xl
                    font-semibold
                  "
                >
                  {title}
                </h2>

                <p
                  className="
                    mt-1
                    text-sm
                    text-gray-500
                  "
                >
                  Posting transaksi persediaan.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="
                  rounded-lg
                  border
                  px-4
                  py-2
                  text-lg
                  hover:bg-gray-50
                "
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            {/* ========================================= */}
            {/* BODY */}
            {/* ========================================= */}

            <div
              className="
                flex-1
                space-y-5
                overflow-y-auto
                p-6
              "
            >
              {/* ===================================== */}
              {/* JENIS TRANSAKSI */}
              {/* ===================================== */}

              <div>
                <label
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                  "
                >
                  Jenis Transaksi
                </label>

                <input
                  value={title}
                  readOnly
                  className="
                    w-full
                    rounded-md
                    border
                    bg-gray-100
                    px-3
                    py-2
                  "
                />
              </div>

              {/* ===================================== */}
              {/* TANGGAL + REFERENSI */}
              {/* ===================================== */}

              <div
                className="
                  grid
                  gap-4
                  md:grid-cols-2
                "
              >
                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-medium
                    "
                  >
                    Tanggal
                  </label>

                  <DateInput
                    value={transaction.transactionDate}
                    onChange={transaction.setTransactionDate}
                    className="
                      w-full
                    "
                  />
                </div>

                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-medium
                    "
                  >
                    Nomor Referensi
                  </label>

                  <input
                    type="text"
                    value={transaction.reference}
                    onChange={(event) =>
                      transaction.setReference(event.target.value)
                    }
                    placeholder="Optional"
                    className="
                      w-full
                      rounded-md
                      border
                      px-3
                      py-2
                    "
                  />
                </div>
              </div>

              {/* ===================================== */}
              {/* TRANSFER */}
              {/* ===================================== */}

              {transaction.transactionKind === "TRANSFER" && (
                <div
                  className="
                    space-y-4
                    rounded-lg
                    border
                    bg-slate-50
                    p-4
                  "
                >
                  <div
                    className="
                      grid
                      gap-4
                      md:grid-cols-2
                    "
                  >
                    {/* STORE ASAL */}

                    <div>
                      <label
                        className="
                          mb-2
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Store Asal
                      </label>

                      <select
                        value={transaction.fromStoreId}
                        onChange={(event) =>
                          transaction.handleFromStoreChange(event.target.value)
                        }
                        className="
                          w-full
                          rounded-md
                          border
                          px-3
                          py-2
                        "
                      >
                        <option value="">-- Pilih Store Asal --</option>

                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.code} - {store.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* STORE TUJUAN */}

                    <div>
                      <label
                        className="
                          mb-2
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Store Tujuan
                      </label>

                      <select
                        value={transaction.targetStoreId}
                        onChange={(event) =>
                          transaction.handleTargetStoreChange(event.target.value)
                        }
                        className="
                          w-full
                          rounded-md
                          border
                          px-3
                          py-2
                        "
                      >
                        <option value="">-- Pilih Store Tujuan --</option>

                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.code} - {store.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <h3
                      className="
                        text-base
                        font-semibold
                      "
                    >
                      Input Artikel Transfer
                    </h3>
                  </div>

                  {/* INPUT BARIS */}

                  <div
                    className="
                      grid
                      grid-cols-1
                      items-end
                      gap-3
                      md:grid-cols-12
                    "
                  >
                    {/* ARTIKEL */}

                    <div
                      className="
                        md:col-span-6
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Artikel
                      </label>

                      <SearchableSelect
                        value={selectedStockId}
                        options={itemOptions}
                        disabled={!transaction.fromStoreId}
                        placeholder="Cari kode atau nama artikel..."
                        emptyMessage={
                          transaction.fromStoreId
                            ? "Artikel tidak ditemukan."
                            : "Pilih Store Asal terlebih dahulu."
                        }
                        onChange={setSelectedStockId}
                      />
                    </div>

                    {/* STOK */}

                    <div
                      className="
                        md:col-span-2
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Stok
                      </label>

                      <input
                        type="text"
                        readOnly
                        value={
                          selectedStock
                            ? formatQuantity(
                                selectedStock.quantity_on_hand,
                              )
                            : ""
                        }
                        className="
                          w-full
                          rounded
                          border
                          bg-gray-100
                          px-3
                          py-2
                          text-right
                        "
                      />
                    </div>

                    {/* QTY */}

                    <div
                      className="
                        md:col-span-2
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Qty
                      </label>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={transferQty}
                        onChange={(
                          event: React.ChangeEvent<HTMLInputElement>
                        ) => {
                          setTransferQty(event.target.value);
                        }}
                        className="
                          w-full
                          rounded
                          border
                          px-3
                          py-2
                          text-right
                        "
                      />
                    </div>

                    {/* TAMBAH */}

                    <div
                      className="
                        md:col-span-2
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        &nbsp;
                      </label>

                      <button
                        type="button"
                        onClick={addTransferLine}
                        className="
                          w-full
                          rounded
                          bg-blue-600
                          py-2
                          text-white
                          hover:bg-blue-700
                        "
                      >
                        + Tambah
                      </button>
                    </div>
                  </div>

                  {/* TABLE */}

                  <div
                    className="
                      overflow-x-auto
                    "
                  >
                    <table
                      className="
                        w-full
                        border
                      "
                    >
                      <thead>
                        <tr
                          className="
                            bg-gray-100
                          "
                        >
                          <th
                            className="
                              w-14
                              border
                              p-2
                            "
                          >
                            No
                          </th>

                          <th
                            className="
                              border
                              p-2
                            "
                          >
                            Artikel
                          </th>

                          <th
                            className="
                              border
                              p-2
                              text-right
                            "
                          >
                            Stok
                          </th>

                          <th
                            className="
                              border
                              p-2
                              text-right
                            "
                          >
                            Qty Transfer
                          </th>

                          <th
                            className="
                              w-24
                              border
                              p-2
                            "
                          >
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {transaction.lines.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="
                                border
                                p-4
                                text-center
                                text-gray-500
                              "
                            >
                              Belum ada artikel.
                            </td>
                          </tr>
                        ) : (
                          transaction.lines.map((line, index) => {
                            const stock = stocks.find(
                              (item) => item.id === line.stockId,
                            );

                            return (
                              <tr key={line.id}>
                                <td
                                  className="
                                      border
                                      p-2
                                      text-center
                                    "
                                >
                                  {index + 1}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                    "
                                >
                                  {stock
                                    ? `${stock.item_code} - ${stock.item_name}`
                                    : "-"}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                      text-right
                                    "
                                >
                                  {stock
                                    ? formatQuantity(
                                        stock.quantity_on_hand,
                                      )
                                    : "-"}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                      text-right
                                    "
                                >
                                  {formatQuantity(line.qty)}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                      text-center
                                    "
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      transaction.removeLine(line.id)
                                    }
                                    className="
                                        rounded
                                        bg-red-500
                                        px-3
                                        py-1
                                        text-white
                                      "
                                  >
                                    Hapus
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* STOCK OPNAME */}
              {/* ===================================== */}

              {transaction.transactionKind === "OPNAME" && (
                <div
                  className="
                    space-y-4
                    rounded-lg
                    border
                    bg-slate-50
                    p-4
                  "
                >
                  {/* STORE */}

                  <div>
                    <label
                      className="
                        mb-2
                        block
                        text-sm
                        font-medium
                      "
                    >
                      Store / Gudang
                    </label>

                    <select
                      value={transaction.targetStoreId}
                      onChange={(event) =>
                        transaction.handleTargetStoreChange(event.target.value)
                      }
                      className="
                        w-full
                        rounded-md
                        border
                        px-3
                        py-2
                      "
                    >
                      <option value="">-- Pilih Store --</option>

                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.code} - {store.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <h3
                    className="
                      text-base
                      font-semibold
                    "
                  >
                    Input Artikel Stock Opname
                  </h3>

                  {/* INPUT */}

                  <div
                    className="
                      grid
                      grid-cols-1
                      items-end
                      gap-3
                      md:grid-cols-12
                    "
                  >
                    {/* ARTIKEL */}

                    <div
                      className="
                        md:col-span-4
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Artikel
                      </label>

                      <SearchableSelect
                        value={selectedStockId}
                        options={itemOptions}
                        disabled={!transaction.targetStoreId}
                        placeholder="Cari kode atau nama artikel..."
                        emptyMessage={
                          transaction.targetStoreId
                            ? "Artikel tidak ditemukan."
                            : "Pilih Store terlebih dahulu."
                        }
                        onChange={setSelectedStockId}
                      />
                    </div>

                    {/* STOK */}

                    <div
                      className="
                        md:col-span-1
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Stok
                      </label>

                      <input
                        type="text"
                        readOnly
                        value={
                          selectedStock
                            ? formatQuantity(
                                selectedStock.quantity_on_hand,
                              )
                            : ""
                        }
                        className="
                          w-full
                          rounded
                          border
                          bg-gray-100
                          px-3
                          py-2
                          text-right
                        "
                      />
                    </div>

                    {/* QTY FISIK */}

                    <div
                      className="
                        md:col-span-1
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Qty Fisik
                      </label>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={transferQty}
                        onChange={(
                          event: React.ChangeEvent<HTMLInputElement>
                        ) => {
                          setTransferQty(event.target.value);
                        }}
                        className="
                          w-full
                          rounded
                          border
                          px-3
                          py-2
                          text-right
                        "
                      />
                    </div>

                    {/* AKUN */}

                    <div
                      className="
                        md:col-span-4
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Akun
                      </label>

                      <SearchableSelect
                        value={transaction.offsetAccountId}
                        options={accountOptions}
                        placeholder="Pilih atau cari akun..."
                        emptyMessage={"Tidak ada akun aktif."}
                        onChange={transaction.setOffsetAccountId}
                      />
                    </div>

                    {/* TAMBAH */}

                    <div
                      className="
                        md:col-span-2
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Tambah
                      </label>

                      <button
                        type="button"
                        onClick={addOpnameLine}
                        className="
                          w-full
                          rounded
                          bg-blue-600
                          py-2
                          text-white
                          hover:bg-blue-700
                        "
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* TABLE */}

                  <div
                    className="
                      overflow-x-auto
                    "
                  >
                    <table
                      className="
                        w-full
                        border
                      "
                    >
                      <thead>
                        <tr
                          className="
                            bg-gray-100
                          "
                        >
                          <th
                            className="
                              w-14
                              border
                              p-2
                            "
                          >
                            No
                          </th>

                          <th
                            className="
                              border
                              p-2
                            "
                          >
                            Artikel
                          </th>

                          <th
                            className="
                              border
                              p-2
                              text-right
                            "
                          >
                            Stok
                          </th>

                          <th
                            className="
                              border
                              p-2
                              text-right
                            "
                          >
                            Qty Fisik
                          </th>

                          <th
                            className="
                              border
                              p-2
                            "
                          >
                            Akun
                          </th>

                          <th
                            className="
                              w-24
                              border
                              p-2
                            "
                          >
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {transaction.lines.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="
                                border
                                p-4
                                text-center
                                text-gray-500
                              "
                            >
                              Belum ada artikel.
                            </td>
                          </tr>
                        ) : (
                          transaction.lines.map((line, index) => {
                            const stock = stocks.find(
                              (item) => item.id === line.stockId,
                            );

                            const account = accounts.find(
                              (item) => item.id === line.accountId,
                            );

                            return (
                              <tr key={line.id}>
                                <td
                                  className="
                                      border
                                      p-2
                                      text-center
                                    "
                                >
                                  {index + 1}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                    "
                                >
                                  {stock
                                    ? `${stock.item_code} - ${stock.item_name}`
                                    : "-"}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                      text-right
                                    "
                                >
                                  {stock
                                    ? formatQuantity(
                                        stock.quantity_on_hand,
                                      )
                                    : "-"}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                      text-right
                                    "
                                >
                                  {formatQuantity(line.qty)}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                    "
                                >
                                  {account
                                    ? `${account.code} - ${account.name}`
                                    : "-"}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                      text-center
                                    "
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      transaction.removeLine(line.id)
                                    }
                                    className="
                                        rounded
                                        bg-red-500
                                        px-3
                                        py-1
                                        text-white
                                      "
                                  >
                                    Hapus
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div
                    className="
                      rounded-lg
                      bg-amber-50
                      p-3
                      text-sm
                      text-amber-700
                    "
                  >
                    Qty Fisik adalah jumlah persediaan hasil stock opname. Nilai{" "}
                    <strong>0</strong> dapat digunakan apabila stok fisik habis.
                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* ADJUSTMENT */}
              {/* ===================================== */}

              {transaction.transactionKind === "ADJUSTMENT" && (
                <div
                  className="
                    space-y-4
                    rounded-lg
                    border
                    bg-slate-50
                    p-4
                  "
                >
                  {/* STORE */}

                  <div>
                    <label
                      className="
                        mb-2
                        block
                        text-sm
                        font-medium
                      "
                    >
                      Store / Gudang
                    </label>

                    <select
                      value={transaction.targetStoreId}
                      onChange={(event) =>
                        transaction.handleTargetStoreChange(event.target.value)
                      }
                      className="
                        w-full
                        rounded-md
                        border
                        px-3
                        py-2
                      "
                    >
                      <option value="">-- Pilih Store --</option>

                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.code} - {store.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <h3
                    className="
                      text-base
                      font-semibold
                    "
                  >
                    Input Artikel Adjustment
                  </h3>

                  {/* INPUT */}

                  <div
                    className="
                      grid
                      grid-cols-1
                      items-end
                      gap-3
                      md:grid-cols-12
                    "
                  >
                    {/* ARTIKEL */}

                    <div
                      className="
                        md:col-span-4
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Artikel
                      </label>

                      <SearchableSelect
                        value={selectedStockId}
                        options={itemOptions}
                        disabled={!transaction.targetStoreId}
                        placeholder="Cari kode atau nama artikel..."
                        emptyMessage={
                          transaction.targetStoreId
                            ? "Artikel tidak ditemukan."
                            : "Pilih Store terlebih dahulu."
                        }
                        onChange={setSelectedStockId}
                      />
                    </div>

                    {/* STOK */}

                    <div
                      className="
                        md:col-span-1
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Stok
                      </label>

                      <input
                        type="text"
                        readOnly
                        value={
                          selectedStock
                            ? formatQuantity(
                                selectedStock.quantity_on_hand,
                              )
                            : ""
                        }
                        className="
                          w-full
                          rounded
                          border
                          bg-gray-100
                          px-3
                          py-2
                          text-right
                        "
                      />
                    </div>

                    {/* QTY */}

                    <div
                      className="
                        md:col-span-1
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Qty Aktual
                      </label>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={transferQty}
                        onChange={(
                          event: React.ChangeEvent<HTMLInputElement>
                        ) => {
                          setTransferQty(event.target.value);
                        }}
                        className="
                          w-full
                          rounded
                          border
                          px-3
                          py-2
                          text-right
                        "
                      />
                    </div>

                    {/* AKUN */}

                    <div
                      className="
                        md:col-span-4
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Akun
                      </label>

                      <SearchableSelect
                        value={transaction.offsetAccountId}
                        options={accountOptions}
                        placeholder="Pilih atau cari akun..."
                        emptyMessage={"Tidak ada akun aktif."}
                        onChange={transaction.setOffsetAccountId}
                      />
                    </div>

                    {/* TAMBAH */}

                    <div
                      className="
                        md:col-span-2
                      "
                    >
                      <label
                        className="
                          mb-1
                          block
                          text-sm
                          font-medium
                        "
                      >
                        Tambah
                      </label>

                      <button
                        type="button"
                        onClick={addAdjustmentLine}
                        className="
                          w-full
                          rounded
                          bg-blue-600
                          py-2
                          text-white
                          hover:bg-blue-700
                        "
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* TABLE */}

                  <div
                    className="
                      overflow-x-auto
                    "
                  >
                    <table
                      className="
                        w-full
                        border
                      "
                    >
                      <thead>
                        <tr
                          className="
                            bg-gray-100
                          "
                        >
                          <th
                            className="
                              w-14
                              border
                              p-2
                            "
                          >
                            No
                          </th>

                          <th
                            className="
                              border
                              p-2
                            "
                          >
                            Artikel
                          </th>

                          <th
                            className="
                              border
                              p-2
                              text-right
                            "
                          >
                            Stok
                          </th>

                          <th
                            className="
                              border
                              p-2
                              text-right
                            "
                          >
                            Qty Aktual
                          </th>

                          <th
                            className="
                              border
                              p-2
                            "
                          >
                            Akun
                          </th>

                          <th
                            className="
                              w-24
                              border
                              p-2
                            "
                          >
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {transaction.lines.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="
                                border
                                p-4
                                text-center
                                text-gray-500
                              "
                            >
                              Belum ada artikel.
                            </td>
                          </tr>
                        ) : (
                          transaction.lines.map((line, index) => {
                            const stock = stocks.find(
                              (item) => item.id === line.stockId,
                            );

                            const account = accounts.find(
                              (item) => item.id === line.accountId,
                            );

                            return (
                              <tr key={line.id}>
                                <td
                                  className="
                                      border
                                      p-2
                                      text-center
                                    "
                                >
                                  {index + 1}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                    "
                                >
                                  {stock
                                    ? `${stock.item_code} - ${stock.item_name}`
                                    : "-"}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                      text-right
                                    "
                                >
                                  {stock
                                    ? formatQuantity(
                                        stock.quantity_on_hand,
                                      )
                                    : "-"}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                      text-right
                                    "
                                >
                                  {line.qty}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                    "
                                >
                                  {account
                                    ? `${account.code} - ${account.name}`
                                    : "-"}
                                </td>

                                <td
                                  className="
                                      border
                                      p-2
                                      text-center
                                    "
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      transaction.removeLine(line.id)
                                    }
                                    className="
                                        rounded
                                        bg-red-500
                                        px-3
                                        py-1
                                        text-white
                                      "
                                  >
                                    Hapus
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* CATATAN */}
              {/* ===================================== */}

              <div>
                <label
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                  "
                >
                  Catatan
                </label>

                <textarea
                  value={transaction.transactionNotes}
                  onChange={(event) =>
                    transaction.setTransactionNotes(event.target.value)
                  }
                  rows={3}
                  placeholder="Catatan transaksi..."
                  className="
                    w-full
                    rounded-md
                    border
                    px-3
                    py-2
                  "
                />
              </div>
            </div>

            {/* ========================================= */}
            {/* FOOTER */}
            {/* ========================================= */}

            <div
              className="
                flex
                flex-col-reverse
                justify-end
                gap-2
                border-t
                bg-white
                px-6
                py-4
                sm:flex-row
              "
            >
              <button
                type="button"
                onClick={handleClose}
                disabled={transaction.postingTransaction}
                className="
                  rounded
                  border
                  px-5
                  py-2
                  hover:bg-gray-50
                  disabled:opacity-50
                "
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => {
                  void handlePost();
                }}
                disabled={
                  transaction.postingTransaction || transaction.lines.length === 0
                }
                className="
                  rounded
                  bg-blue-600
                  px-5
                  py-2
                  text-white
                  hover:bg-blue-700
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {transaction.postingTransaction
                  ? "Memposting..."
                  : "Posting Transaksi"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
