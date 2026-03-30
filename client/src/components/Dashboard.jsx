import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, TriangleAlert } from "lucide-react";
import { deleteDailyLogRow, getBackendHealth, getDailyLog, saveDailyLog } from "../api";

const BASE_UNIT_MINUTES = 15;
const DEFAULT_SLOT_INTERVAL = 15;
const DEFAULT_SLOT_COUNT = 15;
const ALLOWED_INTERVALS = [15, 30, 45, 60];
const TODO_STORAGE_KEY = "effortgrid-todo-items";

const readTodoItems = () => {
  try {
    const raw = window.localStorage.getItem(TODO_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

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

const sanitizeInterval = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_SLOT_INTERVAL;
  }

  if (ALLOWED_INTERVALS.includes(numeric)) {
    return numeric;
  }

  return DEFAULT_SLOT_INTERVAL;
};

const getUnitsPerSlot = (interval) => Math.max(1, Math.floor(sanitizeInterval(interval) / BASE_UNIT_MINUTES));

const buildSlotRanges = (baseUnitCount, interval) => {
  const safeCount = Number.isFinite(baseUnitCount) && baseUnitCount > 0 ? Math.floor(baseUnitCount) : DEFAULT_SLOT_COUNT;
  const unitsPerSlot = getUnitsPerSlot(interval);
  const uiSlotCount = Math.ceil(safeCount / unitsPerSlot);

  return Array.from({ length: uiSlotCount }, (_value, slotIndex) => {
    const startUnit = slotIndex * unitsPerSlot;
    const endUnit = Math.min(startUnit + unitsPerSlot - 1, safeCount - 1);

    return {
      slotIndex,
      startUnit,
      endUnit,
      label: formatSlotLabel((endUnit + 1) * BASE_UNIT_MINUTES),
    };
  });
};

const normalizeUnits = (units, baseUnitCount) => {
  const safeCount = Number.isFinite(baseUnitCount) && baseUnitCount > 0 ? Math.floor(baseUnitCount) : DEFAULT_SLOT_COUNT;
  const normalized = Array.from({ length: safeCount }, (_value, index) => toBoolean(units?.[index]));
  return normalized;
};

const extractLegacyCellValues = (cells) => {
  if (!cells || typeof cells !== "object") {
    return [];
  }

  return Object.entries(cells)
    .sort(([slotA], [slotB]) => {
      const minuteA = parseSlotLabelToMinutes(slotA);
      const minuteB = parseSlotLabelToMinutes(slotB);

      if (!Number.isFinite(minuteA) || !Number.isFinite(minuteB)) {
        return String(slotA).localeCompare(String(slotB));
      }

      return minuteA - minuteB;
    })
    .map(([, value]) => toBoolean(value));
};

const deriveSlotSettings = (data) => {
  const safeInterval = sanitizeInterval(data?.intervalMinutes);

  const firstRowUnits = data?.rows?.[0]?.units;
  if (Array.isArray(firstRowUnits) && firstRowUnits.length > 0) {
    return { interval: safeInterval, count: firstRowUnits.length };
  }

  const firstRowCells = data?.rows?.[0]?.cells;
  const countFromCells = firstRowCells && typeof firstRowCells === "object" ? Object.keys(firstRowCells).length : 0;

  if (countFromCells > 0) {
    return { interval: safeInterval, count: countFromCells * getUnitsPerSlot(safeInterval) };
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

const createEmptyRow = (date, baseUnitCount) => {
  return {
    date,
    units: normalizeUnits([], baseUnitCount),
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

const remapRowUnits = (row, baseUnitCount, interval) => {
  let sourceUnits = [];

  if (Array.isArray(row?.units)) {
    sourceUnits = row.units;
  } else {
    const legacyCellValues = extractLegacyCellValues(row?.cells);
    const legacyUnitsPerSlot = getUnitsPerSlot(interval);
    sourceUnits = legacyCellValues.flatMap((value) => Array.from({ length: legacyUnitsPerSlot }, () => value));
  }

  return {
    ...row,
    units: normalizeUnits(sourceUnits, baseUnitCount),
  };
};

const getCheckedCount = (row) => (Array.isArray(row?.units) ? row.units.reduce((count, value) => (value ? count + 1 : count), 0) : 0);

const getTotalMinutes = (row) => getCheckedCount(row) * BASE_UNIT_MINUTES;

const getGroupState = (row, range) => {
  const totalUnits = range.endUnit - range.startUnit + 1;
  const checkedUnits = Array.from({ length: totalUnits }, (_value, offset) => row?.units?.[range.startUnit + offset]).filter(Boolean)
    .length;

  if (checkedUnits === 0) {
    return "empty";
  }

  if (checkedUnits === totalUnits) {
    return "full";
  }

  return "partial";
};

const formatTotalEffort = (row) => {
  const totalMinutes = getTotalMinutes(row);
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

const ensureMinimumRows = (rows, baseUnitCount) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length > 0) {
    return safeRows;
  }

  return [createEmptyRow(formatDateInput(new Date()), baseUnitCount)];
};

function Dashboard() {
  const [rows, setRows] = useState([]);
  const [activeView, setActiveView] = useState("home");
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
  const [activeTimers, setActiveTimers] = useState({});
  const [activePopover, setActivePopover] = useState(null);
  const [allowMultipleTimers] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeletingRow, setIsDeletingRow] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [todoInput, setTodoInput] = useState("");
  const [todoItems, setTodoItems] = useState(() => readTodoItems());
  const timerIntervalRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const savedIndicatorTimeoutRef = useRef(null);
  const hasWarnedMemoryModeRef = useRef(false);
  const hasLoadedDataRef = useRef(false);

  const slotRanges = useMemo(() => buildSlotRanges(slotCount, slotInterval), [slotCount, slotInterval]);
  const chartData = useMemo(
    () =>
      rows.map((row, index) => ({
        date: toDateInputValue(row?.date) || `Row ${index + 1}`,
        totalHours: Number((getTotalMinutes(row) / 60).toFixed(2)),
      })),
    [rows]
  );
  const todayDateValue = formatDateInput(new Date());
  const totalMinutesToday = useMemo(() => {
    const todayRow = rows.find((row) => toDateInputValue(row?.date) === todayDateValue);
    if (!todayRow) {
      return 0;
    }

    return getTotalMinutes(todayRow);
  }, [rows, todayDateValue]);
  const activeDaysCount = useMemo(
    () => rows.filter((row) => getCheckedCount(row) > 0).length,
    [rows]
  );
  const completedTodoCount = useMemo(
    () => todoItems.filter((item) => item.completed).length,
    [todoItems]
  );

  const formatMinutesSummary = (minutes) => {
    const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
    const hours = Math.floor(safeMinutes / 60);
    const restMinutes = safeMinutes % 60;
    return `${hours}h ${String(restMinutes).padStart(2, "0")}m`;
  };

  // Helper function to find the next available (unchecked) slot for a row
  const getNextAvailableSlotIndex = (rowIndex) => {
    const row = rows[rowIndex];
    if (!row) return -1;

    for (let i = 0; i < slotRanges.length; i++) {
      if (getGroupState(row, slotRanges[i]) !== "full") {
        return i;
      }
    }
    return -1;
  };

  // Helper function to format timer display
  const formatTimerDisplay = (remainingSeconds) => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  // Helper function to play notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.warn("Notification sound failed:", err);
    }
  };

  const hasRunningTimers = (timers) =>
    Object.values(timers).some((timer) => timer?.status === "running" && Number(timer?.remainingSeconds) > 0);

  const stopTimerInterval = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const triggerSavedIndicator = () => {
    setShowSavedIndicator(true);
    if (savedIndicatorTimeoutRef.current) {
      clearTimeout(savedIndicatorTimeoutRef.current);
    }

    savedIndicatorTimeoutRef.current = setTimeout(() => {
      setShowSavedIndicator(false);
      savedIndicatorTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const health = await getBackendHealth();
        setStorageMode(health?.storageMode || (health?.dbReady ? "mongodb" : "memory"));

        const data = await getDailyLog();
        const { interval, count } = deriveSlotSettings(data);

        setSlotInterval(interval);
        setSlotCount(count);
        setDraftSlotInterval(interval);
        setDraftSlotCount(count);
        const mappedRows = (data.rows ?? []).map((row) => remapRowUnits(row, count, interval));
        setRows(ensureMinimumRows(mappedRows, count));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoading(false);
        hasLoadedDataRef.current = true;
      }
    };

    loadData();
  }, []);

  // Timer effect: decrement active running timers
  useEffect(() => {
    if (!hasRunningTimers(activeTimers)) {
      stopTimerInterval();
      return;
    }

    if (timerIntervalRef.current) {
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setActiveTimers((prevTimers) => {
        const updatedTimers = { ...prevTimers };
        const completedByRow = new Map();

        Object.entries(updatedTimers).forEach(([key, timer]) => {
          if (!timer || timer.status !== "running") {
            return;
          }

          const nextRemaining = timer.remainingSeconds - 1;
          if (nextRemaining <= 0) {
            const [rowIndexStr, slotIndexStr] = key.split("-");
            const rowIndex = Number(rowIndexStr);
            const slotIndex = Number(slotIndexStr);

            if (Number.isFinite(rowIndex) && Number.isFinite(slotIndex)) {
              const existing = completedByRow.get(rowIndex);
              completedByRow.set(rowIndex, Math.max(existing ?? -1, slotIndex));
            }

            delete updatedTimers[key];
            return;
          }

          updatedTimers[key] = { ...timer, remainingSeconds: nextRemaining };
        });

        if (completedByRow.size > 0) {
          setRows((previousRows) =>
            previousRows.map((row, rowIndex) => {
              const completedSlotIndex = completedByRow.get(rowIndex);
              if (completedSlotIndex === undefined) {
                return row;
              }

              const targetRange = slotRanges[completedSlotIndex];
              if (!targetRange) {
                return row;
              }

              const nextUnits = row.units.map((_value, unitIndex) => unitIndex <= targetRange.endUnit);

              return { ...row, units: nextUnits };
            })
          );

          playNotificationSound();
          setMessage("Timer completed! Slot auto-checked.");
        }

        return updatedTimers;
      });
    }, 1000);

    return () => {};
  }, [activeTimers, slotRanges]);

  useEffect(
    () => () => {
      stopTimerInterval();
      if (savedIndicatorTimeoutRef.current) {
        clearTimeout(savedIndicatorTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (storageMode === "memory" && !hasWarnedMemoryModeRef.current) {
      console.warn("Running in memory fallback mode. Data resets when the backend restarts.");
      hasWarnedMemoryModeRef.current = true;
    }
  }, [storageMode]);

  useEffect(() => {
    window.localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todoItems));
  }, [todoItems]);

  useEffect(() => {
    if (isLoading || !hasLoadedDataRef.current) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);

      try {
        await saveDailyLog({
          intervalMinutes: slotInterval,
          startTime: formatSlotLabel(BASE_UNIT_MINUTES),
          endTime: formatSlotLabel(slotCount * BASE_UNIT_MINUTES),
          rows,
        });
        triggerSavedIndicator();
      } catch (saveError) {
        setError(saveError.message);
      } finally {
        setIsSaving(false);
      }
    }, 700);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [rows, slotInterval, slotCount, isLoading]);

  const handleDateChange = (rowIndex, value) => {
    setRows((previousRows) =>
      previousRows.map((row, index) => (index === rowIndex ? { ...row, date: value } : row))
    );
  };

  const handleCheckboxChange = (rowIndex, slotIndex, isCurrentlyChecked) => {
    const targetRange = slotRanges[slotIndex];
    if (!targetRange) {
      return;
    }

    const shouldCheck = !isCurrentlyChecked;

    setRows((previousRows) =>
      previousRows.map((row, index) => {
        if (index !== rowIndex) {
          return row;
        }

        const nextUnits = row.units.map((_value, unitIndex) =>
          shouldCheck ? unitIndex <= targetRange.endUnit : unitIndex < targetRange.startUnit
        );

        return { ...row, units: nextUnits };
      })
    );

    // Stop any active timer for this slot
    const timerKey = `${rowIndex}-${slotIndex}`;
    if (activeTimers[timerKey]) {
      setActiveTimers((prev) => {
        const updated = { ...prev };
        delete updated[timerKey];
        return updated;
      });
      stopTimerInterval();
    }
  };

  const handleSlotClick = (rowIndex, slotIndex, isChecked) => {
    const timerKey = `${rowIndex}-${slotIndex}`;
    const timer = activeTimers[timerKey];

    if (timer) {
      const shouldCancel = window.confirm("A timer is active for this slot. Cancel the timer and reset this slot?");
      if (shouldCancel) {
        handleCancelTimer(rowIndex, slotIndex);
      } else {
        setMessage("Timer is still active. Use Cancel to reset this slot.");
      }
      return;
    }

    // Only show popover for unchecked slots
    if (isChecked) {
      // Toggle OFF: uncheck clicked slot and all subsequent slots.
      handleCheckboxChange(rowIndex, slotIndex, true);
      setActivePopover(null);
      return;
    }

    setActivePopover({ rowIndex, slotIndex });
  };

  const handleManualTick = (rowIndex, slotIndex) => {
    handleCheckboxChange(rowIndex, slotIndex, false);
    setActivePopover(null);
  };

  const handleStartTimer = (rowIndex, slotIndex) => {
    const timerKey = `${rowIndex}-${slotIndex}`;
    const durationSeconds = slotInterval * 60;

    // Clear other timers if only one timer allowed
    if (!allowMultipleTimers) {
      setActiveTimers({ [timerKey]: { remainingSeconds: durationSeconds, status: "running" } });
    } else {
      setActiveTimers((prev) => ({
        ...prev,
        [timerKey]: { remainingSeconds: durationSeconds, status: "running" },
      }));
    }

    setActivePopover(null);
  };

  const handlePauseTimer = (rowIndex, slotIndex) => {
    const timerKey = `${rowIndex}-${slotIndex}`;
    setActiveTimers((prev) => {
      const current = prev[timerKey];
      if (!current || current.status !== "running") {
        return prev;
      }

      return {
        ...prev,
        [timerKey]: {
          ...current,
          status: "paused",
        },
      };
    });

    // Explicitly stop the interval when paused; it will restart only if needed.
    stopTimerInterval();
  };

  const handleResumeTimer = (rowIndex, slotIndex) => {
    const timerKey = `${rowIndex}-${slotIndex}`;
    setActiveTimers((prev) => {
      const current = prev[timerKey];
      if (!current || current.status !== "paused") {
        return prev;
      }

      return {
        ...prev,
        [timerKey]: {
          ...current,
          status: "running",
        },
      };
    });
  };

  const handleCancelTimer = (rowIndex, slotIndex) => {
    const timerKey = `${rowIndex}-${slotIndex}`;

    setActiveTimers((prev) => {
      if (!prev[timerKey]) {
        return prev;
      }

      const updated = { ...prev };
      delete updated[timerKey];
      return updated;
    });

    // Explicitly clear interval on cancel; active-running reconciliation is handled by effect.
    stopTimerInterval();

    const targetRange = slotRanges[slotIndex];
    if (!targetRange) {
      return;
    }

    setRows((previousRows) =>
      previousRows.map((row, index) => {
        if (index !== rowIndex) {
          return row;
        }

        const nextUnits = [...row.units];
        for (let unitIndex = targetRange.startUnit; unitIndex <= targetRange.endUnit; unitIndex += 1) {
          nextUnits[unitIndex] = false;
        }

        return {
          ...row,
          units: nextUnits,
        };
      })
    );
  };

  const insertRowBelow = (rowIndex) => {
    setRows((previousRows) => {
      const sourceRow = previousRows[rowIndex];
      const parsedDate = parseDateInput(sourceRow?.date);
      const nextDate = parsedDate ? new Date(parsedDate.getTime()) : new Date();
      nextDate.setDate(nextDate.getDate() + 1);

      const newRow = createEmptyRow(formatDateInput(nextDate), slotCount);
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
        startTime: formatSlotLabel(BASE_UNIT_MINUTES),
        endTime: formatSlotLabel(slotCount * BASE_UNIT_MINUTES),
        rows,
      });
      triggerSavedIndicator();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const requestRowDelete = (row, rowIndex) => {
    setItemToDelete({ row, rowIndex });
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (isDeletingRow) {
      return;
    }

    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  const handleDeleteRow = async () => {
    if (!itemToDelete) {
      return;
    }

    const { row, rowIndex } = itemToDelete;

    const previousRows = [...rows];
    const nextRows = rows.filter((_, index) => index !== rowIndex);

    setIsDeletingRow(true);

    // Row indexes are part of timer keys, so clear timers to avoid stale interval keys.
    stopTimerInterval();
    setActiveTimers({});
    setActivePopover(null);
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
        const mappedRows = deleted.data.rows.map((nextRow) => remapRowUnits(nextRow, slotCount, slotInterval));
        setRows(ensureMinimumRows(mappedRows, slotCount));
      }

      setMessage("Row deleted successfully.");
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (deleteError) {
      try {
        await saveDailyLog({
          intervalMinutes: slotInterval,
          startTime: formatSlotLabel(BASE_UNIT_MINUTES),
          endTime: formatSlotLabel(slotCount * BASE_UNIT_MINUTES),
          rows: nextRows,
        });

        if (nextRows.length === 0) {
          const fallbackRows = ensureMinimumRows([], slotCount);
          setRows(fallbackRows);
          await saveDailyLog({
            intervalMinutes: slotInterval,
            startTime: formatSlotLabel(BASE_UNIT_MINUTES),
            endTime: formatSlotLabel(slotCount * BASE_UNIT_MINUTES),
            rows: fallbackRows,
          });
        }

        setMessage("Row deleted successfully.");
      } catch (syncError) {
        setRows(previousRows);
        setError(syncError?.message || deleteError.message);
      }
    } finally {
      setIsDeletingRow(false);
    }
  };

  const openSlotEditor = () => {
    setDraftSlotInterval(slotInterval);
    setDraftSlotCount(slotCount);
    setIsSlotEditorOpen(true);
  };

  const applySlotSettings = () => {
    const nextInterval = sanitizeInterval(draftSlotInterval);
    const nextCount = Number(draftSlotCount);

    if (!Number.isFinite(nextCount) || nextCount <= 0) {
      setError("Number of base units must be a positive number.");
      return;
    }

    const normalizedInterval = nextInterval;
    const normalizedCount = Math.floor(nextCount);

    stopTimerInterval();
    setActiveTimers({});
    setActivePopover(null);
    setRows((previousRows) => previousRows.map((row) => ({ ...row, units: normalizeUnits(row.units, normalizedCount) })));
    setSlotInterval(normalizedInterval);
    setSlotCount(normalizedCount);
    setIsSlotEditorOpen(false);
    setMessage("Slot settings updated.");
    setError("");
  };

  const handleAddTodo = () => {
    const title = todoInput.trim();
    if (!title) {
      return;
    }

    const newItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      completed: false,
    };

    setTodoItems((previous) => [newItem, ...previous]);
    setTodoInput("");
  };

  const handleToggleTodo = (itemId) => {
    setTodoItems((previous) =>
      previous.map((item) => (item.id === itemId ? { ...item, completed: !item.completed } : item))
    );
  };

  const handleDeleteTodo = (itemId) => {
    setTodoItems((previous) => previous.filter((item) => item.id !== itemId));
  };

  if (isLoading) {
    return <main className="mx-auto mt-8 w-full max-w-6xl px-4 text-center text-lg sm:px-6 lg:px-8">Loading Dashboard...</main>;
  }

  return (
    <section className="relative z-10 mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="mb-5 rounded-2xl border border-white/20 bg-white/70 p-3 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">Dashboard Workspace</h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                activeView === "home"
                  ? "bg-blue-600 text-white"
                  : "border border-white/30 bg-white/60 text-slate-700 hover:bg-white"
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => setActiveView("time")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                activeView === "time"
                  ? "bg-blue-600 text-white"
                  : "border border-white/30 bg-white/60 text-slate-700 hover:bg-white"
              }`}
            >
              Time Tracking
            </button>
            <button
              type="button"
              onClick={() => setActiveView("todo")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                activeView === "todo"
                  ? "bg-blue-600 text-white"
                  : "border border-white/30 bg-white/60 text-slate-700 hover:bg-white"
              }`}
            >
              Todo List
            </button>
          </div>
        </div>
      </div>

      {activeView === "home" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveView("time")}
            className="group min-h-[220px] rounded-2xl border border-white/20 bg-white/70 p-8 text-left shadow-xl backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/80"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Productivity</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-800">Time Tracking</h2>
            <p className="mt-3 max-w-sm text-sm text-slate-600">
              Track daily slots, start timers, and monitor effort trends with your activity chart.
            </p>
            <div className="mt-6 space-y-2 rounded-lg border border-white/20 bg-white/60 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Total Time Today:</span>
                <span className="font-semibold text-blue-700">{formatMinutesSummary(totalMinutesToday)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Active Days:</span>
                <span className="font-semibold text-slate-800">{activeDaysCount} days</span>
              </div>
            </div>
            <p className="mt-6 text-sm font-semibold text-blue-700 group-hover:text-blue-800">Open Time Tracking</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("todo")}
            className="group min-h-[220px] rounded-2xl border border-white/20 bg-white/70 p-8 text-left shadow-xl backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/80"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Planning</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-800">Todo List</h2>
            <p className="mt-3 max-w-sm text-sm text-slate-600">
              Capture quick tasks, mark completion, and keep your focus list ready for the day.
            </p>
            <div className="mt-6 space-y-2 rounded-lg border border-white/20 bg-white/60 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Total Tasks:</span>
                <span className="font-semibold text-slate-800">{todoItems.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Completed:</span>
                <span className="font-semibold text-blue-700">{completedTodoCount}</span>
              </div>
            </div>
            <p className="mt-6 text-sm font-semibold text-blue-700 group-hover:text-blue-800">Open Todo List</p>
          </button>
        </div>
      ) : null}

      {activeView === "time" ? (
        <div className="rounded-2xl border border-white/20 bg-white/70 p-4 shadow-xl backdrop-blur-md sm:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-slate-800 sm:text-3xl">Time Tracking</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {isSaving ? "Autosaving..." : "Auto Save On"}
              </span>
              {showSavedIndicator ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                  <Check size={14} />
                  Saved
                </span>
              ) : null}
              <button
                type="button"
                onClick={openSlotEditor}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Change Slots
              </button>
            </div>
          </div>

          {error ? <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <div className="overflow-x-auto rounded-xl border border-white/20 bg-white/60 backdrop-blur-sm">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-blue-50/70 text-slate-700">
                <tr>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-3 text-left font-bold">Date</th>
                  {slotRanges.map((range) => (
                    <th key={`slot-${range.slotIndex}`} className="whitespace-nowrap border border-slate-200 px-3 py-3 text-left font-bold">
                      {range.label}
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
                  <tr key={row?._id ?? `${rowIndex}-${row.date}`} className="odd:bg-white/70 even:bg-blue-50/30">
                    <td className="border border-slate-200 px-2 py-2 align-top">
                      <input
                        type="date"
                        value={toDateInputValue(row.date)}
                        onChange={(event) => handleDateChange(rowIndex, event.target.value)}
                        className="w-44 rounded-md border border-slate-300 bg-white/80 px-3 py-2 text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        aria-label={`date-${rowIndex}`}
                      />
                    </td>

                    {slotRanges.map((range, slotIndex) => {
                      const timerKey = `${rowIndex}-${slotIndex}`;
                      const timerState = activeTimers[timerKey];
                      const isTimerActive = Boolean(timerState);
                      const isTimerPaused = timerState?.status === "paused";
                      const remainingSeconds = timerState?.remainingSeconds ?? 0;
                      const isPopoverOpen = activePopover?.rowIndex === rowIndex && activePopover?.slotIndex === slotIndex;
                      const nextAvailableSlot = getNextAvailableSlotIndex(rowIndex);
                      const groupState = getGroupState(row, range);
                      const isSlotChecked = groupState === "full";
                      const isSlotPartial = groupState === "partial";
                      const isNextAvailableSlot = groupState !== "full" && slotIndex === nextAvailableSlot;

                      return (
                        <td key={`${rowIndex}-${range.slotIndex}`} className="relative border border-slate-200 px-2 py-2">
                          {isTimerActive ? (
                            <div className="flex items-center justify-center">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => handleSlotClick(rowIndex, slotIndex, isSlotChecked)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleSlotClick(rowIndex, slotIndex, isSlotChecked);
                                  }
                                }}
                                className={`relative inline-flex min-h-[52px] w-[72px] flex-col items-center justify-center rounded-lg px-1 py-1 text-[11px] font-bold shadow-lg ring-2 ${
                                  isTimerPaused
                                    ? "bg-gradient-to-br from-sky-100 to-blue-100 text-blue-700 ring-blue-300"
                                    : "bg-gradient-to-br from-amber-100 to-orange-100 text-orange-700 ring-orange-300"
                                }`}
                              >
                                <span className="relative z-10 leading-none">{formatTimerDisplay(remainingSeconds)}</span>
                                <div className="relative z-10 mt-1 flex items-center gap-1">
                                  {!isTimerPaused ? (
                                    <button
                                      type="button"
                                      onClick={() => handlePauseTimer(rowIndex, slotIndex)}
                                      className="grid h-4 w-4 place-items-center rounded bg-white/85 text-[10px] font-black text-orange-700 shadow-sm transition hover:bg-white"
                                      title="Pause timer"
                                      aria-label={`pause-timer-${rowIndex}-${slotIndex}`}
                                    >
                                      ||
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleResumeTimer(rowIndex, slotIndex)}
                                      className="grid h-4 w-4 place-items-center rounded bg-white/85 text-[10px] font-black text-blue-700 shadow-sm transition hover:bg-white"
                                      title="Resume timer"
                                      aria-label={`resume-timer-${rowIndex}-${slotIndex}`}
                                    >
                                      ▶
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleCancelTimer(rowIndex, slotIndex)}
                                    className="grid h-4 w-4 place-items-center rounded bg-white/85 text-[10px] font-black text-rose-700 shadow-sm transition hover:bg-white"
                                    title="Cancel timer"
                                    aria-label={`cancel-timer-${rowIndex}-${slotIndex}`}
                                  >
                                    ×
                                  </button>
                                </div>
                                <div
                                  className={`absolute inset-0 rounded-lg ${
                                    isTimerPaused ? "animate-pulse bg-blue-400/15" : "animate-pulse bg-orange-400/15"
                                  }`}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="mx-auto flex w-fit items-center gap-1">
                                {Array.from({ length: range.endUnit - range.startUnit + 1 }, (_value, unitOffset) => {
                                  const unitIndex = range.startUnit + unitOffset;
                                  const isUnitChecked = Boolean(row?.units?.[unitIndex]);

                                  return (
                                    <button
                                      key={`unit-${rowIndex}-${range.slotIndex}-${unitIndex}`}
                                      type="button"
                                      onClick={() => handleSlotClick(rowIndex, slotIndex, isSlotChecked)}
                                      className={`block h-4 w-4 rounded border-2 transition ${
                                        isUnitChecked
                                          ? "border-emerald-600 bg-emerald-600"
                                          : isSlotPartial
                                            ? "cursor-pointer border-amber-500 bg-amber-200 hover:border-amber-600 hover:bg-amber-300"
                                            : isNextAvailableSlot
                                              ? "cursor-pointer border-blue-400 bg-blue-50 hover:border-blue-500 hover:bg-blue-100"
                                              : "cursor-pointer border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
                                      }`}
                                      aria-label={`checkbox-${rowIndex}-${range.label}-${unitOffset}`}
                                    />
                                  );
                                })}
                              </div>

                              {isPopoverOpen && (
                                <div className="absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 transform">
                                  <div className="rounded-md border border-white/20 bg-white/75 p-2 shadow-xl backdrop-blur-sm">
                                    <button
                                      type="button"
                                      onClick={() => handleManualTick(rowIndex, slotIndex)}
                                      className="mb-1 block w-full rounded px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                    >
                                      ✓ Tick
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartTimer(rowIndex, slotIndex)}
                                      disabled={!isNextAvailableSlot}
                                      className="block w-full rounded px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
                                    >
                                      {isNextAvailableSlot ? "⏱ Timer" : "⏱ Timer (Next Slot Only)"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className="border border-slate-200 px-3 py-2 text-center">
                      <span className="inline-flex min-w-[88px] justify-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {formatTotalEffort(row)}
                      </span>
                    </td>

                    <td className="border border-slate-200 px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => insertRowBelow(rowIndex)}
                        className="rounded-md bg-blue-600 px-3 py-1 text-sm font-bold text-white transition hover:bg-blue-700"
                      >
                        [+]
                      </button>
                    </td>

                    <td className="border border-slate-200 px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => requestRowDelete(row, rowIndex)}
                        className="rounded-md bg-red-500 px-3 py-1 text-sm font-semibold text-white transition hover:bg-red-600"
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

          <div className="mt-8 rounded-2xl border border-white/20 bg-white/70 p-4 shadow-xl backdrop-blur-md sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-800 sm:text-xl">Growth Chart</h3>
              <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Daily Total Hours
              </span>
            </div>

            <div className="h-[280px] w-full sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#dbe6f2" />
                  <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatHoursValue}
                  />
                  <Tooltip
                    cursor={{ stroke: "#38bdf8", strokeWidth: 1 }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #d9e2ee",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
                    }}
                    formatter={(value) => [formatHoursValue(value), "Total Effort"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalHours"
                    stroke="#03a9f4"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#0288d1", stroke: "#e0f2fe", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#0288d1", stroke: "#bae6fd", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}

      {activeView === "todo" ? (
        <div className="rounded-2xl border border-white/20 bg-white/70 p-5 shadow-xl backdrop-blur-md sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold text-slate-800">Todo List</h2>
            <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {todoItems.filter((item) => !item.completed).length} Pending
            </span>
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={todoInput}
              onChange={(event) => setTodoInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddTodo();
                }
              }}
              placeholder="Add a new task"
              className="w-full rounded-md border border-slate-300 bg-white/80 px-3 py-2 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={handleAddTodo}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Add Task
            </button>
          </div>

          <div className="space-y-2">
            {todoItems.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No tasks yet. Add your first todo.
              </p>
            ) : (
              todoItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-white/20 bg-white/65 px-3 py-2 backdrop-blur-sm">
                  <label className="flex items-center gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleTodo(item.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={item.completed ? "text-slate-400 line-through" : "text-slate-800"}>{item.title}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteTodo(item.id)}
                    className="rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeView === "time" && isSlotEditorOpen ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/70 p-5 shadow-xl backdrop-blur-md sm:p-6">
            <h3 className="text-lg font-semibold text-slate-800">Change Slots</h3>
            <p className="mt-1 text-sm text-slate-600">Update interval and number of columns for the dashboard.</p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Interval (minutes)</span>
                <select
                  value={draftSlotInterval}
                  onChange={(event) => setDraftSlotInterval(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white/80 px-3 py-2 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {ALLOWED_INTERVALS.map((interval) => (
                    <option key={interval} value={interval}>
                      {interval}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Number of Base Units (15m each)</span>
                <input
                  type="number"
                  min="1"
                  value={draftSlotCount}
                  onChange={(event) => setDraftSlotCount(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white/80 px-3 py-2 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSlotEditorOpen(false)}
                className="rounded-md border border-white/30 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
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

      {showDeleteModal ? (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-slate-950/35 px-4 backdrop-blur-md transition-opacity duration-200"
          onClick={closeDeleteModal}
        >
          <div
            className="w-full max-w-md scale-100 rounded-2xl border border-white/20 bg-white/70 p-5 shadow-2xl backdrop-blur-md transition-all duration-200 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-600">
                <TriangleAlert size={22} />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Are you sure you want to delete this record?</h3>
                <p className="mt-1 text-sm text-slate-600">This action cannot be undone.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeletingRow}
                className="rounded-md border border-slate-300 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRow}
                disabled={isDeletingRow}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingRow ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Dashboard;