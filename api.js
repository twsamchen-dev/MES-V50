/****************************************************
 * MES API Bridge｜V70.1 Key In Cloud Verified Save
 * GitHub 前端 → Apps Script Web App
 *
 * 修正：
 * 1. Key In 讀取 action=keyinsource
 * 2. rows / data / list 統一回傳
 * 3. today() 固定回傳 yyyy-MM-dd
 * 4. Key In 送出後回讀 keyin 工作表
 * 5. 找到相同 keyin_id 才判定儲存成功
 * 6. 後端未寫入時不再顯示假成功
 ****************************************************/

const MES_API_URL =
  "https://script.google.com/macros/s/AKfycbzME9YeY4SvIeIB1tszQr9TuiR-DKew4E8l9hy0Es5pS_uNWO-X_gOXJbkZ0wXC381Q/exec";

window.MES = {
  get,
  post,
  toast,
  getKeyinSource,
  rowsOf
};

/****************************************************
 * URL
 ****************************************************/

function buildUrl(action, params = {}) {
  const url = new URL(MES_API_URL);

  url.searchParams.set("action", action);

  Object.keys(params || {}).forEach(key => {
    const value = params[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

/****************************************************
 * Action 相容
 ****************************************************/

function normalizeAction(action) {
  const value = String(action || "").toLowerCase();

  if (
    value === "source" ||
    value === "getsourcedata" ||
    value === "listworkorders" ||
    value === "workorders" ||
    value === "latestorders" ||
    value === "keyinsource" ||
    value === "getkeyinsource"
  ) {
    return "keyinsource";
  }

  return action;
}

/****************************************************
 * 回傳陣列解析
 ****************************************************/

function rowsOf(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.list)) {
    return data.list;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.result?.rows)) {
    return data.result.rows;
  }

  if (Array.isArray(data?.result?.data)) {
    return data.result.data;
  }

  return [];
}

/****************************************************
 * GET / JSONP
 ****************************************************/

function get(action, args = [], params = {}) {
  return new Promise((resolve, reject) => {
    const realAction = normalizeAction(action);

    const callbackName =
      "__mes_cb_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 1000000);

    const url = new URL(MES_API_URL);

    url.searchParams.set("action", realAction);
    url.searchParams.set("callback", callbackName);

    Object.keys(params || {}).forEach(key => {
      const value = params[key];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        url.searchParams.set(key, value);
      }
    });

    const script = document.createElement("script");

    script.async = true;
    script.src = url.toString();

    const timer = setTimeout(() => {
      cleanup();

      reject(
        new Error(
          "API 讀取逾時：" + realAction
        )
      );
    }, 60000);

    function cleanup() {
      clearTimeout(timer);

      try {
        delete window[callbackName];
      } catch (error) {
        window[callbackName] = undefined;
      }

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = function (data) {
      cleanup();

      const rows = rowsOf(data);

      resolve({
        ...(data || {}),

        ok:
          data?.ok !== false &&
          data?.success !== false,

        success:
          data?.success !== false &&
          data?.ok !== false,

        rows,
        data: rows,
        list: rows,

        total:
          Number(data?.total) ||
          Number(data?.count) ||
          rows.length
      });
    };

    script.onerror = function () {
      cleanup();

      reject(
        new Error(
          "API 讀取失敗：" + realAction
        )
      );
    };

    document.body.appendChild(script);
  });
}

/****************************************************
 * 限時執行
 ****************************************************/

function apiTimeout_(promise, timeoutMs, message) {
  let timer = null;

  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          message || "API 回應逾時"
        )
      );
    }, timeoutMs);
  });

  return Promise.race([
    Promise.resolve(promise),
    timeout
  ]).finally(() => {
    clearTimeout(timer);
  });
}

/****************************************************
 * Key In 工單來源
 ****************************************************/

function getKeyinSource(params = {}) {
  return get(
    "keyinsource",
    [],
    params
  );
}

/****************************************************
 * Key In 唯一識別碼
 ****************************************************/

function makeKeyinId_() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return (
      "KI-" +
      window.crypto.randomUUID()
    );
  }

  return (
    "KI-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 12)
  );
}

/****************************************************
 * 等待
 ****************************************************/

function sleep_(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

/****************************************************
 * Key In 驗證工具
 ****************************************************/

function verifyText_(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function verifyNumber_(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function keyinRowMatches_(row, payload) {
  row = row || {};
  payload = payload || {};

  const expectedId =
    verifyText_(payload.keyin_id);

  const actualId =
    verifyText_(row.keyin_id);

  /*
   * 第一順位：
   * 使用本次送出的唯一 keyin_id 判定。
   */
  if (
    expectedId &&
    actualId &&
    expectedId === actualId
  ) {
    return true;
  }

  /*
   * 舊後端若沒有保存 keyin_id，
   * 使用主要欄位做第二順位驗證。
   */
  const expectedWorkOrder =
    verifyText_(
      payload.work_order_no ||
      payload.order_no
    );

  const actualWorkOrder =
    verifyText_(
      row.work_order_no ||
      row.order_no
    );

  const expectedEmployee =
    verifyText_(payload.emp_no);

  const actualEmployee =
    verifyText_(row.emp_no);

  const expectedMachine =
    verifyText_(
      payload.machine_code ||
      payload.machine
    );

  const actualMachine =
    verifyText_(
      row.machine_code ||
      row.machine
    );

  const expectedDate =
    verifyText_(payload.report_date);

  const actualDate =
    verifyText_(row.report_date);

  const expectedQuantity =
    verifyNumber_(payload.actual_output);

  const actualQuantity =
    verifyNumber_(row.actual_output);

  const sameQuantity =
    expectedQuantity !== null &&
    actualQuantity !== null &&
    Math.abs(
      expectedQuantity - actualQuantity
    ) < 0.000001;

  const sameDate =
    !expectedDate ||
    expectedDate === actualDate;

  return (
    expectedWorkOrder &&
    expectedWorkOrder === actualWorkOrder &&
    expectedEmployee === actualEmployee &&
    expectedMachine === actualMachine &&
    sameQuantity &&
    sameDate
  );
}

/****************************************************
 * 回讀 keyin 工作表確認
 ****************************************************/

async function verifyKeyinSaved_(
  payload,
  attempts = 6,
  intervalMs = 1800
) {
  let lastError = null;
  let lastTotal = 0;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt++
  ) {
    if (attempt > 1) {
      await sleep_(intervalMs);
    }

    try {
      const response = await apiTimeout_(
        get(
          "listKeyin",
          [],
          {
            limit: 5000,
            _: Date.now()
          }
        ),
        7000,
        "Key In 雲端回讀逾時"
      );

      const rows = rowsOf(response);

      lastTotal = rows.length;

      const matchedRow = rows.find(row => {
        return keyinRowMatches_(
          row,
          payload
        );
      });

      if (matchedRow) {
        return {
          ok: true,
          success: true,
          verified: true,

          action: "saveKeyin",

          keyin_id:
            payload.keyin_id,

          row:
            matchedRow,

          total:
            rows.length,

          message:
            "Key In 已確認寫入雲端"
        };
      }
    } catch (error) {
      lastError = error;

      console.warn(
        "[Key In 雲端驗證]",
        "第 " + attempt + " 次失敗",
        error
      );
    }
  }

  const reason = lastError
    ? String(
        lastError.message ||
        lastError
      )
    : (
        "回讀到 " +
        lastTotal +
        " 筆資料，但找不到本次送出的 keyin_id"
      );

  throw new Error(
    "Key In 尚未確認寫入雲端：" +
    reason +
    "。畫面資料已保留，請勿連續重複送出。"
  );
}

/****************************************************
 * POST
 ****************************************************/

async function post(action, data = {}) {
  const normalizedAction =
    String(action || "")
      .toLowerCase()
      .trim();

  const isKeyin =
    normalizedAction === "savekeyin" ||
    normalizedAction === "keyin";

  const payload = {
    ...data,
    action
  };

  /*
   * 每一筆 Key In 都產生唯一 ID。
   * 後端 KEYIN_HEADERS 已包含 keyin_id。
   */
  if (
    isKeyin &&
    !payload.keyin_id
  ) {
    payload.keyin_id =
      makeKeyinId_();
  }

  const url = buildUrl(action);

  try {
    /*
     * Google Apps Script Web App 跨網域 POST。
     *
     * no-cors 無法直接讀取後端回傳內容，
     * 因此 Key In 必須在 POST 後回讀工作表驗證。
     */
    await apiTimeout_(
      fetch(url, {
        method: "POST",

        mode: "no-cors",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body:
          JSON.stringify(payload)
      }),
      15000,
      "POST 傳送逾時"
    );

    /*
     * Key In 必須確認資料已經存在於雲端。
     */
    if (isKeyin) {
      return await verifyKeyinSaved_(
        payload
      );
    }

    /*
     * 其他舊功能目前維持原有 POST 相容性。
     */
    return {
      ok: true,
      success: true,
      verified: false,

      action,

      message:
        "POST 已送出：" + action
    };
  } catch (error) {
    throw new Error(
      "POST 失敗：" +
      String(
        error?.message ||
        error
      )
    );
  }
}

/****************************************************
 * Toast
 ****************************************************/

function toast(message) {
  let box =
    document.getElementById("toast");

  if (!box) {
    box =
      document.createElement("div");

    box.id = "toast";
    box.className = "toast";

    document.body.appendChild(box);
  }

  box.textContent =
    String(message || "");

  box.classList.add("show");

  setTimeout(() => {
    box.classList.remove("show");
  }, 1800);
}

/****************************************************
 * 共用小工具
 ****************************************************/

function getVal(id) {
  const element =
    document.getElementById(id);

  return element
    ? String(
        element.value || ""
      ).trim()
    : "";
}

function setVal(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.value =
      value == null
        ? ""
        : value;
  }
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function esc(value) {
  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character])
    );
}

function wo12(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .slice(0, 12);
}

function today() {
  const date = new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return (
    year +
    "-" +
    month +
    "-" +
    day
  );
}
