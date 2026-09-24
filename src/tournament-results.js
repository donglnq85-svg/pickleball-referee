import {invalidateMatchReports,invalidateGroupReports} from './tournament-reporting.js';
const clone=value=>structuredClone(value);
const id=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const iso=value=>new Date(value??Date.now()).toISOString();
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw Error(`${label} không được để trống.`);return value.trim()};
const matchById=(t,matchId)=>{const match=t.schedule.find(item=>item.id===matchId);if(!match)throw Error('Không tìm thấy trận.');return match};
const groupById=(t,groupId)=>{const group=t.structure.groups.find(item=>item.id===groupId);if(!group)throw Error('Không tìm thấy bảng.');return group};
const touch=(t,type,detail={},at=Date.now())=>{t.updatedAt=iso(at);t.events.push({id:id(),at:t.updatedAt,type,...detail})};
const ledger=t=>(t.resultLedger??={byMatch:{}});
const snapshots=t=>(t.groupSnapshots??=[]);
const completions=t=>(t.groupCompletions??=[]);
const rankingVersions=t=>(t.rankingRulesVersions??=[]);

const resultEntry=(t,matchId)=>ledger(t).byMatch[matchId]||null;
export const currentResult=(t,matchId)=>{
  const entry=resultEntry(t,matchId);return entry?.versions.find(version=>version.id===entry.currentVersionId)||null;
};

function normalizeCompletedGames(games){
  if(!Array.isArray(games)||!games.length)throw Error('Kết quả game không hợp lệ.');
  return games.map((game,index)=>{
    const A=Number(game.points?.A),B=Number(game.points?.B);
    if(!Number.isInteger(A)||!Number.isInteger(B)||A<0||B<0||A===B)throw Error('Kết quả game không hợp lệ.');
    const winner=A>B?'A':'B';
    return {gameNumber:index+1,points:{A,B},winner};
  });
}
function resultBody(match,session,completedGames){
  if(!match.entrantIds?.A||!match.entrantIds?.B)throw Error('Scheduled Match thiếu stable Entry identity.');
  const normalized=normalizeCompletedGames(completedGames),matchGamesWon={A:0,B:0};for(const game of normalized)matchGamesWon[game.winner]++;
  const requiredWins=Math.floor(session.config.sets/2)+1;
  if(Math.max(matchGamesWon.A,matchGamesWon.B)!==requiredWins||matchGamesWon.A===matchGamesWon.B||normalized.length>session.config.sets)throw Error('Kết quả trận không khớp thể thức thi đấu.');
  return {matchSessionId:session.id,matchEndedAt:session.finishedAt,rulesVersionId:session.tournamentContext?.rulesVersionId||null,type:session.config.type,format:{sets:session.config.sets,requiredWins},players:clone(session.players),completedGames:normalized,matchGamesWon,winner:matchGamesWon.A>matchGamesWon.B?'A':'B',
    entrants:{A:{id:match.entrantIds.A,players:clone(session.players.A)},B:{id:match.entrantIds.B,players:clone(session.players.B)}}};
}
function appendResult(t,match,body,source,at=Date.now()){
  const store=ledger(t),entry=store.byMatch[match.id]??={currentVersionId:null,versions:[]};
  const previous=entry.versions.find(item=>item.id===entry.currentVersionId)||null;
  if(previous)previous.isCurrent=false;
  const version={id:id(),version:(previous?.version||0)+1,isCurrent:true,status:'PENDING_CONFIRMATION',scheduledMatchId:match.id,
    derivedAt:iso(at),confirmedAt:null,...clone(body),source:clone(source)};
  entry.versions.push(version);entry.currentVersionId=version.id;store.byMatch[match.id]=entry;
  touch(t,'canonicalResultVersionCreated',{matchId:match.id,resultVersionId:version.id,version:version.version},at);return clone(version);
}

export function deriveCanonicalResult(t,matchSession,at=Date.now()){
  if(matchSession?.status!=='finished'||!matchSession.finishedAt)throw Error('Match chưa kết thúc.');
  const matchId=matchSession.tournamentContext?.scheduledMatchId,match=matchById(t,matchId);
  if(match.matchSessionId!==matchSession.id||matchSession.tournamentContext?.tournamentId!==t.id)throw Error('Match Session không thuộc trận trong giải.');
  const source={kind:'MATCH_STATE',matchUpdatedAt:matchSession.updatedAt,eventCount:matchSession.events?.length||0};
  const entry=resultEntry(t,match.id),current=currentResult(t,match.id),latestMatch=[...(entry?.versions||[])].reverse().find(item=>item.source.kind==='MATCH_STATE');
  if(latestMatch?.source.matchUpdatedAt===source.matchUpdatedAt&&latestMatch.source.eventCount===source.eventCount)return clone(current);
  return appendResult(t,match,resultBody(match,matchSession,matchSession.completedGames),source,at);
}

export function confirmCanonicalResult(t,matchId,resultVersionId,at=Date.now()){
  const entry=resultEntry(t,matchId),result=currentResult(t,matchId);
  if(!entry||!result||result.id!==resultVersionId||!result.isCurrent)throw Error('Chỉ phiên bản kết quả hiện tại mới được xác nhận.');
  if(result.status==='CONFIRMED')return clone(result);
  result.status='CONFIRMED';result.confirmedAt=iso(at);touch(t,'canonicalResultConfirmed',{matchId,resultVersionId},at);return clone(result);
}

export function correctCanonicalResult(t,matchId,{completedGames,reason,actor='referee'},at=Date.now()){
  const match=matchById(t,matchId),previous=currentResult(t,matchId);
  if(!previous)throw Error('Chưa có Canonical Result để sửa.');
  const sessionLike={id:previous.matchSessionId,finishedAt:previous.matchEndedAt,config:{type:previous.type,sets:previous.format.sets},players:previous.players};
  const body={...resultBody(match,sessionLike,completedGames),rulesVersionId:previous.rulesVersionId||null};
  invalidateMatchReports(t,matchId,at);
  return appendResult(t,match,body,{kind:'RESULT_CORRECTION',parentResultVersionId:previous.id,reason:text(reason,'Lý do sửa kết quả'),actor:text(actor,'Người sửa')},at);
}

export function addRankingRulesVersion(t,{label,authority,criteria=[],qualification={kind:'unknown'}}){
  if(!Array.isArray(criteria))throw Error('Tiêu chí xếp hạng không hợp lệ.');
  const normalized=criteria.map(item=>({metric:text(item.metric,'Chỉ số xếp hạng'),direction:['asc','desc'].includes(item.direction)?item.direction:'desc'}));
  if(!qualification||!['unknown','top'].includes(qualification.kind)||qualification.kind==='top'&&(!Number.isInteger(qualification.count)||qualification.count<1))throw Error('Quy tắc đi tiếp không hợp lệ.');
  const version={id:id(),label:text(label,'Tên Ranking Rules Version'),authority:text(authority,'Nguồn Ranking Rules'),criteria:normalized,qualification:clone(qualification),createdAt:iso()};
  rankingVersions(t).push(version);t.activeRankingRulesVersionId=version.id;touch(t,'rankingRulesVersionAdded',{rankingRulesVersionId:version.id});return clone(version);
}

const metrics={
  matchWins:s=>s.matchWins,matchLosses:s=>s.matchLosses,gameWins:s=>s.gameWins,gameLosses:s=>s.gameLosses,
  pointsFor:s=>s.pointsFor,pointsAgainst:s=>s.pointsAgainst,gameDifferential:s=>s.gameWins-s.gameLosses,pointDifferential:s=>s.pointsFor-s.pointsAgainst
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function calculateGroupSnapshot(t,groupId,rankingRulesVersionId=t.activeRankingRulesVersionId,at=Date.now()){
  groupById(t,groupId);const rules=rankingVersions(t).find(item=>item.id===rankingRulesVersionId)||null;
  const matches=t.schedule.filter(item=>item.groupId===groupId),results=matches.map(match=>currentResult(t,match.id)).filter(result=>result?.status==='CONFIRMED');
  const table=new Map();
  const row=entrant=>{if(!table.has(entrant.id))table.set(entrant.id,{entrantId:entrant.id,players:clone(entrant.players),played:0,matchWins:0,matchLosses:0,gameWins:0,gameLosses:0,gameDifferential:0,pointsFor:0,pointsAgainst:0,pointDifferential:0,rank:null,qualification:'UNKNOWN'});return table.get(entrant.id)};
  for(const result of results)for(const team of ['A','B']){
    const own=row(result.entrants[team]),opponent=team==='A'?'B':'A';own.played++;own.matchWins+=result.winner===team?1:0;own.matchLosses+=result.winner===team?0:1;
    own.gameWins+=result.matchGamesWon[team];own.gameLosses+=result.matchGamesWon[opponent];for(const game of result.completedGames){own.pointsFor+=game.points[team];own.pointsAgainst+=game.points[opponent]}
  }
  for(const item of table.values()){item.gameDifferential=item.gameWins-item.gameLosses;item.pointDifferential=item.pointsFor-item.pointsAgainst}
  let status='RANKED',reason=null,ordered=[...table.values()];
  if(!rules||!rules.criteria.length){status='NEEDS_CONFIRMATION';reason='RANKING_RULES_INCOMPLETE'}
  else if(rules.criteria.some(rule=>!metrics[rule.metric])){status='NEEDS_CONFIRMATION';reason='RANKING_METRIC_UNSUPPORTED'}
  else{
    ordered.sort((a,b)=>{for(const rule of rules.criteria){const delta=metrics[rule.metric](a)-metrics[rule.metric](b);if(delta)return rule.direction==='asc'?delta:-delta}return a.entrantId.localeCompare(b.entrantId)});
    for(let index=0;index<ordered.length;index++){
      const tied=index>0&&rules.criteria.every(rule=>metrics[rule.metric](ordered[index])===metrics[rule.metric](ordered[index-1]));
      const tiedNext=index<ordered.length-1&&rules.criteria.every(rule=>metrics[rule.metric](ordered[index])===metrics[rule.metric](ordered[index+1]));
      ordered[index].rank=tied||tiedNext?null:index+1;if(tied||tiedNext){status='NEEDS_CONFIRMATION';reason='UNRESOLVED_TIE'}
    }
  }
  let qualificationStatus='UNKNOWN',qualified=[];
  if(rules?.qualification.kind==='top'&&status==='RANKED'){
    qualificationStatus='KNOWN';qualified=ordered.slice(0,rules.qualification.count).map(item=>item.entrantId);for(const item of ordered)item.qualification=qualified.includes(item.entrantId)?'QUALIFIED':'NOT_QUALIFIED';
  }else if(rules?.qualification.kind==='top')qualificationStatus='NEEDS_CONFIRMATION';
  const prior=[...snapshots(t)].reverse().find(item=>item.groupId===groupId)||null;
  const resultVersionIds=results.map(item=>item.id).sort(),rankingProjection=ordered.map(item=>[item.entrantId,item.rank]);
  // A retry after the snapshot write boundary must resolve to the already
  // persisted projection. Result and Ranking Rules versions are immutable,
  // therefore these exact inputs deterministically identify the calculation.
  if(prior&&prior.rankingRulesVersionId===(rules?.id||rankingRulesVersionId||null)&&same(prior.resultVersionIds,resultVersionIds))return clone(prior);
  const impact=[];
  if(!prior||!same(prior.resultVersionIds,resultVersionIds))impact.push('RESULT_CHANGED');
  if(!prior||prior.status!==status||!same(prior.rows.map(item=>[item.entrantId,item.rank]),rankingProjection))impact.push('RANKING_CHANGED');
  if(!prior||prior.qualification.status!==qualificationStatus||!same(prior.qualification.qualified,qualified))impact.push('QUALIFICATION_CHANGED');
  const snapshot={id:id(),groupId,createdAt:iso(at),rankingRulesVersionId:rules?.id||rankingRulesVersionId||null,resultVersionIds,status,reason,rows:clone(ordered),qualification:{status:qualificationStatus,qualified},impact};
  invalidateGroupReports(t,groupId,snapshot.id,impact,at);
  snapshots(t).push(snapshot);touch(t,'groupSnapshotCalculated',{groupId,groupSnapshotId:snapshot.id,impact},at);return clone(snapshot);
}

export function assessGroupCompletion(t,groupId,at=Date.now()){
  groupById(t,groupId);const matches=t.schedule.filter(item=>item.groupId===groupId),confirmed=matches.filter(match=>currentResult(t,match.id)?.status==='CONFIRMED');
  const latest=[...snapshots(t)].reverse().find(item=>item.groupId===groupId)||null,expected=confirmed.map(match=>currentResult(t,match.id).id).sort();
  let status='IN_PROGRESS',reason='MATCHES_OR_RESULTS_PENDING';
  if(matches.length&&confirmed.length===matches.length){
    if(latest&&same(latest.resultVersionIds,expected)&&latest.status==='RANKED'&&latest.qualification.status==='KNOWN'){status='READY';reason=null}
    else{status='NEEDS_CONFIRMATION';reason='RANKING_OR_QUALIFICATION_UNRESOLVED'}
  }
  const matchIds=matches.map(item=>item.id),groupSnapshotId=latest?.id||null,prior=[...completions(t)].reverse().find(item=>item.groupId===groupId)||null;
  if(prior&&prior.status===status&&prior.reason===reason&&prior.groupSnapshotId===groupSnapshotId&&same(prior.matchIds,matchIds)&&same(prior.resultVersionIds,expected))return clone(prior);
  const completion={id:id(),groupId,createdAt:iso(at),status,reason,matchIds,resultVersionIds:expected,groupSnapshotId};
  completions(t).push(completion);touch(t,'groupCompletionAssessed',{groupId,groupCompletionId:completion.id,status},at);return clone(completion);
}

export function validateResultOperations(t){
  const versions=t.rankingRulesVersions||[];if(t.activeRankingRulesVersionId!=null&&!versions.some(item=>item.id===t.activeRankingRulesVersionId))throw Error('Ranking Rules Version không hợp lệ.');
  for(const item of versions)if(!item.id||!item.label||!Array.isArray(item.criteria)||!item.qualification)throw Error('Ranking Rules Version không hợp lệ.');
  const byMatch=t.resultLedger?.byMatch||{};
  for(const [matchId,entry] of Object.entries(byMatch)){
    matchById(t,matchId);if(!entry||!Array.isArray(entry.versions)||!entry.versions.some(item=>item.id===entry.currentVersionId))throw Error('Canonical Result ledger không hợp lệ.');
    if(entry.versions.filter(item=>item.isCurrent).length!==1||entry.versions.find(item=>item.isCurrent)?.id!==entry.currentVersionId||new Set(entry.versions.map(item=>item.version)).size!==entry.versions.length)throw Error('Canonical Result phải có đúng một phiên bản hiện tại.');
    for(const result of entry.versions){
      if(!['PENDING_CONFIRMATION','CONFIRMED'].includes(result.status)||result.scheduledMatchId!==matchId||!result.matchEndedAt||!result.source||result.entrants?.A?.id!==matchById(t,matchId).entrantIds?.A||result.entrants?.B?.id!==matchById(t,matchId).entrantIds?.B)throw Error('Canonical Result không hợp lệ.');
      const normalized=normalizeCompletedGames(result.completedGames),derived={A:0,B:0};for(const game of normalized)derived[game.winner]++;
      if(!result.format||derived.A!==result.matchGamesWon?.A||derived.B!==result.matchGamesWon?.B||result.winner!==(derived.A>derived.B?'A':'B')||Math.max(derived.A,derived.B)!==result.format.requiredWins)throw Error('Canonical Result sai ngữ nghĩa điểm/game thắng.');
    }
  }
  const allResultIds=new Set(Object.values(byMatch).flatMap(entry=>entry.versions.map(item=>item.id)));
  const allEntryIds=new Set(t.structure?.entries?.map(item=>item.id)||[]);
  for(const snapshot of t.groupSnapshots||[]){groupById(t,snapshot.groupId);if(!Array.isArray(snapshot.resultVersionIds)||snapshot.resultVersionIds.some(resultId=>!allResultIds.has(resultId))||snapshot.rows?.some(row=>!allEntryIds.has(row.entrantId))||
    snapshot.rankingRulesVersionId&&!versions.some(item=>item.id===snapshot.rankingRulesVersionId)||!['RANKED','NEEDS_CONFIRMATION'].includes(snapshot.status))throw Error('Group Snapshot không hợp lệ.');}
  for(const completion of t.groupCompletions||[]){groupById(t,completion.groupId);if(!['IN_PROGRESS','READY','NEEDS_CONFIRMATION'].includes(completion.status)||!Array.isArray(completion.resultVersionIds)||completion.resultVersionIds.some(resultId=>!allResultIds.has(resultId))||completion.groupSnapshotId&&!t.groupSnapshots.some(item=>item.id===completion.groupSnapshotId))throw Error('Group Completion không hợp lệ.');}
  return true;
}
