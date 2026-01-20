import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { id } from "date-fns/locale";
import { DateRangePicker } from "react-date-range";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import type { Range } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import * as XLSX from "xlsx";

import { getWIBTimestampFromUTC } from "../utils/time";

interface LogItem {
  id: string;
  waktu: string; // UTC string
  user_id: string;
  tabel: string;
  tipe: string;
  data_lama?: Record<string, unknown>;
  data_baru?: Record<string, unknown>;
}

export default function DashboardLog() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [filterUser, setFilterUser] = useState("");
  const [filterTable, setFilterTable] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const [range, setRange] = useState<Range[]>([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ]);

  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [pickerStyle, setPickerStyle] = useState({ top: 0, left: 0 });

  const fetchLogs = async () => {
    setLoading(true);

    let query = supabase
      .from("log_transaksi")
      .select("*")
      .order("waktu", { ascending: false });

    // Filter keyword
    if (search)
      query = query.or(
        `user_id.ilike.%${search}%,tabel.ilike.%${search}%,tipe.ilike.%${search}%`
      );

    if (filterUser) query = query.ilike("user_id", `%${filterUser}%`);
    if (filterTable && filterTable !== "all") query = query.eq("tabel", filterTable);
    if (filterAction && filterAction !== "all") query = query.eq("tipe", filterAction);

    // --- FILTER RANGE TANGGAL (WIB → UTC) ---
    const startDate = range[0].startDate;
    const endDate = range[0].endDate;

    if (startDate && endDate) {
      // Mulai hari WIB → konversi ke UTC
      const startUTC = new Date(Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0, 0, 0
      ));
      const endUTC = new Date(Date.UTC(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
        23, 59, 59, 999
      ));

      // Simpan query dengan UTC
      query = query
        .gte("waktu", startUTC.toISOString())
        .lte("waktu", endUTC.toISOString());
    }

    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // --- EXPORT EXCEL ---
  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      logs.map((item) => ({
        waktu: getWIBTimestampFromUTC(item.waktu),
        user_id: item.user_id,
        tabel: item.tabel,
        tipe: item.tipe,
        data_lama: JSON.stringify(item.data_lama),
        data_baru: JSON.stringify(item.data_baru),
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Log");
    XLSX.writeFile(workbook, "log_transaksi.xlsx");
  };

  useEffect(() => {
    if (showPicker && pickerRef.current && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPickerStyle({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });

      function handleClickOutside(event: MouseEvent) {
        const target = event.target as Node;
        if (
          pickerRef.current &&
          !pickerRef.current.contains(target) &&
          triggerRef.current &&
          !triggerRef.current.contains(target)
        ) {
          setShowPicker(false);
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPicker]);

  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="pr-8 space-y-6">
        <h1 className="text-2xl font-bold">Dashboard Log Aktivitas</h1>

        <Input
          placeholder="Cari keyword bebas (user, tabel, aksi)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Filter User ID"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="bg-white"
            />

            <Select onValueChange={setFilterTable} value={filterTable || "all"}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Filter Tabel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="premi_driver">Premi Driver</SelectItem>
                <SelectItem value="kas_harian">Kas Harian</SelectItem>
                <SelectItem value="surat_jalan">Surat Jalan</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={setFilterAction} value={filterAction || "all"}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Filter Aksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>

            <div ref={triggerRef} className="w-fit">
              <input
                type="text"
                readOnly
                value={
                  range[0]?.startDate && range[0]?.endDate
                    ? `${format(range[0].startDate, "dd-MM-yyyy", { locale: id })} - ${format(
                        range[0].endDate,
                        "dd-MM-yyyy",
                        { locale: id }
                      )}`
                    : ""
                }
                onClick={() => setShowPicker(true)}
                className="border border-gray-300 rounded px-2 py-1 text-sm leading-normal w-[220px] cursor-pointer"
              />
            </div>

            {showPicker &&
              createPortal(
                <div
                  ref={pickerRef}
                  className="z-50 shadow-lg border bg-white p-2"
                  style={{ position: "fixed", top: pickerStyle.top, left: pickerStyle.left }}
                >
                  <DateRangePicker
                    className="custom-datepicker"
                    onChange={(ranges) => {
                      const selection = ranges.selection;
                      if (selection?.startDate && selection?.endDate) {
                        setRange([{ ...selection, key: "selection" }]);
                      }
                    }}
                    moveRangeOnFirstSelection={false}
                    showMonthAndYearPickers
                    staticRanges={[]}
                    inputRanges={[]}
                    months={1}
                    ranges={range}
                    direction="horizontal"
                    locale={id}
                    preventSnapRefocus
                    calendarFocus="forwards"
                  />
                  <div className="flex justify-end mt-2 space-x-2">
                    <button onClick={() => setShowPicker(false)} className="px-3 py-1 bg-green-600 text-white rounded">Apply</button>
                    <button onClick={() => setShowPicker(false)} className="px-3 py-1 bg-gray-300 rounded">Cancel</button>
                  </div>
                </div>,
                document.body
              )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchLogs} className="flex items-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : "Terapkan Filter"}
            </Button>

            <Button onClick={exportExcel} className="bg-green-600 text-white hover:bg-green-700">
              Export Excel
            </Button>
          </div>
        </Card>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">Waktu</th>
                  <th className="p-2">User</th>
                  <th className="p-2">Tabel</th>
                  <th className="p-2">Aksi</th>
                  <th className="p-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row: LogItem) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="p-2">{getWIBTimestampFromUTC(row.waktu)}</td>
                    <td className="p-2">{row.user_id}</td>
                    <td className="p-2">{row.tabel}</td>
                    <td className="p-2 font-bold">{row.tipe}</td>
                    <td className="p-2">
                      <details className="cursor-pointer">
                        <summary className="text-blue-600">Lihat</summary>
                        <div className="bg-gray-100 p-3 rounded mt-2 overflow-x-auto text-xs space-y-3">
                          <strong>Perubahan:</strong>
                          <pre className="whitespace-pre-wrap">
                            {(() => {
                              const oldData = row.data_lama || {};
                              const newData = row.data_baru || {};
                              const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
                              let diff = "";
                              keys.forEach((k) => {
                                if (oldData[k] !== newData[k]) {
                                  diff += `- ${k}: ${oldData[k]} → ${newData[k]}\n`;
                                }
                              });
                              return diff || "Tidak ada perbedaan";
                            })()}
                          </pre>

                          <strong>Data Lama:</strong>
                          <pre className="whitespace-pre-wrap">{JSON.stringify(row.data_lama, null, 2)}</pre>

                          <strong>Data Baru:</strong>
                          <pre className="whitespace-pre-wrap">{JSON.stringify(row.data_baru, null, 2)}</pre>
                        </div>
                      </details>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}