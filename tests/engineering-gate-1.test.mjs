import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, rally, undo, redo, nextGame, prepareNextGame, resolveFinal, matchView, scoreCall, startPause, endPause} from '../src/match-engine.js';
import {createMatchRepository, STORE_KEY} from '../src/match-persistence.js';
import {RULES_VERSION} from '../src/match-domain.js';

const config=(type,sets=3,start={A:0,B:0})=>({type,sets,points:3,rule:'touch',cap:5,start,scoring:'side-out',players:{A:type==='single'?['An']:['An','Bình'],B:type==='single'?['Chi']:['Chi','Dung']}});
const final={serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0};
function storage(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key),map}}
function reopen(device){return createMatchRepository(device)}

test('Quick Match singles: handicap, immediate side-out, Undo/Redo, autosave, two games and history',()=>{
  const device=storage(),repo=reopen(device),s=createMatch(config('single',3,{A:1,B:0}),final);
  repo.saveSession(s);
  assert.equal(scoreCall(repo.active()),'1 – 0');
  rally(s,'B');repo.saveSession(s);
  assert.equal(matchView(reopen(device).active()).server,'Chi');
  const before=structuredClone(s);
  rally(s,'B');repo.saveSession(s);
  assert.equal(scoreCall(reopen(device).active()),'1 – 1');
  undo(s);repo.saveSession(s);
  assert.deepEqual(s.score,before.score);assert.equal(s.serving,before.serving);
  assert.deepEqual(matchView(s).participants,matchView(before).participants);
  redo(s);repo.saveSession(s);assert.equal(scoreCall(reopen(device).active()),'1 – 1');
  rally(s,'B');rally(s,'B');repo.saveSession(s);assert.equal(s.status,'gameEnd');
  nextGame(s,resolveFinal(s.config,prepareNextGame(s)));repo.saveSession(s);assert.equal(s.game,2);
  for(let i=0;i<3;i++)rally(s,s.serving);
  repo.saveSession(s);assert.equal(s.status,'finished');assert.equal(repo.history().length,1);
  assert.deepEqual(reopen(device).get(s.id).gamesWon,s.gamesWon);
  assert.equal(reopen(device).get(s.id).rulesVersion,RULES_VERSION);
});

test('Quick Match doubles: first service, server 1 to 2, side-out, court and full Undo/Redo survive reload',()=>{
  const device=storage(),repo=reopen(device),s=createMatch(config('double',3),final);
  rally(s,'B'); // initial second server loses: side-out
  assert.equal(scoreCall(s),'0 – 0 – 1');
  rally(s,'A');assert.equal(scoreCall(s),'0 – 0 – 2');
  const before=structuredClone(s),beforeCourt=matchView(s);
  rally(s,'A');repo.saveSession(s);
  assert.equal(scoreCall(reopen(device).active()),'0 – 0 – 1');
  undo(s);repo.saveSession(s);
  assert.deepEqual(matchView(reopen(device).active()),beforeCourt);
  assert.deepEqual(s.score,before.score);
  const afterReload=reopen(device).active();redo(afterReload);reopen(device).saveSession(afterReload);
  assert.equal(scoreCall(reopen(device).active()),'0 – 0 – 1');
  for(let i=0;i<3;i++)rally(afterReload,'A');
  assert.equal(afterReload.status,'gameEnd');
  nextGame(afterReload,resolveFinal(afterReload.config,prepareNextGame(afterReload)));
  for(let i=0;i<3;i++)rally(afterReload,afterReload.serving);
  assert.equal(afterReload.status,'gameEnd');
  nextGame(afterReload,resolveFinal(afterReload.config,prepareNextGame(afterReload)));
  if(afterReload.serving!=='A')rally(afterReload,'A');
  for(let i=0;i<3;i++)rally(afterReload,'A');
  repo.saveSession(afterReload);
  assert.equal(afterReload.status,'finished');assert.equal(repo.history().length,1);
  assert.ok(repo.history()[0].events.filter(e=>e.type==='rally').length>=12);
});

test('atomic persistence preserves old sessions and draft, migrates legacy without deleting it',()=>{
  const device=storage(),legacy=createMatch(config('single',1),final);
  device.setItem('pickleball-referee:v1:active',JSON.stringify(legacy));
  device.setItem('pickleball-referee:v1:draft',JSON.stringify({phase:'warmup'}));
  const repo=reopen(device);
  assert.equal(repo.active().id,legacy.id);assert.equal(repo.load().draft.phase,'warmup');
  repo.saveDraft({phase:'final'});
  const second=createMatch(config('double',1),final);repo.saveSession(second,{clearDraft:true});
  assert.equal(reopen(device).active().id,second.id);
  assert.equal(repo.get(legacy.id).id,legacy.id);assert.equal(repo.load().draft,null);
  assert.ok(device.getItem('pickleball-referee:v1:active'));
  assert.equal(JSON.parse(device.getItem(STORE_KEY)).version,2);
});

test('timeout and medical recover the exact pending rally across reload',()=>{
  const device=storage(),repo=reopen(device),s=createMatch(config('double',1),final);
  rally(s,'A');const pending=matchView(s);
  startPause(s,'timeout','B');repo.saveSession(s);
  let recovered=reopen(device).active();assert.equal(recovered.pause.type,'timeout');
  assert.equal(recovered.timeout.B,1);assert.equal(scoreCall(recovered),pending.scoreCall);
  endPause(recovered);startPause(recovered,'medical','A',1);repo.saveSession(recovered);
  recovered=reopen(device).active();assert.equal(recovered.pause.type,'medical');
  assert.deepEqual(recovered.medical.A,[0,1]);endPause(recovered);
  assert.deepEqual(matchView(recovered).participants,pending.participants);
});

test('invalid setup and rally never create a transition; corrupt durable store is not overwritten',()=>{
  assert.throws(()=>createMatch(config('double',2),final),/Số game/);
  const s=createMatch(config('single',1),final);
  assert.throws(()=>rally(s,'X'),/không hợp lệ/);assert.equal(s.events.length,0);
  const device=storage();device.setItem(STORE_KEY,'{broken');
  assert.throws(()=>reopen(device).load(),/bị hỏng/);
  assert.equal(device.getItem(STORE_KEY),'{broken');
});
