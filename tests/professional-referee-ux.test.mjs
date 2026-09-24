import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTournament,addRulesVersion,addResource,addPlayer,addEntry,addScheduledMatch,createAssignment,startWorkSession} from '../src/tournament-domain.js';
import {ensureRefereeWorkspace,updateWorkProfile,workProfile,setAttendance,scopedEntries,smartMatchQueue} from '../src/referee-workspace.js';

const matchRepository={get(){return null}};
const entrant=(t,names)=>addEntry(t,{type:names.length===1?'single':'double',playerIds:names.map(displayName=>addPlayer(t,{displayName}).id)});

function workday(){
  const t=createTournament('Chưa có tên giải');
  addRulesVersion(t,{label:'Nền',authority:'BTC',scoring:'side-out',format:{sets:1,points:11,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting:{match:'optional',group:'optional'}}});
  const court=addResource(t,'courts','Sân 1'),groupA=addResource(t,'groups','Bảng A'),groupB=addResource(t,'groups','Bảng B');
  const a=entrant(t,['An','Bình']),b=entrant(t,['Chi','Dũng']),c=entrant(t,['Hà','Lan']);
  const first=addScheduledMatch(t,{label:'A1',courtId:court.id,groupId:groupA.id,type:'double',entrantIds:{A:a.id,B:b.id}});
  const second=addScheduledMatch(t,{label:'B1',courtId:court.id,groupId:groupB.id,type:'double',entrantIds:{A:a.id,B:c.id}});
  const assignment=createAssignment(t,{label:'Sân 1 · hai bảng',scopeKind:'group',scopeIds:[groupA.id,groupB.id]}),work=startWorkSession(t,assignment.id);
  return {t,court,groupA,groupB,a,b,c,first,second,assignment,work};
}

test('work diary accepts date-first records and preserves unknown name/location explicitly',()=>{
  const t=createTournament('Chưa có tên giải');ensureRefereeWorkspace(t);updateWorkProfile(t,{date:'2026-09-27',name:'',location:'',commitment:'planned'});
  assert.equal(t.name,'Chưa có tên giải');assert.equal(workProfile(t).date,'2026-09-27');assert.equal(workProfile(t).location,null);assert.equal(workProfile(t).commitment,'planned');
});

test('one personal work scope can include multiple groups without changing assignment identity',()=>{
  const {t,assignment}=workday(),entries=scopedEntries(t,assignment.id);
  assert.equal(assignment.scope.kind,'group');assert.equal(assignment.scope.ids.length,2);assert.equal(entries.length,3);assert.equal(new Set(entries.map(item=>item.id)).size,3);
});

test('attendance directly changes Smart Match Queue recommendation and reason',()=>{
  const {t,a,b,c,first,second,work}=workday();
  setAttendance(t,a.id,'present');setAttendance(t,b.id,'present');setAttendance(t,c.id,'missing');
  let queue=smartMatchQueue(t,work.id,matchRepository,Date.parse('2026-09-27T08:00:00Z'));
  assert.equal(queue.recommended.id,first.id);assert.match(queue.recommended.reason,/Hai bên đã có mặt/);assert.equal(queue.items.find(item=>item.id===second.id).eligible,false);
  setAttendance(t,b.id,'missing');setAttendance(t,c.id,'present');queue=smartMatchQueue(t,work.id,matchRepository,Date.parse('2026-09-27T08:05:00Z'));
  assert.equal(queue.recommended.id,second.id);
});

test('normal tournament UI uses referee language and keeps internal terminology out of rendered copy',()=>{
  const ui=readFileSync(new URL('../src/tournament-ui.js',import.meta.url),'utf8');
  for(const phrase of ['Rules Version','My Assignment','Work Session','Canonical Result','Group Snapshot','NEEDS_CONFIRMATION','Court Manager','Pre-Match','Match Start Snapshot'])assert.doesNotMatch(ui,new RegExp(phrase));
  for(const phrase of ['LỊCH LÀM VIỆC SẮP TỚI','Cài đặt giải','Phần việc của tôi','Điểm danh VĐV','TRẬN NÊN GỌI TIẾP','BẮT ĐẦU KHỞI ĐỘNG','CHIA SẺ'])assert.match(ui,new RegExp(phrase));
});

