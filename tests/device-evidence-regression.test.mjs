import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTournament,createAssignment,addResource,startWorkSession} from '../src/tournament-domain.js';
import {resolveTodayProjection} from '../src/today-projection.js';

const source=name=>readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8');

test('phone shell does not enable the desktop inset at 391 CSS pixels',()=>{
  const css=source('app-shell.css');
  assert.doesNotMatch(css,/@media\(min-width:391px\)/);
  assert.match(css,/@media\(max-width:767px\)\{\.app-shell\{max-width:none;box-shadow:none\}\}/);
  assert.match(css,/@media\(min-width:768px\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
});

test('tournament shell omits empty headers but preserves safe-area on headerless screens',()=>{
  assert.match(source('tournament-experience.js'),/const hasHeader=Boolean\(title\|\|subtitle\|\|back\|\|action\)/);
  assert.match(source('tournament-experience.js'),/\$\{hasHeader\?`<header/);
  assert.match(source('tournament-experience.css'),/\.tx-headerless \.tx-content\{padding-top:env\(safe-area-inset-top\)\}/);
});

test('future tournament with real active work and empty scope remains recoverable, not silently discarded',()=>{
  const t=createTournament('Giải tương lai');
  t.startsAt='2026-09-27';
  const court=addResource(t,'courts','Sân 1');
  const assignment=createAssignment(t,{label:'Sân 1',scopeKind:'court',scopeIds:[court.id]});
  const session=startWorkSession(t,assignment.id);
  const input={matchDocument:{matches:{},activeId:null},tournamentDocument:{tournaments:{[t.id]:t},activeWorkSession:{tournamentId:t.id,workSessionId:session.id}},now:new Date('2026-09-24T13:13:00Z')};
  const before=JSON.stringify(input);
  const projected=resolveTodayProjection(input);
  assert.equal(projected.kind,'waiting');
  assert.equal(projected.work.workSessionId,session.id);
  assert.deepEqual(projected.progress,{total:0,finished:0,percent:0});
  const reopened={...input,tournamentDocument:JSON.parse(JSON.stringify(input.tournamentDocument))};
  assert.deepEqual(resolveTodayProjection(reopened),projected);
  assert.equal(JSON.stringify(input),before);
});
