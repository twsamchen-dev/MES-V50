const KEYIN_SHEET = "keyin";
const SOURCE_SHEET = "source_data";
const EMPLOYEE_SHEET = "Employee";
const TARGET_SHEET = "Target_Plan";

const KEYIN_HEADERS = [
  "site","report_date","order_no","part_no","batch_no",
  "work_order_no","machine_code","product_spec","target_qty",
  "actual_output","unit","convert_m2","emp_no","emp_name",
  "process_note","achievement_rate","input_source","created_at"
];

const SOURCE_HEADERS = [
  "source","work_order_no","order_no","part_no","batch_no",
  "product_spec","target_qty","process","customer","machine",
  "plan_date","due_date","status","issue_status","material_status",
  "warehouse_status","stockin_date","finish_date","pick_date",
  "priority","raw_json","updated_at"
];

const TARGET_HEADERS = [
  "plan_id","created_at","updated_at","report_date","shift",
  "leader_no","leader_role","leader_name",
  "work_order_no","order_no","part_no","batch_no","customer","product_spec",
  "process_site","machine_code","target_roll","target_m2",
  "planned_start","planned_finish","priority","remark","status"
];

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  const action = String(p.action || "").toLowerCase();
  const mode = String(p.mode || "").toLowerCase();

  // API 分流
  if (action === "test") {
    return json_({ ok:true, message:"API 連線正常", time:new Date() });
  }
  if (action === "source") {
    return json_(getSourceData());
  }
  if (action === "list") {
    return json_(listKeyin());
  }
  if (action === "targets") {
    return json_(listTargetPlans(p.date));
  }
  if (action === "employees") {
    return json_(listEmployees());
  }

  // 頁面分流
  if (mode === "target") {
    return HtmlService.createHtmlOutputFromFile("Target")
      .setTitle("MES 幹部目標管理")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === "admin") {
    return HtmlService.createHtmlOutputFromFile("Dashboard")
      .setTitle("MES 生產戰情室")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("MES 生產 Key In")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function setupSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    return sh;
  }

  // 若舊版分頁缺少新欄位，自動補在右側，避免覆蓋既有資料。
  const existing = sh.getRange(1,1,1,Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0]
    .map(function(h){ return String(h || "").trim(); });
  const missing = headers.filter(function(h){ return existing.indexOf(h) < 0; });

  if (missing.length) {
    sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }

  return sh;
}

function getKeyinSheet_() { return setupSheet_(KEYIN_SHEET, KEYIN_HEADERS); }
function getSourceSheet_() { return setupSheet_(SOURCE_SHEET, SOURCE_HEADERS); }
function getTargetSheet_() { return setupSheet_(TARGET_SHEET, TARGET_HEADERS); }

function getHeaders_(sh) {
  if (!sh || sh.getLastRow() === 0) return [];
  return sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getDisplayValues()[0]
    .map(function(h){ return String(h || "").trim(); });
}

function rowObject_(headers, row) {
  const obj = {};
  headers.forEach(function(h, i){ obj[h] = row[i] || ""; });
  return obj;
}

function setRowByObject_(sh, rowIndex, headers, obj) {
  const values = headers.map(function(h){ return obj[h] !== undefined ? obj[h] : ""; });
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([values]);
}

function normalizeDate_(v) {
  const s = String(v || "").trim().replace(/\//g, "-");
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[3]).padStart(2, "0");
  return s.slice(0,10);
}

function normalizeText_(v) {
  return String(v || "").trim().replace(/\s+/g, "").toUpperCase();
}

function workOrder12_(v) {
  return normalizeText_(v).slice(0, 12);
}

function nowText_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
}

function newId_() {
  return "TP-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss") + "-" + Math.floor(Math.random()*10000);
}

function saveKeyin(data) {
  const sh = getKeyinSheet_();
  sh.appendRow([
    data.site || "", data.report_date || "", data.order_no || "", data.part_no || "", data.batch_no || "",
    workOrder12_(data.work_order_no || data.order_no || ""), data.machine_code || "", data.product_spec || "", data.target_qty || "",
    data.actual_output || "", data.unit || "", data.convert_m2 || "", data.emp_no || "", data.emp_name || "",
    data.process_note || "", data.achievement_rate || "", data.input_source || "mobile_keyin",
    nowText_()
  ]);
  return { ok:true };
}

function replaceSourceData(rows) {
  const sh = getSourceSheet_();
  sh.clearContents();
  sh.getRange(1,1,1,SOURCE_HEADERS.length).setValues([SOURCE_HEADERS]);
  if (!rows || !rows.length) return { ok:true, count:0 };

  const now = nowText_();
  const values = rows.map(function(r) {
    return [
      r.source || "", r.work_order_no || "", r.order_no || "", r.part_no || "", r.batch_no || "",
      r.product_spec || "", r.target_qty || "", r.process || "", r.customer || "", r.machine || "",
      r.plan_date || "", r.due_date || "", r.status || "", r.issue_status || "", r.material_status || "",
      r.warehouse_status || "", r.stockin_date || "", r.finish_date || "", r.pick_date || "",
      r.priority || "", typeof r.raw_json === "string" ? r.raw_json : JSON.stringify(r), now
    ];
  });
  sh.getRange(2,1,values.length,SOURCE_HEADERS.length).setValues(values);
  return { ok:true, count:values.length };
}

function getSourceData() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SOURCE_SHEET);
  if (!sh) return { ok:true, count:0, rows:[] };
  const values = sh.getDataRange().getDisplayValues();
  if (values.length <= 1) return { ok:true, count:0, rows:[] };

  let headers = values[0].map(function(h){ return String(h || "").trim(); });
  const fallback = ["source","work_order_no","order_no","part_no","batch_no","product_spec","target_qty","process","customer","machine","raw_json","updated_at"];
  if (headers.indexOf("work_order_no") < 0) headers = fallback;

  const rows = values.slice(1).map(function(row) {
    const obj = rowObject_(headers, row);
    SOURCE_HEADERS.forEach(function(h){ if (obj[h] === undefined) obj[h] = ""; });
    if (!obj.work_order_no && obj.order_no) obj.work_order_no = obj.order_no;
    return obj;
  }).filter(function(o){ return String(o.work_order_no || o.order_no || o.batch_no || "").trim() !== ""; });

  return { ok:true, count:rows.length, rows:rows };
}

function listKeyin() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEYIN_SHEET);
  if (!sh) return { ok:true, count:0, rows:[] };
  const values = sh.getDataRange().getDisplayValues();
  if (values.length <= 1) return { ok:true, count:0, rows:[] };

  const headers = values[0].map(function(h){ return String(h || "").trim(); });
  const rows = values.slice(1).map(function(row) {
    return rowObject_(headers, row);
  });
  return { ok:true, count:rows.length, rows:rows };
}

function saveTargetPlan(data) {
  const sh = getTargetSheet_();
  const headers = getHeaders_(sh);
  const now = nowText_();
  const planId = data.plan_id || newId_();

  const obj = {
    plan_id: planId,
    created_at: now,
    updated_at: now,
    report_date: data.report_date || "",
    shift: data.shift || "",
    leader_no: data.leader_no || "",
    leader_role: data.leader_role || "",
    leader_name: data.leader_name || "",
    work_order_no: workOrder12_(data.work_order_no || data.order_no || ""),
    order_no: data.order_no || "",
    part_no: data.part_no || "",
    batch_no: data.batch_no || "",
    customer: data.customer || "",
    product_spec: data.product_spec || "",
    process_site: data.process_site || "",
    machine_code: data.machine_code || "",
    target_roll: data.target_roll || "",
    target_m2: data.target_m2 || "",
    planned_start: data.planned_start || "",
    planned_finish: data.planned_finish || "",
    priority: data.priority || "一般",
    remark: data.remark || "",
    status: data.status || "已送出"
  };

  // 若已有 plan_id，更新同一筆；否則檢查同日期 + 同工單 + 同機台是否已存在，避免重複建立目標。
  const idCol = headers.indexOf("plan_id");
  if (sh.getLastRow() > 1) {
    const body = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getDisplayValues();

    if (data.plan_id && idCol >= 0) {
      for (var i = 0; i < body.length; i++) {
        const oldObj = rowObject_(headers, body[i]);
        if (String(oldObj.plan_id || "") === String(data.plan_id || "")) {
          const rowIndex = i + 2;
          obj.created_at = oldObj.created_at || now;
          setRowByObject_(sh, rowIndex, headers, obj);
          return { ok:true, mode:"update", plan_id:planId, message:"已更新原目標" };
        }
      }
    }

    const newDate = normalizeDate_(obj.report_date);
    const newWo = workOrder12_(obj.work_order_no || obj.order_no);
    const newMachine = normalizeText_(obj.machine_code);
    for (var j = 0; j < body.length; j++) {
      const oldObj = rowObject_(headers, body[j]);
      const sameDate = normalizeDate_(oldObj.report_date) === newDate;
      const sameWo = workOrder12_(oldObj.work_order_no || oldObj.order_no) === newWo;
      const sameMachine = !newMachine || !normalizeText_(oldObj.machine_code) || normalizeText_(oldObj.machine_code) === newMachine;
      if (sameDate && sameWo && sameMachine) {
        const rowIndex = j + 2;
        obj.plan_id = oldObj.plan_id || planId;
        obj.created_at = oldObj.created_at || now;
        setRowByObject_(sh, rowIndex, headers, obj);
        return { ok:true, mode:"update_existing", plan_id:obj.plan_id, message:"同日同工單目標已存在，已自動更新" };
      }
    }
  }

  setRowByObject_(sh, sh.getLastRow() + 1, headers, obj);
  return { ok:true, mode:"insert", plan_id:planId, message:"已新增目標" };
}

function listTargetPlans(date) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_SHEET);
  if (!sh) return { ok:true, count:0, rows:[] };

  // 自動補欄，確保 leader_no / customer / plan_id 可以使用。
  setupSheet_(TARGET_SHEET, TARGET_HEADERS);

  const values = sh.getDataRange().getDisplayValues();
  if (values.length <= 1) return { ok:true, count:0, rows:[] };

  const headers = values[0].map(function(h){ return String(h || "").trim(); });
  const rows = values.slice(1).map(function(row) {
    const obj = rowObject_(headers, row);
    TARGET_HEADERS.forEach(function(h){ if (obj[h] === undefined) obj[h] = ""; });

    // 舊資料沒有 plan_id 時仍可顯示，但編輯/刪除需重新儲存後才會有 plan_id。
    obj.report_date = normalizeDate_(obj.report_date);
    return obj;
  }).filter(function(o){
    if (!date) return true;
    return normalizeDate_(o.report_date) === normalizeDate_(date);
  });

  return { ok:true, count:rows.length, rows:rows };
}

function deleteTargetPlan(planId) {
  if (!planId) return { ok:false, message:"缺少 plan_id" };

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_SHEET);
  if (!sh) return { ok:false, message:"找不到 Target_Plan 分頁" };

  const headers = getHeaders_(sh);
  const idCol = headers.indexOf("plan_id");
  if (idCol < 0) return { ok:false, message:"Target_Plan 缺少 plan_id 欄位，請先重新儲存目標資料" };

  if (sh.getLastRow() <= 1) return { ok:false, message:"沒有資料可刪除" };

  const ids = sh.getRange(2, idCol + 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function(r){ return r[0]; });
  const idx = ids.indexOf(planId);
  if (idx < 0) return { ok:false, message:"找不到指定目標：" + planId };

  sh.deleteRow(idx + 2);
  return { ok:true };
}

function listEmployees() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(EMPLOYEE_SHEET);

  if (!sh) {
    return { ok:false, message:"找不到 Employee 分頁", count:0, rows:[] };
  }

  const values = sh.getDataRange().getDisplayValues();
  if (values.length <= 1) return { ok:true, count:0, rows:[] };

  const headers = values[0].map(function(h){ return String(h || "").trim(); });

  const rows = values.slice(1).map(function(row){
    const obj = {};
    headers.forEach(function(h, i){ obj[h] = row[i] || ""; });

    return {
      emp_no: obj.emp_no || obj["工號"] || row[0] || "",
      emp_name: obj.emp_name || obj["姓名"] || row[1] || "",
      position: obj.position || obj["職稱"] || row[2] || "",
      shift: obj.shift || obj["班別"] || row[3] || "",
      nation: obj.nation || obj["國籍"] || row[4] || "",
      enable: obj.enable || obj["可登入"] || row[5] || "Y"
    };
  }).filter(function(r){
    return r.emp_no && String(r.enable || "Y").toUpperCase() !== "N";
  });

  return { ok:true, count:rows.length, rows:rows };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
