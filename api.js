/****************************************************
 * MES API Bridge｜V69.5
 * GitHub 前端 → Apps Script Web App
 * 修正：
 * 1. Key In 讀取 action=keyinsource
 * 2. rows / data / list 統一回傳
 * 3. today() 改成 yyyy-MM-dd，避免今日/一周篩選失效
 ****************************************************/

const MES_API_URL = "https://script.google.com/macros/s/AKfycbzME9YeY4SvIeIB1tszQr9TuiR-DKew4E8l9hy0Es5pS_uNWO-X_gOXJbkZ0wXC381Q/exec";

window.MES = {
  get,
  post,
  toast,
  getKeyinSource,
  rowsOf
};

function buildUrl(action, params = {}) {
  const url = new URL(MES_API_URL);
  url.searchParams.set("action", action);

  Object.keys(params || {}).forEach(k => {
    if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
      url.searchParams.set(k, params[k]);
    }
  });

  return url.toString();
}

function normalizeAction(action) {
  const a = String(action || "").toLowerCase();

  if (
    a === "source" ||
    a === "getsourcedata" ||
    a === "listworkorders" ||
    a === "workorders" ||
    a === "latestorders" ||
    a === "keyinsource" ||
    a === "getkeyinsource"
  ) {
    return "keyinsource";
  }

  return action;
}

function rowsOf(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function get(action, args = [], params = {}) {
  return new Promise((resolve, reject) => {
    const realAction = normalizeAction(action);
    const cbName = "__mes_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    const url = new URL(MES_API_URL);
    url.searchParams.set("action", realAction);
    url.searchParams.set("callback", cbName);

    Object.keys(params || {}).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
        url.searchParams.set(k, params[k]);
      }
    });

    const script = document.createElement("script");
    script.src = url.toString();

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("API 讀取逾時：" + realAction));
    }, 60000);

    function cleanup() {
      clearTimeout(timer);

      try {
        delete window[cbName];
      } catch (e) {
        window[cbName] = undefined;
      }

      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[cbName] = function (data) {
      cleanup();

      const rows = rowsOf(data);

      resolve({
        ...(data || {}),
        ok: data?.ok !== false && data?.success !== false,
        success: data?.success !== false,
        rows: rows,
        data: rows,
        list: rows,
        total: data?.total || rows.length
      });
    };

    script.onerror = function () {
      cleanup();
      reject(new Error("API 讀取失敗：" + realAction));
    };

    document.body.appendChild(script);
  });
}

function getKeyinSource(params = {}) {
  return get("keyinsource", [], params);
}

async function post(action, data = {}) {
  const payload = {
    ...data,
    action: action
  };

  const url = buildUrl(action);

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    return {
      ok: true,
      success: true,
      message: "POST 已送出：" + action
    };

  } catch (e) {
    throw new Error("POST 失敗：" + e.message);
  }
}

function toast(msg) {
  let box = document.getElementById("toast");

  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    box.className = "toast";
    document.body.appendChild(box);
  }

  box.textContent = msg;
  box.classList.add("show");

  setTimeout(() => {
    box.classList.remove("show");
  }, 1800);
}

/****************************************************
 * 共用小工具
 ****************************************************/

function getVal(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "").trim() : "";
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value == null ? "" : value;
}

function norm(v) {
  return String(v || "").toLowerCase().replace(/\s+/g, "");
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}

function wo12(v) {
  return String(v || "").trim().toUpperCase().slice(0, 12);
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
