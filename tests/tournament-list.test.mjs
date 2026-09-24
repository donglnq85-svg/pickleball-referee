import test from 'node:test';
import assert from 'node:assert/strict';
import {tournamentListState,tournamentWorkBadge} from '../src/tournament-list-projection.js';
const now=new Date('2026-09-24T13:00:00Z');
test('list calendar grouping does not confuse early referee work with event start',()=>{
  const t={startsAt:'2026-09-26',endsAt:'2026-09-28',status:'active',assignments:[]};
  assert.equal(tournamentListState(t,now),'upcoming');
  assert.equal(tournamentListState(t,new Date('2026-09-25T17:00:00Z')),'live');
  assert.equal(tournamentListState(t,new Date('2026-09-28T17:00:00Z')),'done');
  assert.equal(t.status,'active');
});
test('work badges derive from actual assignments and survive serialization',()=>{
  const t={assignments:[]};
  assert.equal(tournamentWorkBadge(t,'upcoming').label,'Chưa có lịch làm việc');
  t.assignments.push({id:'assignment-1',status:'assigned'});
  assert.equal(tournamentWorkBadge(JSON.parse(JSON.stringify(t)),'upcoming').label,'Đã có lịch làm việc');
  assert.equal(tournamentWorkBadge(t,'live').label,'Đang diễn ra');
  assert.equal(tournamentWorkBadge(t,'done').label,'Đã kết thúc');
});
