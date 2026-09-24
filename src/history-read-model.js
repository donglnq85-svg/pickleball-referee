import {assignmentMatches} from './tournament-domain.js';
import {mandatoryUnfinishedWork} from './tournament-shift.js';

const clone=value=>structuredClone(value);
const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const latestAt=(...values)=>values.filter(Boolean).sort().at(-1)||null;
const currentVersion=entry=>entry?.versions?.find(item=>item.id===entry.currentVersionId)||null;
const currentReport=entry=>entry?.versions?.find(item=>item.id===entry.currentReportId)||null;
const rulesById=(t,id)=>t?.rulesVersions?.find(item=>item.id===id)||null;
const rankingById=(t,id)=>t?.rankingRulesVersions?.find(item=>item.id===id)||null;
const resource=(items,id)=>items?.find(item=>item.id===id)||null;
const index=(stableIds,displayFields)=>({stableIds:[...new Set(stableIds.filter(Boolean))],displayFields:[...new Set(displayFields.filter(Boolean))],normalized:normalized([...stableIds,...displayFields].join(' '))});

function participants(t,scheduled,session){
  if(!t||!scheduled)return ['A','B'].flatMap(team=>session.players[team].map((name,playerIndex)=>({playerId:`quick:${session.id}:${team}:${playerIndex}`,entryId:`quick-entry:${session.id}:${team}`,team,playerIndex,displayNameAtStart:name,currentDisplayName:name})));
  return ['A','B'].flatMap(team=>{
    const entry=resource(t.structure.entries,scheduled.entrantIds?.[team]);
    return session.players[team].map((name,playerIndex)=>{
      const playerId=entry?.playerIds?.[playerIndex]||null,player=resource(t.structure.players,playerId);
      return {playerId,entryId:entry?.id||scheduled.entrantIds?.[team]||null,team,playerIndex,displayNameAtStart:name,currentDisplayName:player?.displayName||name};
    });
  });
}
function resultLedger(t,matchId){const entry=t?.resultLedger?.byMatch?.[matchId];return {versions:clone(entry?.versions||[]),current:clone(currentVersion(entry))}}
function reportLedger(t,matchId){const entry=t?.reporting?.match?.[matchId];return {versions:clone(entry?.versions||[]),current:clone(currentReport(entry))}}
const matchEventSignificant=event=>event.type!=='rally'||event.before?.serving!==event.after?.serving||event.before?.serverNumber!==event.after?.serverNumber||event.before?.status!==event.after?.status;
function matchEvents(session){
  const full=(session.events||[]).map((event,eventIndex)=>({source:'MATCH_LEDGER',sourceId:`${session.id}:${eventIndex}`,at:event.at,type:event.type,detail:clone(event)}));
  return {full,significant:full.filter(item=>matchEventSignificant(item.detail))};
}
function tournamentMatchEvents(t,matchId,results,reports){
  const resultIds=new Set(results.versions.map(item=>item.id)),reportIds=new Set(reports.versions.map(item=>item.id));
  return (t?.events||[]).filter(event=>event.matchId===matchId||resultIds.has(event.resultVersionId)||reportIds.has(event.reportId)||(event.sourceId&&resultIds.has(event.sourceId)))
    .map(event=>({source:'TOURNAMENT_LEDGER',sourceId:event.id,at:event.at,type:event.type,detail:clone(event)}));
}
function significantLabel(event,record){
  const type=event.type,detail=event.detail;
  if(type==='rally'&&detail.before?.serving!==detail.after?.serving)return `Side-out · Đội ${detail.after.serving} giao`;
  if(type==='rally'&&detail.before?.serverNumber!==detail.after?.serverNumber)return `Đổi lượt giao · Server ${detail.after.serverNumber}`;
  if(type==='rally'&&detail.before?.status!==detail.after?.status)return detail.after.status==='finished'?'Trận kết thúc':`Ván ${detail.after.game} kết thúc`;
  if(type==='canonicalResultVersionCreated'){
    const version=record.canonicalResult.versions.find(item=>item.id===detail.resultVersionId);return version?.source?.kind==='RESULT_CORRECTION'?`Điều chỉnh kết quả · lần ${version.version}`:`Ghi nhận kết quả · lần ${version?.version||''}`;
  }
  const labels={nextGame:'Bắt đầu ván tiếp theo',timeout:'Hội ý',medical:'Chăm sóc y tế',resume:'Tiếp tục trận',courtEnd:'Đổi bên sân',correction:'Điều chỉnh trạng thái trận',undo:'Hoàn tác',redo:'Làm lại',playersCalled:'Gọi VĐV',waitingStarted:'Bắt đầu chờ',waitingExtended:'Gia hạn chờ',playersArrived:'VĐV đã đến',noShowResolved:'Xử lý VĐV đến muộn',matchStartSnapshotCreated:'Chốt thiết lập trước trận',matchSessionLinked:'Bắt đầu thi đấu',canonicalResultConfirmed:'Xác nhận kết quả',reportGenerated:'Tạo nội dung gửi BTC',reportOutdated:'Nội dung gửi BTC cần cập nhật',reportShareSheetOpened:'Mở chia sẻ',reportSent:'Đã gửi BTC'};
  return labels[type]||type;
}
function projectMatch(session,t=null,scheduled=null){
  const people=participants(t,scheduled,session),results=resultLedger(t,scheduled?.id),reports=reportLedger(t,scheduled?.id),engine=matchEvents(session),operational=tournamentMatchEvents(t,scheduled?.id,results,reports);
  const current=results.current,completedGames=clone(current?.completedGames||session.completedGames),gamesWon=clone(current?.matchGamesWon||session.gamesWon),full=[...engine.full,...operational].sort((a,b)=>(a.at||'').localeCompare(b.at||''));
  const record={scope:'match',id:session.id,matchSessionId:session.id,scheduledMatchId:scheduled?.id||null,tournamentId:t?.id||null,context:{kind:t?'tournament':'quick',tournamentId:t?.id||null,tournamentName:t?.name||null,scheduledMatchId:scheduled?.id||null,matchLabel:scheduled?.label||session.config.note||'Trận nhanh',courtId:scheduled?.courtId||null,court:resource(t?.structure?.courts,scheduled?.courtId)?.label||null,groupId:scheduled?.groupId||null,group:resource(t?.structure?.groups,scheduled?.groupId)?.label||null,category:scheduled?.type||session.config.type},status:session.status,startedAt:session.createdAt,matchEndedAt:current?.matchEndedAt||session.finishedAt||null,resultConfirmedAt:current?.confirmedAt||null,participants:people,rulesVersionId:session.tournamentContext?.rulesVersionId||session.rulesVersion,rulesVersion:clone(rulesById(t,session.tournamentContext?.rulesVersionId)||{id:session.rulesVersion,label:session.rulesVersion,authority:'Match Engine'}),matchStartSnapshot:clone(scheduled?.matchStartSnapshot||null),format:clone(session.config),completedGames,gamesWon,winner:gamesWon.A===gamesWon.B?null:gamesWon.A>gamesWon.B?'A':'B',engineCompletedGames:clone(session.completedGames),engineGamesWon:clone(session.gamesWon),canonicalResult:results,reports,reportingStatus:reports.current?.status||'NOT_GENERATED',significantEvents:[],fullTimeline:full};
  record.significantEvents=full.filter(event=>event.source==='TOURNAMENT_LEDGER'||matchEventSignificant(event.detail)).map(event=>({...event,label:significantLabel(event,record)}));
  record.search=index([
    session.id,scheduled?.id,t?.id,record.rulesVersionId,record.matchStartSnapshot?.id,
    ...results.versions.map(item=>item.id),...reports.versions.map(item=>item.id),
    ...people.flatMap(person=>[person.playerId,person.entryId]),
  ],[t?.name,scheduled?.label,record.context.court,record.context.group,record.context.category,...people.flatMap(person=>[person.displayNameAtStart,person.currentDisplayName]),session.createdAt,session.finishedAt]);
  return record;
}
function projectGroup(t,group){
  const snapshots=(t.groupSnapshots||[]).filter(item=>item.groupId===group.id).map(snapshot=>({...clone(snapshot),rankingRulesVersion:clone(rankingById(t,snapshot.rankingRulesVersionId))})),completions=(t.groupCompletions||[]).filter(item=>item.groupId===group.id),reports=t.reporting?.group?.[group.id]?.versions||[];
  const record={scope:'group',id:`group:${t.id}:${group.id}`,tournamentId:t.id,groupId:group.id,label:group.label,snapshots:clone(snapshots),completions:clone(completions),reports:clone(reports),currentReport:clone(currentReport(t.reporting?.group?.[group.id])),sortAt:latestAt(...snapshots.map(item=>item.createdAt),...completions.map(item=>item.createdAt),t.createdAt)};
  record.search=index([t.id,group.id,...snapshots.flatMap(item=>[item.id,item.rankingRulesVersionId,...item.resultVersionIds])],[t.name,group.label,record.sortAt]);return record;
}
function projectWork(t,work,matchRepository,matchMap){
  const assignment=t.assignments.find(item=>item.id===work.assignmentId),scoped=assignment?assignmentMatches(t,assignment.id):[],completion=(t.shiftCompletions||[]).find(item=>item.workSessionId===work.id)||null,handovers=(t.handovers||[]).filter(item=>item.workSessionId===work.id),outstanding=mandatoryUnfinishedWork(t,work.id,matchRepository).projection;
  const record={scope:'workSession',id:work.id,tournamentId:t.id,tournamentName:t.name,status:work.status,startedAt:work.startedAt,endedAt:work.endedAt,assignment:clone(assignment),responsibilityScope:clone(assignment?.scope||null),matchRecordIds:scoped.map(item=>item.matchSessionId).filter(id=>matchMap.has(id)),handoverSnapshots:clone(handovers),shiftCompletionSnapshot:clone(completion),outstanding:clone(outstanding),sortAt:work.endedAt||work.startedAt};
  const labels=scoped.flatMap(item=>[item.label,resource(t.structure.courts,item.courtId)?.label,resource(t.structure.groups,item.groupId)?.label]);record.search=index([t.id,work.id,assignment?.id,...record.matchRecordIds,...(assignment?.scope?.ids||[])],[t.name,assignment?.label,...labels,record.sortAt]);return record;
}

export function projectHistory(matchRepository,tournamentRepository){
  const matchDocument=matchRepository.load(),tournaments=tournamentRepository.list(),matches=[],matchMap=new Map();
  for(const session of Object.values(matchDocument.matches)){
    const t=session.tournamentContext&&tournaments.find(item=>item.id===session.tournamentContext.tournamentId),scheduled=t?.schedule.find(item=>item.id===session.tournamentContext.scheduledMatchId)||null,record=projectMatch(session,t,scheduled);matches.push(record);matchMap.set(record.id,record);
  }
  const works=tournaments.flatMap(t=>t.workSessions.map(work=>projectWork(t,work,matchRepository,matchMap))),groups=tournaments.flatMap(t=>t.structure.groups.map(group=>projectGroup(t,group)));
  const tournamentRecords=tournaments.map(t=>{const record={scope:'tournament',id:t.id,name:t.name,status:t.status,createdAt:t.createdAt,updatedAt:t.updatedAt,workSessionIds:t.workSessions.map(item=>item.id),matchRecordIds:matches.filter(item=>item.tournamentId===t.id).map(item=>item.id),groupRecordIds:groups.filter(item=>item.tournamentId===t.id).map(item=>item.id),reporting:clone(t.reporting),unfinishedObligations:works.filter(item=>item.tournamentId===t.id).flatMap(item=>item.outstanding.outstanding.map(out=>({...out,workSessionId:item.id}))),sortAt:t.updatedAt};record.search=index([t.id,...record.workSessionIds,...record.matchRecordIds],[t.name,...t.structure.courts.map(item=>item.label),...t.structure.groups.map(item=>item.label),...t.schedule.map(item=>item.label),t.createdAt,t.updatedAt]);return record});
  for(const collection of [matches,works,groups,tournamentRecords])collection.sort((a,b)=>(b.sortAt||b.matchEndedAt||b.startedAt||'').localeCompare(a.sortAt||a.matchEndedAt||a.startedAt||''));
  return {version:1,generatedAt:new Date().toISOString(),matches,workSessions:works,groups,tournaments:tournamentRecords};
}

export function searchHistory(projection,{query='',scope='all',from=null,to=null}={}){
  const q=normalized(query),collections=scope==='all'?['matches','tournaments','workSessions','groups']:[{match:'matches',tournament:'tournaments',workSession:'workSessions',group:'groups'}[scope]].filter(Boolean),min=from?Date.parse(from):null,max=to?Date.parse(to):null,result=[];
  for(const name of collections)for(const record of projection[name]){const time=Date.parse(record.matchEndedAt||record.endedAt||record.updatedAt||record.sortAt||record.startedAt||record.createdAt);if(q&&!record.search.normalized.includes(q)||min&&time<min||max&&time>max)continue;result.push(record)}
  return result.sort((a,b)=>(b.matchEndedAt||b.endedAt||b.updatedAt||b.sortAt||b.startedAt||b.createdAt||'').localeCompare(a.matchEndedAt||a.endedAt||a.updatedAt||a.sortAt||a.startedAt||a.createdAt||''));
}
