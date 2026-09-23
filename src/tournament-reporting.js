const clone=value=>structuredClone(value);
const id=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const iso=value=>new Date(value??Date.now()).toISOString();
const reporting=t=>(t.reporting??={match:{},group:{},events:[]});
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw Error(`${label} không được để trống.`);return value.trim()};
const matchById=(t,matchId)=>{const match=t.schedule.find(item=>item.id===matchId);if(!match)throw Error('Không tìm thấy trận.');return match};
const groupById=(t,groupId)=>{const group=t.structure.groups.find(item=>item.id===groupId);if(!group)throw Error('Không tìm thấy bảng.');return group};
const rulesById=(t,rulesVersionId)=>{const rules=t.rulesVersions.find(item=>item.id===rulesVersionId);if(!rules)throw Error('Không tìm thấy Rules Version.');return rules};
const record=(t,type,detail={},at=Date.now())=>{const entry={id:id(),at:iso(at),type,...detail};reporting(t).events.push(entry);t.events.push(clone(entry));t.updatedAt=entry.at;return entry};
const ledger=(t,kind,key)=>{const store=reporting(t)[kind];return store[key]??={currentReportId:null,versions:[]}};
const current=(entry)=>entry?.versions.find(item=>item.id===entry.currentReportId)||null;
const reportPolicy=rules=>({match:rules.procedures?.reporting?.match||'optional',group:rules.procedures?.reporting?.group||'optional'});
const resultVersion=(t,resultVersionId)=>Object.values(t.resultLedger?.byMatch||{}).flatMap(entry=>entry.versions||[]).find(item=>item.id===resultVersionId)||null;
const groupSnapshot=(t,snapshotId)=>t.groupSnapshots?.find(item=>item.id===snapshotId)||null;

function appendReport(t,kind,key,source,rulesVersionId,artifact,attention,at=Date.now()){
  const entry=ledger(t,kind,key),previous=current(entry);
  if(previous?.source.id===source.id&&!['OUTDATED'].includes(previous.status))return clone(previous);
  const needsResend=Boolean(previous?.wasSent||previous?.status==='SENT'||entry.resendRequired);
  if(previous){previous.isCurrent=false;if(previous.status!=='OUTDATED'){previous.wasSent=previous.status==='SENT'||previous.wasSent;previous.status='OUTDATED'}}
  const report={id:id(),revision:(previous?.revision||0)+1,isCurrent:true,kind:kind==='match'?'MATCH':'GROUP',status:needsResend?'NEEDS_RESEND':'GENERATED',source:clone(source),rulesVersionId,createdAt:iso(at),sharedAt:null,sentAt:null,wasSent:false,attention:clone(attention),artifact:clone(artifact)};
  entry.versions.push(report);entry.currentReportId=report.id;entry.resendRequired=needsResend;reporting(t)[kind][key]=entry;
  record(t,'reportGenerated',{reportId:report.id,reportKind:report.kind,revision:report.revision,sourceId:source.id,status:report.status},at);return clone(report);
}

export function invalidateMatchReports(t,matchId,at=Date.now()){
  const entry=reporting(t).match[matchId],report=current(entry);if(!report||report.status==='OUTDATED')return null;
  report.wasSent=report.status==='SENT'||report.wasSent;entry.resendRequired||=report.wasSent;report.status='OUTDATED';report.isCurrent=false;entry.currentReportId=report.id;
  record(t,'reportOutdated',{reportId:report.id,reportKind:'MATCH',reason:'RESULT_CHANGED'},at);return clone(report);
}

export function invalidateGroupReports(t,groupId,newSnapshotId,impact=[],at=Date.now()){
  const entry=reporting(t).group[groupId],report=current(entry);if(!report||report.source.id===newSnapshotId||report.status==='OUTDATED')return null;
  report.wasSent=report.status==='SENT'||report.wasSent;entry.resendRequired||=report.wasSent;report.status='OUTDATED';report.isCurrent=false;entry.currentReportId=report.id;
  const reason=impact.includes('QUALIFICATION_CHANGED')?'QUALIFICATION_CHANGED':impact.includes('RANKING_CHANGED')?'RANKING_CHANGED':'RESULT_CHANGED';
  record(t,'reportOutdated',{reportId:report.id,reportKind:'GROUP',reason},at);return clone(report);
}

export function deriveMatchReport(t,matchId,resultVersionId=null,rulesVersionId=null,at=Date.now()){
  const match=matchById(t,matchId),resultEntry=t.resultLedger?.byMatch?.[matchId],requested=resultVersionId?resultVersion(t,resultVersionId):null;
  const selected=resultVersionId?requested:resultEntry?.versions.find(item=>item.id===resultEntry.currentVersionId);
  if(!selected||selected.status!=='CONFIRMED'||selected.scheduledMatchId!==matchId||selected.id!==resultEntry?.currentVersionId)throw Error('Cần Canonical Result hiện hành đã xác nhận để tạo biên bản.');
  const effectiveRulesId=rulesVersionId||selected.rulesVersionId||t.activeRulesVersionId,rules=rulesById(t,effectiveRulesId),policy=reportPolicy(rules);
  if(policy.match==='disabled')throw Error('Reporting Policy không cho tạo biên bản từng trận.');
  const games=selected.games.map(game=>`Game ${game.game}: ${game.score.A}–${game.score.B}`).join('\n');
  const title=`Biên bản trận · ${match.label}`,body=`${selected.players.A.join(' / ')} ${selected.gamesWon.A}–${selected.gamesWon.B} ${selected.players.B.join(' / ')}\n${games}\nKết thúc: ${selected.matchEndedAt}\nXác nhận: ${selected.confirmedAt}`;
  return appendReport(t,'match',matchId,{kind:'RESULT_VERSION',id:selected.id,scheduledMatchId:matchId},effectiveRulesId,{format:'text/plain',title,body,share:{title,text:body}},selected.version>1?{kind:'RESULT_CHANGED',severity:'medium'}:{kind:'NONE',severity:'normal'},at);
}

export function deriveGroupReport(t,groupId,groupSnapshotId=null,rulesVersionId=t.activeRulesVersionId,at=Date.now()){
  const group=groupById(t,groupId),latest=[...(t.groupSnapshots||[])].reverse().find(item=>item.groupId===groupId),snapshot=groupSnapshot(t,groupSnapshotId)||latest;
  if(!snapshot||snapshot.groupId!==groupId||snapshot.id!==latest?.id)throw Error('Cần Group Snapshot hiện hành để tạo biên bản bảng.');
  const rules=rulesById(t,rulesVersionId),policy=reportPolicy(rules);if(policy.group==='disabled')throw Error('Reporting Policy không cho tạo biên bản cuối bảng.');
  const rows=snapshot.rows.map(row=>`${row.rank??'?'}. ${row.players.join(' / ')} · ${row.matchWins} thắng · ${row.qualification}`).join('\n');
  const title=`Biên bản bảng · ${group.label}`,body=`${title}\nSnapshot: ${snapshot.id}\n${rows}\nTrạng thái: ${snapshot.status}`;
  const impact=snapshot.impact||[],attention=impact.includes('QUALIFICATION_CHANGED')?{kind:'QUALIFICATION_CHANGED',severity:'high'}:impact.includes('RANKING_CHANGED')?{kind:'RANKING_CHANGED',severity:'medium'}:impact.includes('RESULT_CHANGED')?{kind:'RESULT_CHANGED',severity:'medium'}:{kind:'NONE',severity:'normal'};
  return appendReport(t,'group',groupId,{kind:'GROUP_SNAPSHOT',id:snapshot.id,groupId},rulesVersionId,{format:'text/plain',title,body,share:{title,text:body}},attention,at);
}

export function currentMatchReport(t,matchId){return clone(current(reporting(t).match[matchId]))}
export function currentGroupReport(t,groupId){return clone(current(reporting(t).group[groupId]))}
export function reportById(t,reportId){
  for(const kind of ['match','group'])for(const entry of Object.values(reporting(t)[kind])){const report=entry.versions.find(item=>item.id===reportId);if(report)return report}
  return null;
}

export function markReportShared(t,reportId,at=Date.now()){
  const report=reportById(t,reportId);if(!report||!report.isCurrent||!['GENERATED','NEEDS_RESEND','SHARED_UNCONFIRMED'].includes(report.status))throw Error('Biên bản không ở trạng thái có thể chia sẻ.');
  report.status='SHARED_UNCONFIRMED';report.sharedAt=iso(at);record(t,'reportShareSheetOpened',{reportId},at);return clone(report);
}

export function markReportSent(t,reportId,at=Date.now()){
  const report=reportById(t,reportId);if(!report||!report.isCurrent||!['GENERATED','NEEDS_RESEND','SHARED_UNCONFIRMED','SENT'].includes(report.status))throw Error('Biên bản không ở trạng thái có thể xác nhận gửi.');
  if(report.status==='SENT')return clone(report);report.status='SENT';report.sentAt=iso(at);report.wasSent=true;
  const collection=report.kind==='MATCH'?'match':'group',key=report.kind==='MATCH'?report.source.scheduledMatchId:report.source.groupId;reporting(t)[collection][key].resendRequired=false;
  record(t,'reportSent',{reportId,reportKind:report.kind},at);return clone(report);
}

export function reportingAttention(t){
  const items=[];
  for(const match of t.schedule){
    const resultEntry=t.resultLedger?.byMatch?.[match.id],result=resultEntry?.versions.find(item=>item.id===resultEntry.currentVersionId),report=current(reporting(t).match[match.id]);
    if(result?.status==='CONFIRMED'){
      const rules=t.rulesVersions.find(item=>item.id===(result.rulesVersionId||t.activeRulesVersionId)),required=reportPolicy(rules||{procedures:{}}).match==='required';
      if(required&&(!report||report.source.id!==result.id||report.status==='OUTDATED'))items.push({kind:'MATCH_REPORT_REQUIRED',severity:'medium',matchId:match.id});
    }
  }
  for(const completion of t.groupCompletions||[]){
    if(completion.status!=='READY'||!completion.groupSnapshotId)continue;const report=current(reporting(t).group[completion.groupId]),rules=t.rulesVersions.find(item=>item.id===t.activeRulesVersionId),required=reportPolicy(rules||{procedures:{}}).group==='required';
    if(required&&(!report||report.source.id!==completion.groupSnapshotId||report.status==='OUTDATED'))items.push({kind:'GROUP_REPORT_REQUIRED',severity:'medium',groupId:completion.groupId});
  }
  for(const kind of ['match','group'])for(const [key,entry] of Object.entries(reporting(t)[kind])){const report=current(entry);if(report?.status==='NEEDS_RESEND')items.push({kind:'NEEDS_RESEND',severity:report.attention.severity,reportId:report.id,sourceKey:key});else if(report?.status==='SHARED_UNCONFIRMED')items.push({kind:'SHARED_NOT_CONFIRMED',severity:'medium',reportId:report.id,sourceKey:key});else if(report?.status==='GENERATED')items.push({kind:'REPORT_UNSENT',severity:report.attention.severity,reportId:report.id,sourceKey:key})}
  return {status:items.some(item=>item.severity==='high')?'HIGH_ATTENTION':items.length?'ACTION_REQUIRED':'CLEAR',count:items.length,items};
}

export function validateReportingOperations(t){
  const store=t.reporting;if(store===undefined)return true;
  if(!store||typeof store!=='object'||!store.match||!store.group||!Array.isArray(store.events))throw Error('Reporting Store không hợp lệ.');
  const resultIds=new Set(Object.values(t.resultLedger?.byMatch||{}).flatMap(entry=>entry.versions.map(item=>item.id))),snapshotIds=new Set((t.groupSnapshots||[]).map(item=>item.id)),reportIds=new Set();
  for(const [kind,collection] of [['match',store.match],['group',store.group]])for(const [key,entry] of Object.entries(collection)){
    if(!entry||!Array.isArray(entry.versions)||entry.currentReportId&&!entry.versions.some(item=>item.id===entry.currentReportId))throw Error('Reporting ledger không hợp lệ.');
    for(const report of entry.versions){
      if(reportIds.has(report.id)||!['MATCH','GROUP'].includes(report.kind)||!['GENERATED','SHARED_UNCONFIRMED','SENT','OUTDATED','NEEDS_RESEND'].includes(report.status)||!t.rulesVersions.some(item=>item.id===report.rulesVersionId)||!report.artifact?.body)throw Error('Report không hợp lệ.');reportIds.add(report.id);
      if(kind==='match'&&(report.source.kind!=='RESULT_VERSION'||!resultIds.has(report.source.id)||report.source.scheduledMatchId!==key))throw Error('Match Report source không hợp lệ.');
      if(kind==='group'&&(report.source.kind!=='GROUP_SNAPSHOT'||!snapshotIds.has(report.source.id)||report.source.groupId!==key))throw Error('Group Report source không hợp lệ.');
    }
    if(entry.versions.filter(item=>item.isCurrent).length>1)throw Error('Chỉ một Report revision được hiện hành.');
  }
  return true;
}
