import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { deleteDailyLogRow, getBackendHealth, getDailyLog, saveDailyLog } from "../api";

const DEFAULT_SLOT_INTERVAL = 15;
const DEFAULT_SLOT_COUNT = 15;

const parseDateInput = (value) => {
  const raw = String(value).trim();
  const normalized = raw.replaceAll("-", "/");
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateInputValue = (value) => {
  const parsed = parseDateInput(value);
  if (!parsed) {
    return "";
  }

  return formatDateInput(parsed);
};

const parseSlotLabelToMinutes = (label) => {
  const match = String(label).match(/^(\d+):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const formatSlotLabel = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const generateSlots = (interval, count) => {
  const safeInterval = Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_SLOT_INTERVAL;
  const safeCount = Number.isFinite(count) && count > 0 ? count : DEFAULT_SLOT_COUNT;

  return Array.from({ length: safeCount }, (_value, index) => formatSlotLabel((index + 1) * safeInterval));
};

const deriveSlotSettings = (data) => {
  const interval = Number(data?.intervalMinutes);
  const safeInterval = Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_SLOT_INTERVAL;

  const firstRowCells = data?.rows?.[0]?.cells;
  const countFromCells = firstRowCells && typeof firstRowCells === "object" ? Object.keys(firstRowCells).length : 0;

  if (countFromCells > 0) {
    return { interval: safeInterval, count: countFromCells };
  }

  const startMinutes = parseSlotLabelToMinutes(data?.startTime);
  const endMinutes = parseSlotLabelToMinutes(data?.endTime);
  if (Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && endMinutes >= startMinutes) {
    const computed = Math.floor((endMinutes - startMinutes) / safeInterval) + 1;
    if (computed > 0) {
      return { interval: safeInterval, count: computed };
    }
  }

  return { interval: safeInterval, count: DEFAULT_SLOT_COUNT };
};

const createEmptyRow = (date, slots) => {
  const cells = {};
  slots.forEach((slot) => {
    cells[slot] = false;
  });

  return {
    date,
    cells,
  };
};

const toBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
};

const remapRowCells = (row, slots) => {
  const updatedCells = {};
  slots.forEach((slot) => {
    updatedCells[slot] = toBoolean(row.cells?.[slot]);
  });

  return {
    ...row,
    cells: updatedCells,
  };
};

const getCheckedCount = (row, slots) => slots.reduce((count, slot) => (row?.cells?.[slot] ? count + 1 : count), 0);

const getTotalMinutes = (row, slots) => getCheckedCount(row, slots) * 15;

const formatTotalEffort = (row, slots) => {
  const totalMinutes = getTotalMinutes(row, slots);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
};

const formatHoursValue = (value) => {
  const totalMinutes = Math.round(Number(value || 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
};

function Dashboard() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [storageMode, setStorageMode] = useState("unknown");
  const [slotInterval, setSlotInterval] = useState(DEFAULT_SLOT_INTERVAL);
  const [slotCount, setSlotCount] = useState(DEFAULT_SLOT_COUNT);
  const [isSlotEditorOpen, setIsSlotEditorOpen] = useState(false);
  const [draftSlotInterval, setDraftSlotInterval] = useState(DEFAULT_SLOT_INTERVAL);
  const [draftSlotCount, setDraftSlotCount] = useState(DEFAULT_SLOT_COUNT);

  const slots = useMemo(() => generateSlots(slotInterval, slotCount), [slotInterval, slotCount]);
  const chartData = useMemo(
    () =>
      rows.map((row, index) => ({
        date: toDateInputValue(row?.date) || `Row ${index + 1}`,
        totalHours: Number((getTotalMinutes(row, slots) / 60).toFixed(2)),
      })),
    [rows, slots]
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const health = await getBackendHealth();
        setStorageMode(health?.storageMode || (health?.dbReady ? "mongodb" : "memory"));

        const data = await getDailyLog();
        const { interval, count } = deriveSlotSettings(data);
        const generatedSlots = generateSlots(interval, count);

        setSlotInterval(interval);
        setSlotCount(count);
        setDraftSlotInterval(interval);
        setDraftSlotCount(count);
        setRows((data.rows ?? []).map((row) => remapRowCells(row, generatedSlots)));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleDateChange = (rowIndex, value) => {
    setRows((previousRows) =>
      previousRows.map((row, index) => (index === rowIndex ? { ...row, date: value } : row))
    );
  };

  const handleCheckboxChange = (rowIndex, slotIndex, checked) => {
    setRows((previousRows) =>
      previousRows.map((row, index) => {
        if (index !== rowIndex) {
          return row;
        }

        const nextCells = { ...row.cells };

        slots.forEach((slot, indexInSlots) => {
          if (checked) {
            nextCells[slot] = indexInSlots <= slotIndex;
            return;
          }

          nextCells[slot] = indexInSlots < slotIndex ? Boolean(row.cells?.[slot]) : false;
        });

        return { ...row, cells: nextCells };
      })
    );
  };

  const insertRowBelow = (rowIndex) => {
    setRows((previousRows) => {
      const sourceRow = previousRows[rowIndex];
      const parsedDate = parseDateInput(sourceRow?.date);
      const nextDate = parsedDate ? new Date(parsedDate.getTime()) : new Date();
      nextDate.setDate(nextDate.getDate() + 1);

      const newRow = createEmptyRow(formatDateInput(nextDate), slots);
      const updatedRows = [...previousRows];
      updatedRows.splice(rowIndex + 1, 0, newRow);
      return updatedRows;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await saveDailyLog({
        intervalMinutes: slotInterval,
        startTime: slots[0] || formatSlotLabel(slotInterval),
        endTime: slots[slots.length - 1] || formatSlotLabel(slotInterval * slotCount),
        rows,
      });
      setMessage("Saved successfully.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRow = async (row, rowIndex) => {
    const shouldDelete = window.confirm("Delete this row?");
    if (!shouldDelete) {
      return;
    }

    const previousRows = [...rows];
    const nextRows = rows.filter((_, index) => index !== rowIndex);

    setRows(nextRows);
    setMessage("");
    setError("");

    try {
      const deleted = await deleteDailyLogRow({
        rowId: row?._id,
        rowIndex,
        date: row?.date,
      });

      if (Array.isArray(deleted?.data?.rows)) {
        setRows(deleted.data.rows.map((nextRow) => remapRowCells(nextRow, slots)));
      }

      setMessage("Row deleted successfully.");
    } catch (deleteError) {
      try {
        await saveDailyLog({
          intervalMinutes: slotInterval,
          startTime: slots[0] || formatSlotLabel(slotInterval),
          endTime: slots[slots.length - 1] || formatSlotLabel(slotInterval * slotCount),
          rows: nextRows,
        });
        setMessage("Row deleted successfully.");
      } catch (syncError) {
        setRows(previousRows);
        setError(syncError?.message || deleteError.message);
      }
    }
  };

  const openSlotEditor = () => {
    setDraftSlotInterval(slotInterval);
    setDraftSlotCount(slotCount);
    setIsSlotEditorOpen(true);
  };

  const applySlotSettings = () => {
    const nextInterval = Number(draftSlotInterval);
    const nextCount = Number(draftSlotCount);

    if (!Number.isFinite(nextInterval) || nextInterval <= 0) {
      setError("Interval must be a positive number.");
      return;
    }

    if (!Number.isFinite(nextCount) || nextCount <= 0) {
      setError("Number of slots must be a positive number.");
      return;
    }

    const normalizedInterval = Math.floor(nextInterval);
    const normalizedCount = Math.floor(nextCount);
    const newSlots = generateSlots(normalizedInterval, normalizedCount);

    setRows((previousRows) => previousRows.map((row) => remapRowCells(row, newSlots)));
    setSlotInterval(normalizedInterval);
    setSlotCount(normalizedCount);
    setIsSlotEditorOpen(false);
    setMessage("Slot settings updated.");
    setError("");
  };

  if (isLoading) {
    return <main className="mx-auto mt-8 w-full max-w-6xl px-4 text-center text-lg sm:px-6 lg:px-8">Loading Dashboard...</main>;
  }

  return (
    <section className="relative z-10 mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/60 bg-white/45 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Activity Dashboard</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openSlotEditor}
              className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Change Slots
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {message ? <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {storageMode === "memory" ? (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Running in memory fallback mode. Data resets when the backend restarts.
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white/65">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="whitespace-nowrap border border-slate-200 px-3 py-3 text-left font-bold">Date</th>
                {slots.map((slot) => (
                  <th key={slot} className="whitespace-nowrap border border-slate-200 px-3 py-3 text-left font-bold">
                    {slot}
                  </th>
                ))}
                <th className="whitespace-nowrap border border-slate-200 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800">
                  Total Effort
                </th>
                <th className="border border-slate-200 px-3 py-3 text-center font-bold">Add</th>
                <th className="whitespace-nowrap border border-slate-200 px-3 py-3 text-center font-bold text-slate-700">
                  Delete
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row?._id ?? `${rowIndex}-${row.date}`} className="odd:bg-white even:bg-slate-50/60">
                  <td className="border border-slate-200 px-2 py-2 align-top">
                    <input
                      type="date"
                      value={toDateInputValue(row.date)}
                      onChange={(event) => handleDateChange(rowIndex, event.target.value)}
                      className="w-44 rounded-lg border border-slate-300/90 bg-white/90 px-3 py-2 text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                      aria-label={`date-${rowIndex}`}
                    />
                  </td>

                  {slots.map((slot, slotIndex) => (
                    <td key={`${rowIndex}-${slot}`} className="border border-slate-200 px-2 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(row.cells?.[slot])}
                        onChange={(event) => handleCheckboxChange(rowIndex, slotIndex, event.target.checked)}
                        className="mx-auto block h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                        aria-label={`checkbox-${rowIndex}-${slot}`}
                      />
                    </td>
                  ))}

                  <td className="border border-slate-200 px-3 py-2 text-center">
                    <span className="inline-flex min-w-[88px] justify-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {formatTotalEffort(row, slots)}
                    </span>
                  </td>

                  <td className="border border-slate-200 px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => insertRowBelow(rowIndex)}
                      className="rounded bg-red-600 px-3 py-1 text-sm font-bold text-white transition hover:bg-red-700"
                    >
                      [+]
                    </button>
                  </td>

                  <td className="border border-slate-200 px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row, rowIndex)}
                      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      aria-label={`delete-row-${rowIndex}`}
                      title="Delete row"
                    >
                      X
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-xl shadow-slate-900/10 backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Growth Chart</h2>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Daily Total Hours
            </span>
          </div>

          <div className="h-[280px] w-full sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 12 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#dbeafe" />
                <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: "#475569", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatHoursValue}
                />
                <Tooltip
                  cursor={{ stroke: "#60a5fa", strokeWidth: 1 }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #bfdbfe",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
                  }}
                  formatter={(value) => [formatHoursValue(value), "Total Effort"]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="totalHours"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#1d4ed8", stroke: "#dbeafe", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#1d4ed8", stroke: "#bfdbfe", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {isSlotEditorOpen ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/70 p-5 shadow-2xl shadow-slate-900/20 backdrop-blur-xl sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Change Slots</h3>
            <p className="mt-1 text-sm text-slate-600">Update interval and number of columns for the dashboard.</p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Interval (minutes)</span>
                <input
                  type="number"
                  min="1"
                  value={draftSlotInterval}
                  onChange={(event) => setDraftSlotInterval(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Number of Slots</span>
                <input
                  type="number"
                  min="1"
                  value={draftSlotCount}
                  onChange={(event) => setDraftSlotCount(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSlotEditorOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applySlotSettings}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Dashboard;