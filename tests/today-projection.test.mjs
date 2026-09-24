import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTournament,addRulesVersion,addResource,addScheduledMatch,createAssignment,startWorkSession} from '../src/tournament-domain.js';
import {createMatch} from '../src/match-engine.js';
import {resolveTodayProjection,upcomingCountdown} from '../src/today-projection.js';

const now=new Date('2026-09-24T06:00:00.000Z');
const emptyMatches=()=>({version:2,activeId:null,draft:null,matches:{}});
const emptyTournaments=()=>({version:2,tournaments:{},activeWorkSession:null});

function setup({startsAt='2026-09-24T00:30:00.000Z',matchCount=2}={}){
  const t=createTournament('Vietnam Pickleball Open 2026');
  addRulesVersion(t,{label:'Luật áp dụng',authority:'BTC',scoring:'side-out',format:{sets:1,points:11,rule:'touch'},procedures:{equipmentCheck:'disabled'}});
  const court=addResource(t,'courts','Sân 06'),group=addResource(t,'groups','Tứ kết');
  const scheduled=Array.from({length:matchCount},(_,index)=>addScheduledMatch(t,{label:`#${36+index}`,courtId:court.id,groupId:group.id,type:'double',players:{A:[`A${index}1`,`A${index}2`],B:[`B${index}1`,`B${index}2`]}}));
  const assignment=createAssignment(t,{label:'Sân 06 · Tứ kết',scopeKind:'court',scopeIds:[court.id]});
  assignment.workPlan={startsAt,endsAt:'2026-09-24T10:00:00.000Z',location:'Cụm sân ABC Pickleball',city:'TP. Hồ Chí Minh'};
  return {t,court,group,scheduled,assignment,tournaments:{version:2,tournaments:{[t.id]:t},activeWorkSession:null},matches:emptyMatches()};
}

test('HÔM NAY resolves no-work with future work and work-today from persisted planning facts',()=>{
  const future=setup({startsAt:'2026-09-26T00:30:00.000Z'});
  let projection=resolveTodayProjection({matchDocument:future.matches,tournamentDocument:future.tournaments,now});
  assert.equal(projection.kind,'no-work');assert.equal(projection.upcoming.length,1);assert.equal(projection.upcoming[0].assignmentId,future.assignment.id);
  assert.equal(projection.upcoming[0].countdown,'Còn 2 ngày');assert.equal(projection.upcoming[0].readiness.accepted,true);
  const today=setup();projection=resolveTodayProjection({matchDocument:today.matches,tournamentDocument:today.tournaments,now});
  assert.equal(projection.kind,'work-today');assert.equal(projection.work.tournamentName,'Vietnam Pickleball Open 2026');assert.equal(projection.progress.total,2);assert.equal(projection.readiness.hasSchedule,true);
});

test('SCREEN 01 sorts persisted assignments, never invents schedule readiness, and recalculates at local day boundary',()=>{
  const later=setup({startsAt:'2026-10-10T00:30:00.000Z',matchCount:0});
  const sooner=setup({startsAt:'2026-09-26T00:30:00.000Z',matchCount:0});
  const document=emptyTournaments();document.tournaments[later.t.id]=later.t;document.tournaments[sooner.t.id]=sooner.t;
  let result=resolveTodayProjection({matchDocument:emptyMatches(),tournamentDocument:structuredClone(document),now});
  assert.deepEqual(result.upcoming.map(item=>item.tournamentId),[sooner.t.id,later.t.id]);
  assert.equal(result.upcoming[0].readiness.hasSchedule,false);
  assert.equal(upcomingCountdown('2026-09-26T00:30:00.000Z',new Date('2026-09-25T16:59:59Z')),'Ngày mai');
  result=resolveTodayProjection({matchDocument:emptyMatches(),tournamentDocument:document,now:new Date('2026-09-25T17:00:00Z')});
  assert.equal(result.kind,'work-today');assert.equal(result.work.tournamentId,sooner.t.id);
  sooner.assignment.status='cancelled';
  result=resolveTodayProjection({matchDocument:emptyMatches(),tournamentDocument:document,now});
  assert.equal(result.upcoming[0].tournamentId,later.t.id);
});

test('SCREEN 01 CTA and schedule are ID-based interactive deep links to tournament context',()=>{
  const shell=readFileSync(new URL('../src/app-shell.js',import.meta.url),'utf8');
  const experience=readFileSync(new URL('../src/tournament-experience.js',import.meta.url),'utf8');
  assert.match(shell,/data-shell="open-upcoming" data-tournament-id=/);
  assert.match(shell,/openTournamentExperience\(\{tournamentId:target\.dataset\.tournamentId,screen:'info'\}\)/);
  assert.match(experience,/detail\.screen==='info'\?renderInfo\(\):renderGroups\(\)/);
});

test('active Work Session resolves working then waiting without creating Today-owned state',()=>{
  const data=setup(),work=startWorkSession(data.t,data.assignment.id);data.tournaments.activeWorkSession={tournamentId:data.t.id,workSessionId:work.id};
  let projection=resolveTodayProjection({matchDocument:data.matches,tournamentDocument:data.tournaments,now});
  assert.equal(projection.kind,'working');assert.equal(projection.nextMatch.id,data.scheduled[0].id);assert.equal(projection.progress.percent,0);
  for(const scheduled of data.scheduled){const id=`session-${scheduled.id}`;scheduled.matchSessionId=id;data.matches.matches[id]={id,status:'finished'};}
  projection=resolveTodayProjection({matchDocument:data.matches,tournamentDocument:data.tournaments,now});
  assert.equal(projection.kind,'waiting');assert.equal(projection.nextMatch,null);assert.equal(projection.progress.percent,100);
});

test('active Match has absolute priority and projects exact score, identities and tournament context',()=>{
  const data=setup(),work=startWorkSession(data.t,data.assignment.id),scheduled=data.scheduled[0];data.tournaments.activeWorkSession={tournamentId:data.t.id,workSessionId:work.id};
  const config={type:'double',sets:3,points:11,rule:'touch',players:scheduled.players,start:{A:0,B:0},scoring:'side-out'};
  const session=createMatch(config,{serving:'A',courtLeft:'A',right:{A:0,B:1},serverIndex:0});
  session.currentGamePoints={A:8,B:6};session.tournamentContext={tournamentId:data.t.id,scheduledMatchId:scheduled.id,rulesVersionId:data.t.activeRulesVersionId};scheduled.matchSessionId=session.id;
  data.matches.activeId=session.id;data.matches.matches[session.id]=session;
  const projection=resolveTodayProjection({matchDocument:data.matches,tournamentDocument:data.tournaments,now});
  assert.equal(projection.kind,'active-match');assert.equal(projection.activeMatch.id,session.id);assert.deepEqual(projection.activeMatch.points,{A:8,B:6});assert.equal(projection.activeMatch.court,'Sân 06');assert.equal(projection.work.workSessionId,work.id);
});

test('completed workday resolves only from a real completed Work Session on the local day',()=>{
  const data=setup(),work=startWorkSession(data.t,data.assignment.id);work.status='completed';work.startedAt='2026-09-24T00:00:00.000Z';work.endedAt='2026-09-24T05:32:00.000Z';data.assignment.status='completed';
  for(const scheduled of data.scheduled){const id=`session-${scheduled.id}`;scheduled.matchSessionId=id;data.matches.matches[id]={id,status:'finished'};}
  const projection=resolveTodayProjection({matchDocument:data.matches,tournamentDocument:data.tournaments,now});
  assert.equal(projection.kind,'completed');assert.deepEqual(projection.summary,{matches:2,durationMinutes:332});
});

test('production shell has no state switcher and old inline frontend is no longer an entry point',()=>{
  const index=readFileSync(new URL('../index.html',import.meta.url),'utf8'),shell=readFileSync(new URL('../src/app-shell.js',import.meta.url),'utf8');
  assert.match(index,/src\/app-shell\.js/);assert.doesNotMatch(index,/data-a=|Chọn chế độ làm việc|Sắp ra mắt/);
  assert.doesNotMatch(shell,/visualState|state-switcher|demo-state/);assert.match(shell,/Hôm nay/);assert.match(shell,/Giải đấu/);assert.doesNotMatch(shell,/\['work','work','Công việc'\]/);assert.match(shell,/Trận đấu/);assert.match(shell,/Thông báo/);assert.match(shell,/Hồ sơ/);
});
