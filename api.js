/****************************************************
 * MES API Bridge｜V60.5
 * GitHub 前端 → Apps Script Web App
 ****************************************************/

const MES_API_URL = "https://script.google.com/macros/s/AKfycbyW4ayFKOWHRUWAvMNgKfXcnEsTDsXoq3Dxd9ki97dEdeXuhPuJ7sVvhEsm-o6wf1V3/exec";

window.MES = {
  get,
  post,
  toast
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

/**
 * GET：使用 JSONP，避免 GitHub Pages CORS 問題
 * 用法：
 * MES.get("listTargetPlans", [], { date: "2026-07-02" })
 */
function get(action, args = [], params = {}) {
  return new Promise((resolve, reject) => {
    const cbName = "__mes_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    const url = new URL(MES_API_URL);
    url.searchParams.set("action", action);
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
      reject(new Error("API 讀取逾時：" + action));
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
      resolve(data);
    };

    script.onerror = function () {
      cleanup();
      reject(new Error("API 讀取失敗：" + action));
    };

    document.body.appendChild(script);
  });
}

/**
 * POST：送出 Key In / 幹部目標
 * Google Apps Script 可接受 no-cors 寫入
 */
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
  return `${y}/${m}/${day}`;
}
