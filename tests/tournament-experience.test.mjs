import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTournament,addPlayer,addEntry,addResource,addScheduledMatch} from '../src/tournament-domain.js';

const source=readFileSync(new URL('../src/tournament-experience.js',import.meta.url),'utf8');

test('Global Bottom Navigation V1.1 exposes Giải đấu and removes Công việc as a tab',()=>{
  const shell=readFileSync(new URL('../src/app-shell.js',import.meta.url),'utf8');
  assert.match(shell,/\['tournament','tournament','Giải đấu'\]/);
  assert.doesNotMatch(shell,/\['work','work','Công việc'\]/);
  assert.match(shell,/openTournamentExperience/);
});

test('Experience Build #1 contains every verified READY screen and no guessed confirmation screen',()=>{
  for(const label of ['Giải đấu','Tạo giải đấu','Tạo giải đấu thành công!','Thêm phân công','Thêm bảng đấu','Thể thức tính điểm','Sân của tôi','Bảng đấu','Danh sách VĐV','Lịch thi đấu','Kết quả','Bảng xếp hạng'])assert.match(source,new RegExp(label));
  assert.doesNotMatch(source,/Phân công đã được lưu/);
  assert.match(source,/window\.addEventListener\('tournament-open'/);
});

test('round-robin screens preserve Player and Entry identity instead of display-name identity',()=>{
  const t=createTournament('Giải kiểm thử'),group=addResource(t,'groups','Bảng A'),court=addResource(t,'courts','Sân 3');
  const makePair=(a,b)=>{const ids=[a,b].map(displayName=>addPlayer(t,{displayName}).id);return addEntry(t,{type:'double',playerIds:ids})};
  const first=makePair('Nguyễn An','Trần Bình'),second=makePair('Nguyễn An','Lê Minh');
  const match=addScheduledMatch(t,{label:'Trận 1',groupId:group.id,courtId:court.id,type:'double',entrantIds:{A:first.id,B:second.id}});
  assert.notEqual(first.playerIds[0],second.playerIds[0]);
  assert.deepEqual(match.entrantIds,{A:first.id,B:second.id});
});
