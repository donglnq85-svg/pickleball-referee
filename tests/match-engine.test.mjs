import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,rally,undo,redo,nextGame,scoreCall,serverIndex,receiverIndex,rightPlayer,startPause,endPause,correct} from '../src/match-engine.js';
const cfg=(type='double',sets=1,points=11,start={A:0,B:0})=>({type,sets,points,rule:'touch',cap:15,start,players:{A:type==='double'?['An','Bình']:['An'],B:type==='double'?['Chi','Dung']:['Chi']}});
const final={serving:'A',serverIndex:0,courtLeft:'A',right:{A:0,B:0}};
test('doubles starts with only second server, switches first/second then side out',()=>{
 const s=createMatch(cfg(),final);
 assert.equal(scoreCall(s),'0 – 0 – 2');assert.equal(serverIndex(s),0);assert.equal(receiverIndex(s),0);
 rally(s,'B');assert.equal(scoreCall(s),'0 – 0 – 1');assert.equal(s.serving,'B');assert.equal(serverIndex(s),0);
 rally(s,'B');assert.equal(scoreCall(s),'1 – 0 – 1');assert.equal(serverIndex(s),0);assert.equal(receiverIndex(s),1);assert.equal(rightPlayer(s,'B'),1);
 rally(s,'A');assert.equal(scoreCall(s),'1 – 0 – 2');assert.equal(serverIndex(s),1);
 rally(s,'A');assert.equal(scoreCall(s),'0 – 1 – 1');assert.equal(s.serving,'A');assert.equal(serverIndex(s),0);
 undo(s);assert.equal(scoreCall(s),'1 – 0 – 2');assert.equal(s.serving,'B');assert.equal(serverIndex(s),1);assert.equal(receiverIndex(s),1);
 redo(s);assert.equal(scoreCall(s),'0 – 1 – 1');assert.equal(s.serving,'A');
});
test('singles uses two-number call and immediate side out with parity',()=>{
 const s=createMatch(cfg('single'),final);assert.equal(scoreCall(s),'0 – 0');assert.equal(s.serverNumber,null);
 rally(s,'A');assert.equal(scoreCall(s),'1 – 0');assert.equal(s.serving,'A');
 rally(s,'B');assert.equal(scoreCall(s),'0 – 1');assert.equal(s.serving,'B');assert.equal(s.serverNumber,null);
 undo(s);assert.equal(scoreCall(s),'1 – 0');redo(s);assert.equal(scoreCall(s),'0 – 1');
});
test('handicap, cap, game transition and match completion',()=>{
 const c=cfg('double',3,3,{A:1,B:0});c.rule='maximum';c.cap=4;
 const s=createMatch(c,{...final,serving:'B',serverIndex:1,right:{A:1,B:1}});
 assert.equal(scoreCall(s),'0 – 1 – 2');assert.equal(serverIndex(s),1);
 rally(s,'A');assert.equal(s.serving,'A');assert.equal(scoreCall(s),'1 – 0 – 1');
 rally(s,'A');assert.equal(s.status,'playing');rally(s,'A');assert.equal(s.status,'gameEnd');assert.equal(s.gamesWon.A,1);
 nextGame(s,final);assert.equal(s.game,2);assert.equal(s.score.A,1);assert.equal(scoreCall(s),'1 – 0 – 2');
 rally(s,'A');rally(s,'A');assert.equal(s.status,'finished');assert.equal(s.games.length,2);assert.equal(s.gamesWon.A,2);
 undo(s);assert.equal(s.status,'playing');assert.equal(s.gamesWon.A,1);redo(s);assert.equal(s.status,'finished');
});
test('timeout and medical preserve score, server, and receiver',()=>{
 const s=createMatch(cfg(),final);rally(s,'A');const before=scoreCall(s);const server=serverIndex(s),receiver=receiverIndex(s);
 startPause(s,'timeout','A');assert.equal(s.pause.duration,60000);endPause(s);
 startPause(s,'medical','B',1);assert.equal(s.pause.duration,900000);endPause(s);
 assert.equal(scoreCall(s),before);assert.equal(serverIndex(s),server);assert.equal(receiverIndex(s),receiver);assert.equal(s.timeout.A,1);assert.deepEqual(s.medical.B,[0,1]);
 const resumed=structuredClone(s);assert.equal(scoreCall(resumed),before);assert.equal(resumed.events.length,5);
});
test('referee correction is auditable and reversible',()=>{
 const s=createMatch(cfg(),final);
 correct(s,{A:4,B:2,serving:'B',number:1,player:1});
 assert.equal(scoreCall(s),'2 – 4 – 1');assert.equal(serverIndex(s),1);
 assert.equal(s.events.at(-1).type,'correction');
 undo(s);assert.equal(scoreCall(s),'0 – 0 – 2');assert.equal(serverIndex(s),0);
 redo(s);assert.equal(scoreCall(s),'2 – 4 – 1');
});
