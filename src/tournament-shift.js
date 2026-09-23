import {assignmentMatches,DEFAULT_SHIFT_COMPLETION_POLICY} from './tournament-domain.js';
import {currentResult} from './tournament-results.js';
import {currentMatchReport,currentGroupReport} from './tournament-reporting.js';
import {matchView} from './match-engine.js';

const clone=value=>structuredClone(value);
const id=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const iso=value=>new Date(value??Date.now()).toISOString();
const findWork=(t,workSessionId)=>{const work=t.workSessions.find(item=>item.id===workSessionId);if(!work)throw Error('Không tìm thấy Work Session.');return work};
const findAssignment=(t,id)=>{const assignment=t.assignments.find(item=>item.id===id);if(!assignment)throw Error('Không tìm thấy Assignment.');return assignment};
const activeRules=t=>t.rulesVersions.find(item=>item.id===t.activeRulesVersionId)||null;
const policy=t=>({...DEFAULT_SHIFT_COMPLETION_POLICY,...(activeRules(t)?.procedures?.shiftCompletion||{})});
const severity=(p,key)=>p[key]==='blocker'?'BLOCKER':'REMINDER';
const latestBy=(items,key)=>{const map=new Map();for(const item of items||[])map.set(item[key],item);return map};
const lastEventAt=(t,matchId)=>[...(t.events||[])].reverse().find(event=>event.matchId===matchId)?.at||'';

export function addOperationalIssue(t,{scopeKind='tournament',scopeId=null,description}={}){
  if(!['tournament','assignment','match','group'].includes(scopeKind)||typeof description!=='string'||!description.trim())throw Error('Operational Issue không hợp lệ.');
  const issue={id:id(),scopeKind,scopeId,description:description.trim(),status:'open',createdAt:iso(),resolvedAt:null};
  (t.operationalIssues??=[]).push(issue);t.events.push({id:id(),at:issue.createdAt,type:'operationalIssueOpened',issueId:issue.id});t.updatedAt=issue.createdAt;return clone(issue);
}
export function resolveOperationalIssue(t,issueId,at=Date.now()){
  const issue=(t.operationalIssues||[]).find(item=>item.id===issueId);if(!issue||issue.status!=='open')throw Error('Operational Issue không ở trạng thái mở.');
  issue.status='resolved';issue.resolvedAt=iso(at);t.events.push({id:id(),at:issue.resolvedAt,type:'operationalIssueResolved',issueId});t.updatedAt=issue.resolvedAt;return clone(issue);
}

function scopedIssues(t,assignment,matches){
  const matchIds=new Set(matches.map(item=>item.id)),groupIds=new Set(matches.map(item=>item.groupId).filter(Boolean));
  return (t.operationalIssues||[]).filter(issue=>issue.status==='open'&&(issue.scopeKind==='tournament'||issue.scopeKind==='assignment'&&issue.scopeId===assignment.id||issue.scopeKind==='match'&&matchIds.has(issue.scopeId)||issue.scopeKind==='group'&&groupIds.has(issue.scopeId)));
}
function item(kind,key,policyKey,label,detail={}){return {kind,key,policyKey,label,...detail}}
function sourceItems(t,work,matchRepository,p){
  const assignment=findAssignment(t,work.assignmentId),matches=assignmentMatches(t,assignment.id),items=[];
  for(const match of matches){
    const session=match.matchSessionId&&matchRepository?.get(match.matchSessionId),result=currentResult(t,match.id),waiting=match.operations?.waiting;
    if(session&&session.status!=='finished')items.push(item('ACTIVE_MATCH',`ACTIVE_MATCH:${match.id}:${session.updatedAt}:${session.events?.length||0}`,'activeMatch',`${match.label}: trận đang chạy`,{matchId:match.id,matchSessionId:session.id}));
    if(session?.status==='finished'&&result?.status!=='CONFIRMED')items.push(item('UNCONFIRMED_RESULT',`UNCONFIRMED_RESULT:${match.id}:${result?.id||session.updatedAt}`,'unconfirmedResult',`${match.label}: kết quả chưa xác nhận`,{matchId:match.id,resultVersionId:result?.id||null}));
    if(waiting?.status==='waiting')items.push(item('UNRESOLVED_WAITING',`UNRESOLVED_WAITING:${match.id}:${waiting.startedAt}:${waiting.extensions.length}`,'unresolvedWaiting',`${match.label}: đồng hồ chờ chưa xử lý`,{matchId:match.id}));
    if(!match.matchSessionId&&waiting?.status!=='resolved_no_show'&&(match.matchStartSnapshot||match.operations?.preMatch?.rulesVersionId||match.operations?.call?.calls?.length&&waiting?.status!=='arrived'))items.push(item('HANDOVER_OBLIGATION',`HANDOVER_OBLIGATION:${match.id}:${lastEventAt(t,match.id)}`,'handoverObligation',`${match.label}: workflow vận hành chưa hoàn tất`,{matchId:match.id}));
    if(result?.status==='CONFIRMED'){
      const rules=t.rulesVersions.find(version=>version.id===(result.rulesVersionId||t.activeRulesVersionId)),required=rules?.procedures?.reporting?.match==='required',report=currentMatchReport(t,match.id);
      if(required&&(!report||report.source.id!==result.id||report.status!=='SENT'))items.push(item('REQUIRED_MATCH_REPORT',`REQUIRED_MATCH_REPORT:${match.id}:${result.id}:${report?.id||'missing'}:${report?.status||'MISSING'}`,'requiredReport',`${match.label}: biên bản trận chưa SENT`,{matchId:match.id,resultVersionId:result.id,reportId:report?.id||null,reportStatus:report?.status||'MISSING'}));
    }
  }
  const groupIds=[...new Set(matches.map(match=>match.groupId).filter(Boolean))],latestCompletions=latestBy(t.groupCompletions,'groupId');
  for(const groupId of groupIds){
    const group=t.structure.groups.find(item=>item.id===groupId),completion=latestCompletions.get(groupId);
    const groupCompletionRequired=p.requireGroupCompletion||activeRules(t)?.procedures?.reporting?.group==='required';
    if(groupCompletionRequired&&(!completion||completion.status!=='READY'))items.push(item('GROUP_COMPLETION',`GROUP_COMPLETION:${groupId}:${completion?.id||'missing'}:${completion?.status||'MISSING'}`,'incompleteGroup',`${group?.label||'Bảng'}: Group Completion chưa READY`,{groupId,groupCompletionId:completion?.id||null}));
    if(completion?.status==='READY'){
      const rules=activeRules(t),required=rules?.procedures?.reporting?.group==='required',report=currentGroupReport(t,groupId);
      if(required&&(!report||report.source.id!==completion.groupSnapshotId||report.status!=='SENT'))items.push(item('REQUIRED_GROUP_REPORT',`REQUIRED_GROUP_REPORT:${groupId}:${completion.groupSnapshotId}:${report?.id||'missing'}:${report?.status||'MISSING'}`,'requiredReport',`${group?.label||'Bảng'}: biên bản bảng chưa SENT`,{groupId,groupCompletionId:completion.id,reportId:report?.id||null,reportStatus:report?.status||'MISSING'}));
    }
  }
  for(const issue of scopedIssues(t,assignment,matches))items.push(item('OPERATIONAL_ISSUE',`OPERATIONAL_ISSUE:${issue.id}`,'unresolvedIssue',issue.description,{issueId:issue.id}));
  return {assignment,matches,items};
}

export function projectShiftCompletion(t,workSessionId,matchRepository,{ignoreHandover=false}={}){
  const work=findWork(t,workSessionId),p=policy(t),source=sourceItems(t,work,matchRepository,p),handover=[...(t.handovers||[])].reverse().find(item=>item.workSessionId===workSessionId)||null,captured=new Set(handover?.capturedItemKeys||[]);
  const outstanding=source.items.map(entry=>{const originalSeverity=severity(p,entry.policyKey),handedOver=!ignoreHandover&&p.allowHandover&&originalSeverity==='BLOCKER'&&captured.has(entry.key);return {...entry,originalSeverity,severity:handedOver?'REMINDER':originalSeverity,handedOver}});
  const blockers=outstanding.filter(entry=>entry.severity==='BLOCKER'),reminders=outstanding.filter(entry=>entry.severity==='REMINDER');
  return {version:1,workSessionId,assignmentId:source.assignment.id,rulesVersionId:activeRules(t)?.id||null,status:blockers.length?'BLOCKED':reminders.length?'READY_WITH_REMINDERS':'READY',blockers:clone(blockers),reminders:clone(reminders),outstanding:clone(outstanding),handover:{status:handover?(blockers.length?'OUTDATED':'CURRENT'):(blockers.length&&p.allowHandover?'REQUIRED':'NOT_REQUIRED'),snapshotId:handover?.id||null},policy:clone(p)};
}

function matchHandoverState(match,session){
  if(!session)return null;const view=matchView(session);
  return {scheduledMatchId:match.id,matchSessionId:session.id,status:session.status,rulesVersion:session.rulesVersion,tournamentRulesVersionId:session.tournamentContext?.rulesVersionId||null,game:session.game,currentGamePoints:clone(session.currentGamePoints),completedGames:clone(session.completedGames),gamesWon:clone(session.gamesWon),serving:session.serving,serverNumber:session.serverNumber,server:{team:session.serving,index:view.serverIndex,name:view.server},receiver:{team:view.receiving,index:view.receiverIndex,name:view.receiver},participantPositions:clone(view.participants),courtLeft:view.courtLeft,courtRight:view.courtRight,timeout:clone(session.timeout),timeoutTotal:clone(session.timeoutTotal),medical:clone(session.medical),pause:clone(session.pause),eventHistoryBoundary:{eventCount:session.events?.length||0,lastEventAt:session.events?.at(-1)?.at||null}};
}
export function createHandoverSnapshot(t,workSessionId,matchRepository,{recipientName=null,context=null,equipmentBall=null}={},at=Date.now()){
  const work=findWork(t,workSessionId);if(work.status!=='active')throw Error('Chỉ có thể bàn giao Work Session đang hoạt động.');
  const projection=projectShiftCompletion(t,workSessionId,matchRepository,{ignoreHandover:true}),assignment=findAssignment(t,work.assignmentId),matches=assignmentMatches(t,assignment.id);
  if(!projection.outstanding.length)throw Error('Không có công việc dang dở cần bàn giao.');
  const snapshot={id:id(),version:1,status:'HANDED_OVER',createdAt:iso(at),workSessionId,assignmentRef:{id:assignment.id,version:assignment.version||1},responsibilityScope:clone(assignment.scope),rulesVersionId:projection.rulesVersionId,recipient:{name:typeof recipientName==='string'&&recipientName.trim()?recipientName.trim():null,context:typeof context==='string'&&context.trim()?context.trim():null},equipmentBall:typeof equipmentBall==='string'&&equipmentBall.trim()?equipmentBall.trim():null,capturedItemKeys:projection.outstanding.map(entry=>entry.key),outstanding:clone(projection.outstanding),matches:matches.map(match=>matchHandoverState(match,match.matchSessionId&&matchRepository?.get(match.matchSessionId))).filter(Boolean)};
  (t.handovers??=[]).push(snapshot);t.events.push({id:id(),at:snapshot.createdAt,type:'workHandedOver',workSessionId,handoverSnapshotId:snapshot.id});t.updatedAt=snapshot.createdAt;return clone(snapshot);
}

function completionSnapshot(t,work,projection,matchRepository,at){
  const assignment=findAssignment(t,work.assignmentId),matches=assignmentMatches(t,assignment.id),groups=new Set(matches.map(match=>match.groupId).filter(Boolean)),latestCompletions=latestBy(t.groupCompletions,'groupId');
  return {id:id(),version:1,status:'COMPLETED',createdAt:iso(at),workSessionId:work.id,assignmentRef:{id:assignment.id,version:assignment.version||1,label:assignment.label},workPeriod:{startedAt:work.startedAt,endedAt:iso(at)},responsibilityScope:clone(assignment.scope),rulesVersionId:projection.rulesVersionId,matches:matches.map(match=>{const session=match.matchSessionId&&matchRepository?.get(match.matchSessionId),result=currentResult(t,match.id);return {scheduledMatchId:match.id,matchSessionId:session?.id||null,matchStatus:session?.status||'NOT_STARTED',canonicalResultVersionId:result?.id||null,canonicalResultStatus:result?.status||'NOT_DERIVED'}}),groupCompletions:[...groups].map(groupId=>{const completion=latestCompletions.get(groupId);return {groupId,groupCompletionId:completion?.id||null,status:completion?.status||'NOT_ASSESSED',groupSnapshotId:completion?.groupSnapshotId||null}}),reporting:{matches:matches.map(match=>{const report=currentMatchReport(t,match.id);return {scheduledMatchId:match.id,reportId:report?.id||null,status:report?.status||'NOT_GENERATED',sourceId:report?.source.id||null}}),groups:[...groups].map(groupId=>{const report=currentGroupReport(t,groupId);return {groupId,reportId:report?.id||null,status:report?.status||'NOT_GENERATED',sourceId:report?.source.id||null}})},unresolvedIssues:clone(scopedIssues(t,assignment,matches)),handover:clone(projection.handover),outstanding:clone(projection.outstanding)};
}
export function completeWorkSession(t,workSessionId,matchRepository,{at=Date.now()}={}){
  const existing=(t.shiftCompletions||[]).find(item=>item.workSessionId===workSessionId);if(existing)return clone(existing);
  const work=findWork(t,workSessionId);if(work.status!=='active')throw Error('Work Session không ở trạng thái hoạt động.');
  const projection=projectShiftCompletion(t,workSessionId,matchRepository);if(projection.blockers.length)throw Error('Chưa thể kết thúc nhiệm vụ: còn BLOCKER.');
  const snapshot=completionSnapshot(t,work,projection,matchRepository,at);(t.shiftCompletions??=[]).push(snapshot);work.status='completed';work.endedAt=snapshot.workPeriod.endedAt;findAssignment(t,work.assignmentId).status='completed';
  t.events.push({id:id(),at:snapshot.createdAt,type:'shiftCompleted',workSessionId,shiftCompletionSnapshotId:snapshot.id});t.updatedAt=snapshot.createdAt;return clone(snapshot);
}
export const currentShiftCompletion=(t,workSessionId)=>clone((t.shiftCompletions||[]).find(item=>item.workSessionId===workSessionId)||null);
export function mandatoryUnfinishedWork(t,workSessionId,matchRepository){
  const projection=projectShiftCompletion(t,workSessionId,matchRepository,{ignoreHandover:true}),critical=projection.outstanding.filter(entry=>entry.originalSeverity==='BLOCKER');return {projection,critical};
}
