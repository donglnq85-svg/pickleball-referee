
import {validateResultOperations,currentResult} from './tournament-results.js';

export const TOURNAMENT_SCHEMA_VERSION = 2;
const clone = value => structuredClone(value);
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const now = () => new Date().toISOString();
const requireText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw Error(`${label} không được để trống.`);
  return value.trim();
};
const find = (items, value, label) => {
  const item=items.find(entry=>entry.id===value);
  if (!item) throw Error(`Không tìm thấy ${label}.`);
  return item;
};
const touch = (t, type, detail={}) => {
  t.updatedAt=now();t.events.push({id:id(),at:t.updatedAt,type,...detail});return t;
};

export function createTournament(name) {
  const at=now();return {schemaVersion:TOURNAMENT_SCHEMA_VERSION,id:id(),name:requireText(name,'Tên giải'),status:'draft',createdAt:at,updatedAt:at,
    rulesVersions:[],activeRulesVersionId:null,rankingRulesVersions:[],activeRankingRulesVersionId:null,resultLedger:{byMatch:{}},groupSnapshots:[],groupCompletions:[],structure:{courts:[],groups:[],players:[],entries:[],teams:[]},schedule:[],assignments:[],workSessions:[],launches:{},events:[]};
}

export function addPlayer(t,{displayName}) {
  const player={id:id(),displayName:requireText(displayName,'Tên VĐV'),createdAt:now()};
  t.structure.players.push(player);touch(t,'playerCreated',{playerId:player.id});return player;
}

export function renamePlayer(t,playerId,displayName) {
  const player=find(t.structure.players,playerId,'VĐV');
  player.displayName=requireText(displayName,'Tên VĐV');touch(t,'playerDisplayNameChanged',{playerId});return player;
}

export function addTeam(t,{displayName,rosterPlayerIds=[]}) {
  if(!Array.isArray(rosterPlayerIds)||new Set(rosterPlayerIds).size!==rosterPlayerIds.length)throw Error('Danh sách đội không hợp lệ.');
  rosterPlayerIds.forEach(playerId=>find(t.structure.players,playerId,'VĐV'));
  const team={id:id(),displayName:requireText(displayName,'Tên đội'),rosterPlayerIds:[...rosterPlayerIds],createdAt:now()};
  t.structure.teams.push(team);touch(t,'teamCreated',{teamId:team.id});return team;
}

export function addEntry(t,{type,playerIds,teamId=null,label=null}) {
  if(!['single','double','team'].includes(type))throw Error('Loại Entry không hợp lệ.');
  const expected=type==='single'?1:type==='double'?2:null;
  if(!Array.isArray(playerIds)||(expected!==null&&playerIds.length!==expected)||new Set(playerIds).size!==playerIds.length)throw Error('Thành phần Entry không hợp lệ.');
  playerIds.forEach(playerId=>find(t.structure.players,playerId,'VĐV'));
  if(teamId!==null)find(t.structure.teams,teamId,'đội');
  const entry={id:id(),type,playerIds:[...playerIds],teamId,label:label===null?null:requireText(label,'Tên Entry'),createdAt:now()};
  t.structure.entries.push(entry);touch(t,'entryCreated',{entryId:entry.id,type});return entry;
}

export function entryPlayers(t,entryId) {
  if(entryId===null)return null;
  const entry=find(t.structure.entries,entryId,'Entry');
  return entry.playerIds.map(playerId=>find(t.structure.players,playerId,'VĐV').displayName);
}

export function matchPlayers(t,match) {
  if(!['single','double'].includes(match.type)||!match.entrantIds?.A||!match.entrantIds?.B)return null;
  return {A:entryPlayers(t,match.entrantIds.A),B:entryPlayers(t,match.entrantIds.B)};
}

export function addRulesVersion(t,{label,authority,scoring='unknown',format=null,procedures={equipmentCheck:'unknown'}}) {
  const scoringId=requireText(scoring,'Phương thức tính điểm');
  if (format!==null && (!Number.isInteger(format.sets)||format.sets<1||!Number.isInteger(format.points)||format.points<1||
      typeof format.rule!=='string'||!format.rule.trim()||format.cap!==undefined&&(!Number.isInteger(format.cap)||format.cap<format.points))) throw Error('Thể thức không hợp lệ.');
  if(!procedures||!['unknown','disabled','optional','required'].includes(procedures.equipmentCheck))throw Error('Quy định kiểm tra dụng cụ không hợp lệ.');
  const version={id:id(),label:requireText(label,'Tên phiên bản luật'),authority:requireText(authority,'Nguồn luật'),scoring:scoringId,format:clone(format),procedures:clone(procedures),createdAt:now()};
  t.rulesVersions.push(version);t.activeRulesVersionId=version.id;touch(t,'rulesVersionAdded',{rulesVersionId:version.id});return version;
}

export function addResource(t,kind,label) {
  if (!['courts','groups'].includes(kind)) throw Error('Loại cấu trúc không hợp lệ.');
  const resource={id:id(),label:requireText(label,kind==='courts'?'Tên sân':'Tên bảng')};
  t.structure[kind].push(resource);touch(t,'structureAdded',{kind,resourceId:resource.id});return resource;
}

// A schedule entry is not a referee assignment. Court/group and participants
// may remain unknown until the event operator supplies authoritative facts.
export function addScheduledMatch(t,{label,groupId=null,courtId=null,type='unknown',players=null,entrantIds=null}) {
  if(groupId!==null)find(t.structure.groups,groupId,'bảng');
  if(courtId!==null)find(t.structure.courts,courtId,'sân');
  if(!['unknown','single','double'].includes(type))throw Error('Loại trận không hợp lệ.');
  if(players!==null&&entrantIds!==null)throw Error('Chỉ dùng Entry IDs hoặc dữ liệu tạo VĐV mới.');
  if(players!==null && (!['single','double'].includes(type)||!['A','B'].every(team=>Array.isArray(players[team])&&players[team].length===(type==='single'?1:2)&&players[team].every(name=>typeof name==='string'&&name.trim()))))throw Error('VĐV không hợp lệ.');
  let refs={A:null,B:null};
  if(entrantIds!==null){
    if(!['single','double'].includes(type)||!['A','B'].every(team=>typeof entrantIds[team]==='string'))throw Error('Entry IDs không hợp lệ.');
    refs={A:entrantIds.A,B:entrantIds.B};
    for(const team of ['A','B'])if(find(t.structure.entries,refs[team],'Entry').type!==type)throw Error('Entry không khớp nội dung thi đấu.');
  }else if(players!==null){
    for(const team of ['A','B']){
      const playerIds=players[team].map(displayName=>addPlayer(t,{displayName}).id);
      refs[team]=addEntry(t,{type,playerIds}).id;
    }
  }
  const rendered=refs.A&&refs.B?{A:entryPlayers(t,refs.A),B:entryPlayers(t,refs.B)}:null;
  const match={id:id(),label:requireText(label,'Tên trận'),groupId,courtId,type,entrantIds:refs,players:rendered,readiness:'unknown',blockedReason:null,matchSessionId:null,operations:null,matchStartSnapshot:null,createdAt:now()};
  t.schedule.push(match);touch(t,'matchScheduled',{matchId:match.id});return match;
}

export function createAssignment(t,{label,scopeKind,scopeIds}) {
  const collection={court:t.structure.courts,group:t.structure.groups,match:t.schedule}[scopeKind];
  if(!collection||!Array.isArray(scopeIds)||!scopeIds.length||new Set(scopeIds).size!==scopeIds.length)throw Error('Phạm vi phân công không hợp lệ.');
  for(const scopeId of scopeIds)find(collection,scopeId,'đối tượng phân công');
  const assignment={id:id(),label:requireText(label,'Tên phân công'),scope:{kind:scopeKind,ids:[...scopeIds]},status:'assigned',createdAt:now()};
  t.assignments.push(assignment);touch(t,'assignmentCreated',{assignmentId:assignment.id});return assignment;
}

export function startWorkSession(t,assignmentId) {
  const assignment=find(t.assignments,assignmentId,'phân công');
  if(assignment.status==='completed'||t.workSessions.some(s=>s.status==='active'))throw Error('Đang có nhiệm vụ hoạt động. Kết thúc nhiệm vụ trước khi bắt đầu nhiệm vụ khác.');
  const session={id:id(),assignmentId,status:'active',startedAt:now(),endedAt:null};
  t.workSessions.push(session);assignment.status='active';t.status='active';touch(t,'workSessionStarted',{assignmentId,workSessionId:session.id});return session;
}

export function finishWorkSession(t,sessionId) {
  const session=find(t.workSessions,sessionId,'nhiệm vụ');
  if(session.status!=='active')throw Error('Nhiệm vụ đã kết thúc.');
  session.status='completed';session.endedAt=now();find(t.assignments,session.assignmentId,'phân công').status='completed';
  touch(t,'workSessionCompleted',{workSessionId:sessionId});return session;
}

export function setMatchReadiness(t,matchId,readiness,reason=null) {
  const match=find(t.schedule,matchId,'trận');
  if(!['unknown','ready','blocked'].includes(readiness))throw Error('Trạng thái sẵn sàng không hợp lệ.');
  if(readiness==='blocked')reason=requireText(reason,'Lý do chưa sẵn sàng');
  match.readiness=readiness;match.blockedReason=readiness==='blocked'?reason:null;
  touch(t,'readinessChanged',{matchId,readiness});return match;
}

export function assignmentMatches(t,assignmentId) {
  const {scope}=find(t.assignments,assignmentId,'phân công');
  return t.schedule.filter(match=>scope.kind==='match'?scope.ids.includes(match.id):scope.kind==='court'?scope.ids.includes(match.courtId):scope.ids.includes(match.groupId));
}

export function courtManagerView(t,workSessionId,matchRepository=null) {
  const workSession=find(t.workSessions,workSessionId,'nhiệm vụ');
  const assignment=find(t.assignments,workSession.assignmentId,'phân công');
  const matches=assignmentMatches(t,assignment.id).map(entry=>{
    const session=entry.matchSessionId&&matchRepository?.get(entry.matchSessionId);
    const result=currentResult(t,entry.id);
    return {...clone(entry),progress:session?.status||'not_started',resultStatus:result?.status||'NOT_DERIVED',resultVersionId:result?.id||null};
  });
  return {tournamentId:t.id,workSession:clone(workSession),assignment:clone(assignment),matches,
    progress:{total:matches.length,unknown:matches.filter(m=>m.readiness==='unknown').length,ready:matches.filter(m=>m.readiness==='ready').length,blocked:matches.filter(m=>m.readiness==='blocked').length,finished:matches.filter(m=>m.progress==='finished').length,resultsConfirmed:matches.filter(m=>m.resultStatus==='CONFIRMED').length}};
}

export function validateTournament(t) {
  if(t?.schemaVersion!==TOURNAMENT_SCHEMA_VERSION||!t.id||!t.name||!['draft','active'].includes(t.status)||
    !Array.isArray(t.rulesVersions)||!Array.isArray(t.structure?.courts)||!Array.isArray(t.structure?.groups)||!Array.isArray(t.structure?.players)||!Array.isArray(t.structure?.entries)||!Array.isArray(t.structure?.teams)||
    !Array.isArray(t.schedule)||!Array.isArray(t.assignments)||!Array.isArray(t.workSessions)||!Array.isArray(t.events))throw Error('Dữ liệu giải không hợp lệ.');
  if(t.activeRulesVersionId!==null)find(t.rulesVersions,t.activeRulesVersionId,'phiên bản luật');
  const playerIds=new Set();for(const player of t.structure.players){if(!player.id||playerIds.has(player.id)||!player.displayName?.trim())throw Error('Player identity không hợp lệ.');playerIds.add(player.id)}
  const entryIds=new Set();for(const entry of t.structure.entries){if(!entry.id||entryIds.has(entry.id)||!['single','double','team'].includes(entry.type)||!Array.isArray(entry.playerIds)||new Set(entry.playerIds).size!==entry.playerIds.length)throw Error('Entry identity không hợp lệ.');entryIds.add(entry.id);entry.playerIds.forEach(playerId=>find(t.structure.players,playerId,'VĐV'));if(entry.type==='single'&&entry.playerIds.length!==1||entry.type==='double'&&entry.playerIds.length!==2)throw Error('Entry identity không hợp lệ.');if(entry.teamId!==null&&entry.teamId!==undefined)find(t.structure.teams,entry.teamId,'đội')}
  const teamIds=new Set();for(const team of t.structure.teams){if(!team.id||teamIds.has(team.id)||!team.displayName?.trim()||!Array.isArray(team.rosterPlayerIds))throw Error('Team identity không hợp lệ.');teamIds.add(team.id);team.rosterPlayerIds.forEach(playerId=>find(t.structure.players,playerId,'VĐV'))}
  for(const v of t.rulesVersions)if(v.procedures!==undefined&&(!v.procedures||!['unknown','disabled','optional','required'].includes(v.procedures.equipmentCheck)))throw Error('Quy định kiểm tra dụng cụ không hợp lệ.');
  for(const m of t.schedule){
    if(m.groupId!==null)find(t.structure.groups,m.groupId,'bảng');if(m.courtId!==null)find(t.structure.courts,m.courtId,'sân');if(!['unknown','ready','blocked'].includes(m.readiness))throw Error('Readiness không hợp lệ.');
    if(!m.entrantIds||!['A','B'].every(team=>m.entrantIds[team]===null||typeof m.entrantIds[team]==='string'))throw Error('Scheduled Match thiếu trạng thái Entry rõ ràng.');
    if(['single','double'].includes(m.type)){for(const team of ['A','B'])if(m.entrantIds[team]&&find(t.structure.entries,m.entrantIds[team],'Entry').type!==m.type)throw Error('Entry không khớp nội dung thi đấu.')}
    if(m.operations!==undefined&&m.operations!==null){
      const o=m.operations;
      if(!o.call||!Array.isArray(o.call.calls)||!Array.isArray(o.call.loudspeakerRequests)||!o.waiting||!o.preMatch||
        !['idle','waiting','arrived','resolved_no_show'].includes(o.waiting.status)||!Array.isArray(o.waiting.extensions)||
        !['pending','active','completed','skipped'].includes(o.preMatch.warmup?.status))throw Error('Trạng thái vận hành trận không hợp lệ.');
    }
    if(m.matchStartSnapshot!==undefined&&m.matchStartSnapshot!==null){
      const s=m.matchStartSnapshot;
      if(s.version!==1||s.scheduledMatchId!==m.id||!t.rulesVersions.some(v=>v.id===s.rulesVersionId)||!s.config||!s.final||!Array.isArray(s.participants))throw Error('Match Start Snapshot không hợp lệ.');
    }
  }
  if(t.launches!==undefined){
    if(!t.launches||typeof t.launches!=='object'||Array.isArray(t.launches))throw Error('Launch journal không hợp lệ.');
    for(const [matchId,intent] of Object.entries(t.launches)){
      const scheduled=find(t.schedule,matchId,'trận trong journal');
      if(!intent||!['prepared','linked'].includes(intent.phase)||typeof intent.sessionId!=='string'||!intent.sessionId||
        !t.rulesVersions.some(v=>v.id===intent.rulesVersionId)||!intent.config||
        (intent.phase==='prepared'&&!intent.final)||
        (scheduled.matchSessionId&&scheduled.matchSessionId!==intent.sessionId)||
        (intent.phase==='linked'&&scheduled.matchSessionId!==intent.sessionId))throw Error('Launch journal không nhất quán.');
    }
  }
  for(const a of t.assignments){const refs={court:t.structure.courts,group:t.structure.groups,match:t.schedule}[a.scope?.kind];if(!refs||!Array.isArray(a.scope.ids)||!a.scope.ids.length)throw Error('Phạm vi phân công không hợp lệ.');for(const ref of a.scope.ids)find(refs,ref,'đối tượng phân công');}
  for(const s of t.workSessions){find(t.assignments,s.assignmentId,'phân công');if(!['active','completed'].includes(s.status))throw Error('Nhiệm vụ không hợp lệ.');}
  if(t.workSessions.filter(s=>s.status==='active').length>1)throw Error('Chỉ một nhiệm vụ được hoạt động trong một giải.');
  validateResultOperations(t);
  return true;
}
