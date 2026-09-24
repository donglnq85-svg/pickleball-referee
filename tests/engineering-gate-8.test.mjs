import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,addRulesVersion,addResource,addPlayer,renamePlayer,addEntry,addScheduledMatch,createAssignment,startWorkSession,setMatchReadiness} from '../src/tournament-domain.js';
import {markPlayersArrived,initializePreMatch,confirmAthlete,skipWarmup,setPreMatchFinalSetup,createMatchStartSnapshot} from '../src/tournament-operations.js';
import {beginTournamentMatch} from '../src/tournament-launch.js';
import {createTournamentRepository,TOURNAMENT_STORE_KEY} from '../src/tournament-persistence.js';
import {createMatchRepository,STORE_KEY} from '../src/match-persistence.js';
import {createMatch,rally,nextGame,prepareNextGame,resolveFinal} from '../src/match-engine.js';
import {addRankingRulesVersion,deriveCanonicalResult,confirmCanonicalResult,correctCanonicalResult,calculateGroupSnapshot,assessGroupCompletion} from '../src/tournament-results.js';
import {deriveMatchReport,markReportSent} from '../src/tournament-reporting.js';
import {addOperationalIssue,createHandoverSnapshot,completeWorkSession} from '../src/tournament-shift.js';
import {projectHistory,searchHistory} from '../src/history-read-model.js';
import {historyOverview,matchRecordDetail,workRecordDetail,groupRecordDetail} from '../src/match-history.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
function scorePoints(state,team,count){for(let i=0;i<count;i++){if(state.serving!==team)rally(state,team);rally(state,team)}}
function playGame(state,points){const winner=points.A>points.B?'A':'B',loser=winner==='A'?'B':'A';scorePoints(state,loser,points[loser]);scorePoints(state,winner,points[winner])}
function continueGame(state){nextGame(state,resolveFinal(state.config,prepareNextGame(state)))}
function ready(t,match){setMatchReadiness(t,match.id,'ready');markPlayersArrived(t,match.id);const pre=initializePreMatch(t,match.id);for(const participant of pre.participants)confirmAthlete(t,match.id,participant.id);skipWarmup(t,match.id);setPreMatchFinalSetup(t,match.id,{start:{A:0,B:0},final:{serving:'A',courtLeft:'A'}});createMatchStartSnapshot(t,match.id)}

test('Gate 8 projects immutable Tournament, Work, Match, Group and Quick Match history with exact version semantics',()=>{
  const db=memory(),tournaments=createTournamentRepository(db),matches=createMatchRepository(db),t=createTournament('Giải Audit BO3');
  const rulesV1=addRulesVersion(t,{label:'Rules lịch sử v1',authority:'Product Control',scoring:'side-out',format:{sets:3,points:11,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting:{match:'required',group:'optional'}}}),ranking=addRankingRulesVersion(t,{label:'Ranking lịch sử',authority:'Product Control',criteria:[{metric:'matchWins',direction:'desc'},{metric:'gameDifferential',direction:'desc'},{metric:'pointDifferential',direction:'desc'}],qualification:{kind:'top',count:1}});
  const court=addResource(t,'courts','Sân Lịch Sử'),group=addResource(t,'groups','Bảng Audit'),playerA=addPlayer(t,{displayName:'Alex'}),playerB=addPlayer(t,{displayName:'Alex'}),entryA=addEntry(t,{type:'single',playerIds:[playerA.id]}),entryB=addEntry(t,{type:'single',playerIds:[playerB.id]}),scheduled=addScheduledMatch(t,{label:'Chung kết Audit',courtId:court.id,groupId:group.id,type:'single',entrantIds:{A:entryA.id,B:entryB.id}}),assignment=createAssignment(t,{label:'Ca BO3',scopeKind:'court',scopeIds:[court.id]}),work=startWorkSession(t,assignment.id);
  ready(t,scheduled);tournaments.save(t,{activeWorkSession:work.id});let session=beginTournamentMatch(t.id,work.id,scheduled.id,null,db);
  playGame(session,{A:11,B:4});continueGame(session);playGame(session,{A:8,B:11});continueGame(session);playGame(session,{A:11,B:6});matches.saveSession(session);

  let saved=tournaments.get(t.id),resultV1=deriveCanonicalResult(saved,session,10_000);confirmCanonicalResult(saved,scheduled.id,resultV1.id,11_000);const reportV1=deriveMatchReport(saved,scheduled.id,resultV1.id,rulesV1.id,12_000);markReportSent(saved,reportV1.id,13_000);calculateGroupSnapshot(saved,group.id,ranking.id,14_000);assessGroupCompletion(saved,group.id,15_000);
  const resultV2=correctCanonicalResult(saved,scheduled.id,{completedGames:[{points:{A:11,B:5}},{points:{A:8,B:11}},{points:{A:11,B:6}}],reason:'Correction audit'},20_000);confirmCanonicalResult(saved,scheduled.id,resultV2.id,21_000);const reportV2=deriveMatchReport(saved,scheduled.id,resultV2.id,rulesV1.id,22_000);assert.equal(reportV2.status,'NEEDS_RESEND');markReportSent(saved,reportV2.id,23_000);const groupV2=calculateGroupSnapshot(saved,group.id,ranking.id,24_000);assessGroupCompletion(saved,group.id,25_000);
  const issue=addOperationalIssue(saved,{scopeKind:'match',scopeId:scheduled.id,description:'Đối chiếu biên bản giấy'}),handover=createHandoverSnapshot(saved,work.id,matches,{recipientName:'Trọng tài B',context:'Theo dõi correction'},26_000),completion=completeWorkSession(saved,work.id,matches,{at:27_000});
  const rulesV2=addRulesVersion(saved,{label:'Rules active v2',authority:'BTC mới',scoring:'side-out',format:{sets:1,points:15,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting:{match:'optional',group:'optional'}}});renamePlayer(saved,playerA.id,'Alex Renamed');tournaments.save(saved,{activeWorkSession:null});

  const quick=createMatch({type:'single',sets:1,points:1,rule:'touch',scoring:'side-out',players:{A:['Quick An'],B:['Quick Bình']},start:{A:0,B:0},note:'Quick Audit'},{serving:'A',courtLeft:'A'});rally(quick,'A');matches.saveSession(quick);
  const beforeMatches=db.getItem(STORE_KEY),beforeTournaments=db.getItem(TOURNAMENT_STORE_KEY),projection=projectHistory(createMatchRepository(db),createTournamentRepository(db));
  assert.equal(db.getItem(STORE_KEY),beforeMatches);assert.equal(db.getItem(TOURNAMENT_STORE_KEY),beforeTournaments);

  const record=projection.matches.find(item=>item.scheduledMatchId===scheduled.id),quickRecord=projection.matches.find(item=>item.id===quick.id),workRecord=projection.workSessions.find(item=>item.id===work.id),groupRecord=projection.groups.find(item=>item.groupId===group.id);
  assert.deepEqual(record.gamesWon,{A:2,B:1});assert.deepEqual(record.canonicalResult.versions[0].completedGames.map(item=>item.points),[{A:11,B:4},{A:8,B:11},{A:11,B:6}]);assert.deepEqual(record.completedGames.map(item=>item.points),[{A:11,B:5},{A:8,B:11},{A:11,B:6}]);
  assert.equal(record.canonicalResult.versions.length,2);assert.equal(record.canonicalResult.current.id,resultV2.id);assert.equal(record.rulesVersionId,rulesV1.id);assert.notEqual(record.rulesVersionId,rulesV2.id);assert.equal(record.rulesVersion.label,'Rules lịch sử v1');
  assert.notEqual(record.participants[0].playerId,record.participants[1].playerId);assert.equal(record.participants[0].displayNameAtStart,'Alex');assert.equal(record.participants[0].currentDisplayName,'Alex Renamed');
  assert.deepEqual(record.reports.versions.map(item=>item.status),['OUTDATED','SENT']);assert.ok(record.significantEvents.some(item=>item.type==='canonicalResultVersionCreated'&&item.label.includes('Điều chỉnh kết quả')));assert.ok(record.significantEvents.some(item=>item.type==='reportGenerated'&&item.detail.status==='NEEDS_RESEND'));assert.ok(record.fullTimeline.length>record.significantEvents.length);
  assert.equal(record.matchStartSnapshot.rulesVersionId,rulesV1.id);assert.equal(record.resultConfirmedAt,new Date(21_000).toISOString());assert.ok(matchRecordDetail(record).includes('Kết quả hiện hành · game thắng 2 – 1'));assert.ok(matchRecordDetail(record).includes('11 – 4'));assert.ok(matchRecordDetail(record).includes('8 – 11'));assert.ok(matchRecordDetail(record).includes('11 – 6'));

  assert.equal(workRecord.shiftCompletionSnapshot.id,completion.id);assert.equal(workRecord.handoverSnapshots[0].id,handover.id);assert.equal(workRecord.handoverSnapshots[0].outstanding[0].issueId,issue.id);assert.equal(workRecord.outstanding.outstanding.find(item=>item.issueId===issue.id).kind,'OPERATIONAL_ISSUE');assert.ok(workRecordDetail(workRecord,projection).includes('Việc đã bàn giao vẫn được giữ trạng thái'));
  assert.equal(groupRecord.snapshots.at(-1).id,groupV2.id);assert.equal(groupRecord.snapshots.at(-1).rankingRulesVersion.id,ranking.id);assert.deepEqual(groupRecord.snapshots.at(-1).resultVersionIds,[resultV2.id]);assert.ok(groupRecordDetail(groupRecord).includes('Quy định xếp hạng'));
  assert.equal(quickRecord.context.kind,'quick');assert.deepEqual(quickRecord.gamesWon,{A:1,B:0});assert.equal(quickRecord.canonicalResult.versions.length,0);assert.ok(quickRecord.participants.every(item=>item.playerId.startsWith(`quick:${quick.id}:`)));

  for(const query of ['Giải Audit BO3','Alex','Alex Renamed','Sân Lịch Sử','Bảng Audit','Chung kết Audit',playerA.id,resultV2.id])assert.ok(searchHistory(projection,{query}).length,query);
  assert.equal(searchHistory(projection,{query:'Quick Bình',scope:'match'})[0].id,quick.id);assert.equal(projectHistory(createMatchRepository(db),createTournamentRepository(db)).matches.find(item=>item.id===record.id).canonicalResult.versions.length,2);
  const overview=historyOverview(projection);assert.ok(overview.indexOf('<h2>Kết quả trận')<overview.indexOf('<h2>Giải đấu'));assert.ok(!/delete|xóa|swipe/i.test(overview));
});
