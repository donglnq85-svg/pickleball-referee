import {assignmentMatches,matchPlayers} from './tournament-domain.js';

const clone=value=>structuredClone(value);
const iso=value=>new Date(value??Date.now()).toISOString();
const unknown='Chưa có';

export function ensureRefereeWorkspace(t){
  t.refereeWorkspace??={
    version:1,
    profile:{date:null,time:null,location:null,notes:null,organizerInfo:null,commitment:'planned'},
    attendance:{},
    assignmentMeta:{},
    changeLog:[]
  };
  t.refereeWorkspace.profile??={date:null,time:null,location:null,notes:null,organizerInfo:null,commitment:'planned'};
  t.refereeWorkspace.attendance??={};
  t.refereeWorkspace.assignmentMeta??={};
  t.refereeWorkspace.changeLog??=[];
  return t.refereeWorkspace;
}

export function workProfile(t){return clone(ensureRefereeWorkspace(t).profile)}

export function updateWorkProfile(t,patch,at=Date.now()){
  const workspace=ensureRefereeWorkspace(t),before=clone(workspace.profile);
  workspace.profile={...workspace.profile,...Object.fromEntries(Object.entries(patch).map(([key,value])=>[key,typeof value==='string'?(value.trim()||null):value]))};
  if(!['accepted','planned'].includes(workspace.profile.commitment))workspace.profile.commitment='planned';
  if(patch.name!==undefined)t.name=String(patch.name||'').trim()||'Chưa có tên giải';
  const changed=Object.keys({...before,...workspace.profile}).filter(key=>before[key]!==workspace.profile[key]);
  if(changed.length)workspace.changeLog.push({at:iso(at),kind:'Thông tin giải',changed});
  t.updatedAt=iso(at);return workProfile(t);
}

export function recordSettingsChange(t,rulesVersionId,at=Date.now()){
  const workspace=ensureRefereeWorkspace(t);workspace.changeLog.push({at:iso(at),kind:'Cài đặt giải',rulesVersionId});return workspace.changeLog.at(-1);
}

export function setAssignmentPresentation(t,assignmentId,{courtId=null,groupIds=[]}={}){
  const workspace=ensureRefereeWorkspace(t);workspace.assignmentMeta[assignmentId]={courtId:courtId||null,groupIds:[...groupIds]};return clone(workspace.assignmentMeta[assignmentId]);
}

export function scopedEntries(t,assignmentId){
  const matches=assignmentMatches(t,assignmentId),ids=new Set();
  for(const match of matches)for(const id of Object.values(match.entrantIds||{}))if(id)ids.add(id);
  return [...ids].map(id=>{const entry=t.structure.entries.find(item=>item.id===id);return entry?{...clone(entry),players:entry.playerIds.map(playerId=>t.structure.players.find(player=>player.id===playerId)?.displayName||unknown)}:null}).filter(Boolean);
}

export function setAttendance(t,entryId,status,at=Date.now()){
  if(!['present','missing','unknown'].includes(status))throw Error('Trạng thái điểm danh không hợp lệ.');
  if(!t.structure.entries.some(entry=>entry.id===entryId))throw Error('Không tìm thấy VĐV hoặc cặp đấu.');
  const workspace=ensureRefereeWorkspace(t);workspace.attendance[entryId]={status,at:iso(at)};t.updatedAt=iso(at);return clone(workspace.attendance[entryId]);
}

export function attendanceStatus(t,entryId){return ensureRefereeWorkspace(t).attendance[entryId]?.status||'unknown'}

const resultFor=(t,matchId)=>{const ledger=t.resultLedger?.byMatch?.[matchId];return ledger?.versions?.find(item=>item.id===ledger.currentVersionId)||null};
const endedAt=(t,match)=>resultFor(t,match.id)?.matchEndedAt||null;
const elapsedMinutes=(value,at)=>value===null?null:Math.max(0,Math.floor((at-Date.parse(value))/60000));

export function smartMatchQueue(t,workSessionId,matchRepository,at=Date.now()){
  const work=t.workSessions.find(item=>item.id===workSessionId);if(!work)return {recommended:null,items:[]};
  const matches=assignmentMatches(t,work.assignmentId),finishedByGroup=new Map();
  for(const match of matches){const session=match.matchSessionId&&matchRepository?.get(match.matchSessionId);if(session?.status==='finished')finishedByGroup.set(match.groupId,(finishedByGroup.get(match.groupId)||0)+1)}
  const lastPlayed=new Map();
  for(const match of t.schedule){const end=endedAt(t,match);if(!end)continue;for(const entryId of Object.values(match.entrantIds||{}))if(entryId&&(!lastPlayed.has(entryId)||Date.parse(end)>Date.parse(lastPlayed.get(entryId))))lastPlayed.set(entryId,end)}
  const items=matches.map(match=>{
    const session=match.matchSessionId&&matchRepository?.get(match.matchSessionId),result=resultFor(t,match.id),ids=Object.values(match.entrantIds||{}).filter(Boolean),attendance=ids.map(id=>attendanceStatus(t,id));
    const rests=ids.map(id=>elapsedMinutes(lastPlayed.get(id)||null,at)).filter(value=>value!==null),minimumRest=rests.length?Math.min(...rests):null;
    let eligible=true,score=0,reason='Có thể chuẩn bị gọi VĐV';
    if(session?.status==='finished'||result?.status==='CONFIRMED'){eligible=false;reason='Trận đã hoàn thành'}
    else if(session&&session.status!=='finished'){eligible=false;score=1000;reason='Trận đang thi đấu'}
    else if(match.operations?.waiting?.status==='waiting'){score=900;reason='Đang chờ VĐV — cần tiếp tục xử lý'}
    else if(match.operations?.waiting?.status==='resolved_no_show'){eligible=false;reason='Đã ghi nhận vắng mặt; chờ quyết định tiếp theo'}
    else if(match.readiness==='blocked'){eligible=false;reason=match.blockedReason||'Đang có vướng mắc'}
    else if(attendance.includes('missing')){eligible=false;reason='Có VĐV/cặp chưa có mặt'}
    else if(attendance.every(value=>value==='present')&&attendance.length===2){score+=500;reason=minimumRest===null?'Hai bên đã có mặt':'Hai bên đã có mặt · đã nghỉ ít nhất '+minimumRest+' phút'}
    else{score+=100;reason='Chưa điểm danh đủ hai bên'}
    if(match.readiness==='ready')score+=80;
    score+=Math.min(minimumRest??0,60);
    score-=10*(finishedByGroup.get(match.groupId)||0);
    return {...clone(match),players:matchPlayers(t,match),eligible,score,reason,minimumRest,attendance};
  }).sort((a,b)=>b.score-a.score||a.createdAt.localeCompare(b.createdAt));
  return {recommended:items.find(item=>item.eligible)||null,items};
}

export function displayWorkDate(t){
  const profile=ensureRefereeWorkspace(t).profile;if(!profile.date)return 'Chưa có ngày';
  const value=new Date(`${profile.date}T${profile.time||'00:00'}:00`);return Number.isNaN(value.getTime())?profile.date:value.toLocaleDateString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})+(profile.time?` · ${profile.time}`:'');
}

