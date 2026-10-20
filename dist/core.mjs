export const VERSION = 1;
export const EVENTS = ['被甩锅','反复改稿','无效开会','临时加班','想离职','其他'];
export const TYPES = ['离职底气','快乐放假','奖励自己'];
export const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const emptyState = () => ({schema:VERSION,revision:0,goals:[],entries:[],pending:[],preferences:{hideMoney:false,customEvents:[]},savedAt:null});
export const characters = value => typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(value)].length : Array.from(value).length;
export function today(date=new Date()) { const p = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date); return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-'); }
export const money = cents => (cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
export const plainMoney = cents => (cents/100).toFixed(2);
export function cents(value,min=1,max=1000000) { const s=String(value).trim(); if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(s)) throw Error('请输入有效金额，最多保留两位小数'); const [a,b='']=s.split('.'); const n=Number(a)*100+Number(b.padEnd(2,'0')); if(!Number.isSafeInteger(n)||n<min||n>max) throw Error(`金额须在 ¥${plainMoney(min)} 至 ¥${plainMoney(max)} 之间`); return n; }
export function progress(a,t) {if(a===0)return '0%';if(a>=t)return '100%';const v=a/t*100;if(v<.1)return '<0.1%';return `${Math.min(99.9,Math.round(v*10)/10)}%`;}
export const activeGoal = s => s.goals.find(g=>g.status==='active');
export const records = (s,id) => s.entries.filter(e=>e.goalId===id).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
export function totals(s,id) { return records(s,id).reduce((a,e)=>({amount:a.amount+e.amount,transferred:a.transferred+(e.transferred?e.amount:0),count:a.count+1}),{amount:0,transferred:0,count:0}); }
function goal(s,id,write=false) {const g=s.goals.find(x=>x.id===id);if(!g)throw Error('找不到这个存钱罐');if(write&&g.status!=='active')throw Error('归档目标为只读，不能修改');return g;}
function name(value){const n=String(value||'').trim();if(!n||characters(n)>20)throw Error('罐子名称需要 1 至 20 个字');return n;}
export function createGoal(s,input) { if(activeGoal(s))throw Error('请先归档当前罐子，再创建新目标');if(s.goals.length>=100)throw Error('最多保留100个目标，请先备份');if(!TYPES.includes(input.type))throw Error('请选择目标类型');const g={id:input.id||uuid(),type:input.type,name:name(input.name),target:cents(input.target,100,100000000),defaultAmount:cents(input.defaultAmount),status:'active',createdAt:new Date().toISOString(),archivedAt:null};s.goals.push(g);return g; }
export function editGoal(s,id,input){const g=goal(s,id,true);g.name=name(input.name);g.target=cents(input.target,100,100000000);g.defaultAmount=cents(input.defaultAmount);return g;}
export const customEvents = s => s.preferences?.customEvents || [];
export const eventOptions = s => [...EVENTS.filter(e=>e!=='其他'),...customEvents(s),'其他'];
export function eventName(value) {
  if(typeof value!=='string')throw Error('请填写事项名称');
  const v=value.trim().normalize('NFC');
  if(!v||characters(v)>20||/[\u0000-\u001f\u007f]/.test(v))throw Error('事项名称需要 1 至 20 个字，不能包含换行');
  return v;
}
export function addCustomEvent(s,value) {
  const v=eventName(value);
  if(EVENTS.includes(v)||customEvents(s).includes(v))return v;
  if(customEvents(s).length>=20)throw Error('最多保存20个常用事项。请先移除不常用的事项，或取消勾选“设为常用事项”');
  s.preferences??={hideMoney:false};
  s.preferences.customEvents=[...customEvents(s),v];
  return v;
}
export function removeCustomEvent(s,value) {
  s.preferences??={hideMoney:false};
  s.preferences.customEvents=customEvents(s).filter(v=>v!==value);
}
export function saveEntry(s,input) {
  const g=goal(s,input.goalId,true);
  const old=s.entries.find(e=>e.id===input.id);
  if(old&&input.isNew)return old;
  if(old&&old.goalId!==g.id)throw Error('记录归属不匹配');
  if(!old&&s.entries.length+s.pending.length>=10000)throw Error('记录已达10000条，请先备份');
  let event=input.event;
  const hasCustom=event==='其他'&&typeof input.customEvent==='string'&&input.customEvent.trim()!=='';
  if(hasCustom)event=eventName(input.customEvent);
  else if(!eventOptions(s).includes(event)&&event!==old?.event)throw Error('请选择发生的事情');
  const amount=cents(input.amount),note=String(input.note||'');
  if(characters(note)>200)throw Error('吐槽最多200个字');
  const d=input.date||today();
  if(!validDate(d)||d<today(new Date(g.createdAt))||d>today())throw Error('记录日期需在创建目标当天至今天之间');
  const e={id:old?.id||input.id||uuid(),goalId:g.id,event,amount,note,date:d,transferred:input.transferred===true,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),revision:(old?.revision||0)+1};
  if(hasCustom&&input.rememberCustom===true)addCustomEvent(s,event);
  if(old)s.entries[s.entries.indexOf(old)]=e;else s.entries.push(e);
  return e;
}
export function toggleTransfer(s,id,value){const e=s.entries.find(x=>x.id===id);if(!e)throw Error('记录已删除');goal(s,e.goalId,true);e.transferred=value===true;e.revision++;return e;}
export function deleteEntry(s,id,now=Date.now()){const e=s.entries.find(x=>x.id===id);if(!e)return null;goal(s,e.goalId,true);s.entries=s.entries.filter(x=>x.id!==id);s.pending.push({entry:e,deadline:now+10000});return id;}
export function restoreEntry(s,id,now=Date.now()){const p=s.pending.find(x=>x.entry.id===id);if(!p||p.deadline<=now)throw Error('恢复时间已过，这笔记录已删除');goal(s,p.entry.goalId,true);if(!s.entries.some(x=>x.id===id))s.entries.push(p.entry);s.pending=s.pending.filter(x=>x.entry.id!==id);}
export function purge(s,now=Date.now()){s.pending=s.pending.filter(p=>p.deadline>now);return s;}
export function archiveGoal(s,id){const g=goal(s,id,true);g.status='archived';g.archivedAt=new Date().toISOString();s.pending=s.pending.filter(p=>p.entry.goalId!==id);return g;}
export function removeGoal(s,id){goal(s,id);s.goals=s.goals.filter(g=>g.id!==id);s.entries=s.entries.filter(e=>e.goalId!==id);s.pending=s.pending.filter(p=>p.entry.goalId!==id);}
export function validDate(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
export function backup(s){return {schema:VERSION,exportedAt:new Date().toISOString(),goals:s.goals,entries:s.entries,preferences:s.preferences};}
export function validateBackup(data){if(!data||Object.getPrototypeOf(data)!==Object.prototype||data.schema!==VERSION)throw Error('备份格式或版本不受支持，请使用 V1.0 导出的 JSON 文件');if(!Array.isArray(data.goals)||!Array.isArray(data.entries)||data.goals.length>100||data.entries.length>10000)throw Error('备份超过容量或数据格式不正确');const s=emptyState();const ids=new Set();let active=0;for(const x of data.goals){if(!x||typeof x.id!=='string'||!x.id||x.id.length>100||ids.has(x.id))throw Error('目标ID重复或无效');ids.add(x.id);if(!TYPES.includes(x.type)||!['active','archived'].includes(x.status)||!validTimestamp(x.createdAt)||!Number.isSafeInteger(x.target)||x.target<100||x.target>100000000||!Number.isSafeInteger(x.defaultAmount)||x.defaultAmount<1||x.defaultAmount>1000000)throw Error('目标字段不正确');if(x.status==='active')active++;s.goals.push({id:x.id,type:x.type,name:name(x.name),target:x.target,defaultAmount:x.defaultAmount,status:x.status,createdAt:x.createdAt,archivedAt:x.status==='archived'?(validTimestamp(x.archivedAt)?x.archivedAt:x.createdAt):null});}if(active>1)throw Error('备份中有多个未归档目标');ids.clear();for(const x of data.entries){const g=s.goals.find(g=>g.id===x?.goalId);if(!x||typeof x.id!=='string'||!x.id||x.id.length>100||ids.has(x.id)||!g||typeof x.event!=='string'||!Number.isSafeInteger(x.amount)||x.amount<1||x.amount>1000000||typeof x.note!=='string'||characters(x.note)>200||typeof x.transferred!=='boolean'||!validDate(x.date)||x.date<today(new Date(g.createdAt))||x.date>today()||!validTimestamp(x.createdAt))throw Error('记录字段无效、日期不合法或ID重复');ids.add(x.id);s.entries.push({id:x.id,goalId:g.id,event:eventName(x.event),amount:x.amount,note:x.note,date:x.date,transferred:x.transferred,createdAt:x.createdAt,updatedAt:validTimestamp(x.updatedAt)?x.updatedAt:x.createdAt,revision:Number.isSafeInteger(x.revision)&&x.revision>0?x.revision:1});}const raw=data.preferences?.customEvents;
  if(raw!==undefined&&(!Array.isArray(raw)||raw.length>20))throw Error('常用事项备份格式不正确或超过20个');
  const labels=(raw||[]).map(eventName);
  if(new Set(labels).size!==labels.length||labels.some(v=>EVENTS.includes(v)))throw Error('常用事项不能重复或与默认事项同名');
  s.preferences={hideMoney:data.preferences?.hideMoney===true,customEvents:labels};return s;}
function validTimestamp(x){return typeof x==='string'&&x.length<40&&Number.isFinite(Date.parse(x));}
