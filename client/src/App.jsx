import { useEffect, useMemo, useState } from "react";
import { getBackendHealth, getDailyLog, saveDailyLog } from "./api";

const DURATION_SLOTS = [
  "0:15",
  "0:30",
  "0:45",
  "1:00",
  "1:15",
  "1:30",
  "1:45",
  "2:00",
  "2:15",
  "2:30",
  "2:45",
  "3:00",
  "3:15",
  "3:30",
  "3:45",
];

const parseDateInput = (value) => {
  const normalized = String(value).trim().replaceAll("-", "/");
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

const formatDateSlash = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
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

const remapRowCells = (row, slots) => {
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

  const updatedCells = {};
  slots.forEach((slot) => {
    updatedCells[slot] = toBoolean(row.cells?.[slot]);
  });

  return {
    ...row,
    cells: updatedCells,
  };
};

function App() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [storageMode, setStorageMode] = useState("unknown");

  const slots = useMemo(() => DURATION_SLOTS, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const health = await getBackendHealth();
        setStorageMode(health?.storageMode || (health?.dbReady ? "mongodb" : "memory"));

        const data = await getDailyLog();
        setRows((data.rows ?? []).map((row) => remapRowCells(row, DURATION_SLOTS)));
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

  const handleCellChange = (rowIndex, slot, checked) => {
    setRows((previousRows) =>
      previousRows.map((row, index) =>
        index === rowIndex ? { ...row, cells: { ...row.cells, [slot]: checked } } : row
      )
    );
  };

  const insertRowBelow = (rowIndex) => {
    setRows((previousRows) => {
      const sourceRow = previousRows[rowIndex];
      const parsedDate = parseDateInput(sourceRow?.date);
      const nextDate = parsedDate ? new Date(parsedDate.getTime()) : new Date();
      nextDate.setDate(nextDate.getDate() + 1);

      const newRow = createEmptyRow(formatDateSlash(nextDate), slots);
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
        intervalMinutes: 15,
        startTime: "00:15",
        endTime: "03:45",
        rows,
      });
      setMessage("Saved successfully.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <main className="p-8 text-center text-lg">Loading Daily Log...</main>;
  }

  return (
    <main className="min-h-screen px-3 py-8 sm:px-6 lg:px-10">
      <section className="mx-auto w-full max-w-[1500px] animate-rise rounded-2xl border border-slate-200/80 bg-[var(--paper)] p-4 shadow-soft sm:p-8">
        <h1 className="mb-8 text-center text-4xl font-extrabold tracking-tight text-slate-800 sm:text-5xl">
          Welcome to Daily Log
        </h1>

        <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        {message ? <p className="mb-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        {storageMode === "memory" ? (
          <p className="mb-3 text-sm text-amber-700">
            Running in memory fallback mode. Data resets when the backend restarts.
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="whitespace-nowrap border border-slate-200 px-3 py-3 text-left font-bold">Date</th>
                {slots.map((slot) => (
                  <th key={slot} className="whitespace-nowrap border border-slate-200 px-3 py-3 text-left font-bold">
                    {slot}
                  </th>
                ))}
                <th className="border border-slate-200 px-3 py-3 text-center font-bold">Add</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${row.date}`} className="odd:bg-white even:bg-slate-50/50">
                  <td className="border border-slate-200 px-2 py-2 align-top">
                    <input
                      value={row.date}
                      onChange={(event) => handleDateChange(rowIndex, event.target.value)}
                      className="w-36 rounded border border-slate-300 px-2 py-1 focus:border-sky-500 focus:outline-none"
                      aria-label={`date-${rowIndex}`}
                    />
                  </td>

                  {slots.map((slot) => (
                    <td key={`${rowIndex}-${slot}`} className="border border-slate-200 px-2 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(row.cells?.[slot])}
                        onChange={(event) => handleCellChange(rowIndex, slot, event.target.checked)}
                        className="mx-auto block h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                        aria-label={`checkbox-${rowIndex}-${slot}`}
                      />
                    </td>
                  ))}

                  <td className="border border-slate-200 px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => insertRowBelow(rowIndex)}
                      className="rounded bg-red-600 px-3 py-1 text-sm font-bold text-white transition hover:bg-red-700"
                    >
                      [+]
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default App;
