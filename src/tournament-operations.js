import {validateMatchSetup} from './match-domain.js';
import {entryPlayers} from './tournament-domain.js';

const clone=value=>structuredClone(value);
const id=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const iso=value=>new Date(value??Date.now()).toISOString();
const findMatch=(t,matchId)=>{
  const match=t.schedule.find(item=>item.id===matchId);
  if(!match)throw Error('Không tìm thấy trận.');
  return match;
};
const findVersion=(t,versionId=t.activeRulesVersionId)=>{
  const version=t.rulesVersions.find(item=>item.id===versionId);
  if(!version)throw Error('Chưa xác định Rules Version.');
  return version;
};
const record=(t,type,detail={},at=Date.now())=>{
  const timestamp=iso(at);t.updatedAt=timestamp;t.events.push({id:id(),at:timestamp,type,...detail});
};

export function stableParticipants(t,match){
  if(match===undefined){match=t;t=null}
  if(!['single','double'].includes(match.type)||!match.entrantIds?.A||!match.entrantIds?.B)throw Error('Chưa đủ danh tính VĐV cho trận.');
  const count=match.type==='single'?1:2;
  return ['A','B'].flatMap(team=>{const entry=t?.structure.entries.find(item=>item.id===match.entrantIds[team]),names=t?entryPlayers(t,entry?.id):match.players?.[team];return Array.from({length:count},(_,index)=>({id:`${team}${index+1}`,playerId:entry?.playerIds[index]||null,entryId:match.entrantIds[team],team,index,name:names?.[index]?.trim()}))})
    .map(participant=>{if(!participant.name)throw Error('Chưa đủ danh tính VĐV cho trận.');return participant});
}

export function ensureMatchOperations(t,matchId){
  const match=findMatch(t,matchId);
  if(match.operations)return match.operations;
  const participants=stableParticipants(t,match);
  match.operations={
    version:1,
    call:{calls:[],loudspeakerRequests:[]},
    waiting:{status:'idle',startedAt:null,arrivedAt:null,resolvedAt:null,resolution:null,extensions:[]},
    preMatch:{
      participants,
      confirmations:Object.fromEntries(participants.map(p=>[p.id,'unknown'])),
      warmup:{status:'pending',startedAt:null,durationSeconds:null,completedAt:null},
      rulesVersionId:null,
      equipment:{policy:'unknown',checks:Object.fromEntries(participants.map(p=>[p.id,false]))},
      finalSetup:null
    }
  };
  record(t,'matchOperationsOpened',{matchId});
  return match.operations;
}

export function callPlayers(t,matchId,at=Date.now()){
  const operations=ensureMatchOperations(t,matchId),kind=operations.call.calls.length?'recall':'initial';
  const entry={id:id(),kind,at:iso(at)};operations.call.calls.push(entry);record(t,'playersCalled',{matchId,callId:entry.id,kind},at);return entry;
}

export function requestLoudspeaker(t,matchId,at=Date.now()){
  const operations=ensureMatchOperations(t,matchId),entry={id:id(),at:iso(at)};
  operations.call.loudspeakerRequests.push(entry);record(t,'loudspeakerRequested',{matchId,requestId:entry.id},at);return entry;
}

export function startWaiting(t,matchId,at=Date.now()){
  const operations=ensureMatchOperations(t,matchId);
  if(operations.waiting.status!=='idle')throw Error('Đồng hồ chờ đã được xử lý.');
  operations.waiting.status='waiting';operations.waiting.startedAt=iso(at);record(t,'waitingStarted',{matchId},at);return operations.waiting;
}

export function extendWaiting(t,matchId,seconds,reason='',at=Date.now()){
  const waiting=ensureMatchOperations(t,matchId).waiting;
  if(waiting.status!=='waiting'||!Number.isInteger(seconds)||seconds<1||seconds>3600)throw Error('Gia hạn thời gian chờ không hợp lệ.');
  const entry={id:id(),at:iso(at),seconds,reason:String(reason||'').trim()||null};waiting.extensions.push(entry);
  record(t,'waitingExtended',{matchId,extensionId:entry.id,seconds},at);return entry;
}

export function markPlayersArrived(t,matchId,at=Date.now()){
  const waiting=ensureMatchOperations(t,matchId).waiting;
  if(!['idle','waiting'].includes(waiting.status))throw Error('Trạng thái đến sân không hợp lệ.');
  waiting.status='arrived';waiting.arrivedAt=iso(at);record(t,'playersArrived',{matchId},at);return waiting;
}

export function resolveNoShow(t,matchId,note,at=Date.now()){
  const waiting=ensureMatchOperations(t,matchId).waiting;
  if(waiting.status!=='waiting'||typeof note!=='string'||!note.trim())throw Error('Cần ghi nhận quyết định no-show.');
  waiting.status='resolved_no_show';waiting.resolvedAt=iso(at);waiting.resolution={kind:'no_show',note:note.trim(),automaticForfeit:false};
  record(t,'noShowResolved',{matchId,automaticForfeit:false},at);return waiting;
}

export function waitingElapsedSeconds(match,at=Date.now()){
  const waiting=match.operations?.waiting;if(!waiting?.startedAt)return 0;
  const stop=waiting.arrivedAt||waiting.resolvedAt||iso(at);
  return Math.max(0,Math.floor((Date.parse(stop)-Date.parse(waiting.startedAt))/1000));
}

export function initializePreMatch(t,matchId){
  const operations=ensureMatchOperations(t,matchId),version=findVersion(t);
  const policy=version.procedures?.equipmentCheck??'unknown';
  if(policy==='unknown')throw Error('Rules Version chưa xác định quy định kiểm tra dụng cụ.');
  if(operations.preMatch.rulesVersionId&&operations.preMatch.rulesVersionId!==version.id){
    operations.preMatch.equipment={policy,checks:Object.fromEntries(operations.preMatch.participants.map(p=>[p.id,false]))};
    operations.preMatch.finalSetup=null;
    operations.preMatch.rulesVersionId=version.id;
    record(t,'preMatchRulesVersionChanged',{matchId,rulesVersionId:version.id});
  }else if(operations.preMatch.equipment.policy==='unknown'){
    operations.preMatch.equipment.policy=policy;
    operations.preMatch.rulesVersionId=version.id;
    record(t,'preMatchOpened',{matchId,rulesVersionId:version.id});
  }
  return operations.preMatch;
}

export function confirmAthlete(t,matchId,participantId,confirmed=true){
  const pre=ensureMatchOperations(t,matchId).preMatch;
  if(!(participantId in pre.confirmations))throw Error('Không tìm thấy VĐV.');
  pre.confirmations[participantId]=confirmed?'confirmed':'unknown';record(t,'athleteConfirmationChanged',{matchId,participantId,confirmed});return pre;
}

export function setEquipmentChecked(t,matchId,participantId,checked=true){
  const pre=initializePreMatch(t,matchId);
  if(pre.equipment.policy==='disabled')throw Error('Rules Version không yêu cầu kiểm tra dụng cụ.');
  if(!(participantId in pre.equipment.checks))throw Error('Không tìm thấy VĐV.');
  pre.equipment.checks[participantId]=Boolean(checked);record(t,'equipmentCheckChanged',{matchId,participantId,checked:Boolean(checked)});return pre;
}

export function startWarmup(t,matchId,durationSeconds=null,at=Date.now()){
  const warmup=ensureMatchOperations(t,matchId).preMatch.warmup;
  if(warmup.status!=='pending'||durationSeconds!==null&&(!Number.isInteger(durationSeconds)||durationSeconds<1||durationSeconds>3600))throw Error('Khởi động không hợp lệ.');
  warmup.status='active';warmup.startedAt=iso(at);warmup.durationSeconds=durationSeconds;record(t,'warmupStarted',{matchId,durationSeconds},at);return warmup;
}

export function finishWarmup(t,matchId,at=Date.now()){
  const warmup=ensureMatchOperations(t,matchId).preMatch.warmup;
  if(warmup.status!=='active')throw Error('Khởi động chưa bắt đầu.');
  warmup.status='completed';warmup.completedAt=iso(at);record(t,'warmupCompleted',{matchId},at);return warmup;
}

export function skipWarmup(t,matchId,at=Date.now()){
  const warmup=ensureMatchOperations(t,matchId).preMatch.warmup;
  if(warmup.status!=='pending')throw Error('Không thể bỏ qua khởi động ở trạng thái hiện tại.');
  warmup.status='skipped';warmup.completedAt=iso(at);record(t,'warmupSkipped',{matchId},at);return warmup;
}

export function setPreMatchFinalSetup(t,matchId,setup){
  const match=findMatch(t,matchId),pre=initializePreMatch(t,matchId),version=findVersion(t,pre.rulesVersionId);
  const config={...clone(version.format),type:match.type,players:{A:entryPlayers(t,match.entrantIds.A),B:entryPlayers(t,match.entrantIds.B)},start:clone(setup.start),scoring:version.scoring};
  const final=clone(setup.final);validateMatchSetup(config,final);pre.finalSetup={config,final};record(t,'finalSetupRecorded',{matchId});return pre.finalSetup;
}

export function createMatchStartSnapshot(t,matchId,at=Date.now()){
  const match=findMatch(t,matchId);if(match.matchStartSnapshot)return clone(match.matchStartSnapshot);
  const pre=initializePreMatch(t,matchId),version=findVersion(t,pre.rulesVersionId);
  if(Object.values(pre.confirmations).some(value=>value!=='confirmed'))throw Error('Cần xác nhận đủ VĐV.');
  if(!['completed','skipped'].includes(pre.warmup.status))throw Error('Cần hoàn tất hoặc bỏ qua khởi động.');
  if(pre.equipment.policy==='required'&&Object.values(pre.equipment.checks).some(value=>!value))throw Error('Cần hoàn tất kiểm tra dụng cụ theo Rules Version.');
  if(!pre.finalSetup)throw Error('Chưa có Final Setup.');
  const snapshot={version:1,id:id(),scheduledMatchId:match.id,createdAt:iso(at),rulesVersionId:version.id,rulesVersion:clone(version),participants:clone(pre.participants),config:clone(pre.finalSetup.config),final:clone(pre.finalSetup.final)};
  validateMatchSetup(snapshot.config,snapshot.final);match.matchStartSnapshot=snapshot;record(t,'matchStartSnapshotCreated',{matchId,snapshotId:snapshot.id,rulesVersionId:version.id},at);return clone(snapshot);
}
