/* MES V60 shared API: GitHub Pages + Apps Script */
window.MES_API_URL = window.MES_API_URL || "https://script.google.com/macros/s/AKfycbyW4ayFKOWHRUWAvMNgKfXcnEsTDsXoq3Dxd9ki97dEdeXuhPuJ7sVvhEsm-o6wf1V3/exec";
const MES = (()=>{
  const API_URL = window.MES_API_URL;
  const isGas = !!(window.google && google.script && google.script.run);
  const actionMap = {getSourceData:'source',listKeyin:'list',listEmployees:'employees',listTargetPlans:'targets',listProd5CData:'prod5c',listProd53Data:'prod53',saveKeyin:'savekeyin',saveTargetPlan:'savetargetplan',deleteTargetPlan:'deletetargetplan'};
  function toast(msg){const t=document.getElementById('toast'); if(t){t.textContent=msg;t.className='toast show';setTimeout(()=>t.className='toast',2600)}else alert(msg)}
  function qs(obj){return Object.keys(obj||{}).filter(k=>obj[k]!==undefined&&obj[k]!==null&&obj[k]!=="").map(k=>encodeURIComponent(k)+'='+encodeURIComponent(obj[k])).join('&')}
  function jsonp(action, params={}, timeout=60000){
    return new Promise((resolve,reject)=>{
      const cb='MES_JSONP_'+Date.now()+'_'+Math.floor(Math.random()*999999);
      const s=document.createElement('script'); let done=false;
      const timer=setTimeout(()=>{cleanup();reject(new Error('API timeout'))},timeout);
      function cleanup(){clearTimeout(timer);try{delete window[cb]}catch(e){window[cb]=undefined} if(s.parentNode)s.parentNode.removeChild(s)}
      window[cb]=(res)=>{if(done)return;done=true;cleanup(); if(res&&res.ok===false)reject(new Error(res.error||res.message||'API error')); else resolve(res)};
      s.onerror=()=>{if(done)return;done=true;cleanup();reject(new Error('JSONP 連線失敗'))};
      s.src=API_URL+'?'+qs(Object.assign({action,callback:cb,_:Date.now()},params)); document.head.appendChild(s);
    });
  }
  function gasCall(name,args=[]){return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[name](...args))}
  async function get(name,args=[], params={}){const action=actionMap[name]||String(name).toLowerCase(); if(isGas)return gasCall(name,args); return retry(()=>jsonp(action,params),3)}
  async function post(name,data){
    const action=actionMap[name]||String(name).toLowerCase();
    if(isGas)return gasCall(name,[data]);
    // Apps Script cross-domain POST cannot reliably return CORS response. Send no-cors then verify by reloading via JSONP.
    await fetch(API_URL+'?action='+encodeURIComponent(action)+'&_='+Date.now(), {method:'POST',mode:'no-cors',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data||{})});
    return {ok:true, mode:'sent_no_cors', message:'已送出，系統將重新讀取確認'};
  }
  async function retry(fn,n){let err;for(let i=0;i<n;i++){try{return await fn()}catch(e){err=e;await new Promise(r=>setTimeout(r,800*(i+1)))}}throw err}
  return {get,post,toast, API_URL};
})();
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(v){const n=parseFloat(String(v||'').replace(/,/g,''));return isNaN(n)?0:n}
function norm(v){return String(v||'').trim().toUpperCase()}
function wo12(v){return norm(v).replace(/\s+/g,'').slice(0,12)}
function today(){const d=new Date();return d.getFullYear()+"/"+String(d.getMonth()+1).padStart(2,'0')+"/"+String(d.getDate()).padStart(2,'0')}
function setVal(id,v){const e=document.getElementById(id);if(e)e.value=v||''}
function getVal(id){const e=document.getElementById(id);return e?e.value:''}
