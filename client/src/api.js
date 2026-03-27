const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

export const getBackendHealth = async () => {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Failed to load backend health (${response.status})`);
  }

  return response.json();
};

export const getDailyLog = async () => {
  const response = await fetch(`${API_BASE_URL}/daily-log`);
  if (!response.ok) {
    throw new Error(`Failed to load Daily Log data (${response.status})`);
  }

  return response.json();
};

export const saveDailyLog = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/daily-log/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save Daily Log data (${response.status})`);
  }

  return response.json();
};

export const deleteDailyLogRow = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/daily-log/row`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete Daily Log row (${response.status})`);
  }

  return response.json();
};
