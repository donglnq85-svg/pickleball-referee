import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, rally, undo, redo, correct, setCourtLeft, nextGame, prepareNextGame, resolveFinal, matchView, serverSide, scoreCall} from '../src/match-engine.js';
import {courtView} from '../src/court-view.js';
import {createMatchRepository} from '../src/match-persistence.js';

const config=(type,start={A:0,B:0},sets=3)=>({type,sets,points:11,rule:'touch',cap:15,start,players:{A:type==='single'?['An']:['An','Bình'],B:type==='single'?['Chi']:['Chi','Dung']}});
const final=(config,serving='A',courtLeft='A',right={A:0,B:0})=>resolveFinal(config,{serving,courtLeft,right});

function assertState(s, label) {
  const v=matchView(s),server=v.participants.filter(p=>p.server),receiver=v.participants.filter(p=>p.receiver),ball=v.participants.filter(p=>p.ball);
  assert.equal(server.length,1,label);assert.equal(receiver.length,1,label);assert.equal(ball.length,1,label);
  assert.equal(server[0].team,s.serving,label);assert.equal(receiver[0].team,s.serving==='A'?'B':'A',label);
  assert.equal(server[0].index,v.serverIndex,label);assert.equal(receiver[0].index,v.receiverIndex,label);
  assert.equal(server[0].name,v.server,label);assert.equal(receiver[0].name,v.receiver,label);
  assert.deepEqual([ball[0].team,ball[0].index],[server[0].team,server[0].index],label);
  assert.equal(server[0].lane,serverSide(s),label);
  assert.equal(receiver[0].lane,server[0].lane,label); // same named lane = diagonal across the net
  assert.notEqual(receiver[0].end,server[0].end,label);
  assert.notEqual(receiver[0].top,server[0].top,label); // physically opposite court rows
  assert.equal(v.serverNumber,s.config.type==='single'?null:s.serverNumber,label);
  assert.equal(v.scoreCall,scoreCall(s),label);
  return {server:server[0],receiver:receiver[0]};
}

function assertRendered(s,label){
  const {server,receiver}=assertState(s,label),html=courtView(s);
  const elements=[...html.matchAll(/<div class="court-player ([^"]+)" style="--court-x:(17%|83%);--court-y:(26%|74%)" aria-label="([^"]+)"/g)];
  assert.equal(elements.length,s.config.type==='single'?2:4,label);
  const selected=elements.filter(m=>m[1].includes('is-server')),
    receiving=elements.filter(m=>m[1].includes('is-receiver'));
  assert.equal(selected.length,1,label);assert.equal(receiving.length,1,label);
  assert.match(selected[0][4],new RegExp(server.name+' · Đội '+server.team+' · giao bóng'),label);
  assert.match(receiving[0][4],new RegExp(receiver.name+' · Đội '+receiver.team+' · đỡ bóng'),label);
  assert.notEqual(selected[0][2],receiving[0][2],label);
  assert.notEqual(selected[0][3],receiving[0][3],label);
  assert.ok(html.includes('court-net')&&html.includes('court-nvz-left')&&html.includes('court-nvz-right'),label);
}

test('reproduction: second server at even score serves from left, receiver diagonally opposite',()=>{
  const c=config('double'),s=createMatch(c,final(c));
  assertRendered(s,'opening 0–0–2');
  rally(s,'B');assertRendered(s,'B first server');
  rally(s,'A');assert.equal(scoreCall(s),'0 – 0 – 2');
  assert.equal(serverSide(s),'left');
  assert.equal(matchView(s).server,'Dung');
  assert.equal(matchView(s).receiver,'Bình');
  assertRendered(s,'B second server');
  rally(s,'B');assert.equal(scoreCall(s),'1 – 0 – 2');assertRendered(s,'second server scores');
});

test('doubles service oracle: identity, court lane and receiver across first/second/side-out',()=>{
  const c=config('double'),s=createMatch(c,final(c));
  const expected=[
    ['0 – 0 – 2','A','An','Chi','right',2],
    ['1 – 0 – 2','A','An','Dung','left',2],
    ['0 – 1 – 1','B','Chi','Bình','right',1],
    ['1 – 1 – 1','B','Chi','An','left',1],
    ['1 – 1 – 2','B','Dung','Bình','right',2],
    ['1 – 1 – 1','A','Bình','Dung','right',1],
  ];
  const winners=['A','B','B','A','A'];
  expected.forEach(([call,team,server,receiver,lane,number],i)=>{
    const v=matchView(s);assert.equal(scoreCall(s),call);assert.equal(v.serving,team);
    assert.equal(v.server,server);assert.equal(v.receiver,receiver);
    assert.equal(serverSide(s),lane);assert.equal(v.serverNumber,number);
    assertRendered(s,'oracle step '+i);
    if(i<winners.length)rally(s,winners[i]);
  });
});

test('singles service oracle: score parity and side-out choose the diagonal return court',()=>{
  const c=config('single'),s=createMatch(c,final(c));
  for(const [winner,call,server,receiver,lane] of [
    [null,'0 – 0','An','Chi','right'],
    ['A','1 – 0','An','Chi','left'],
    ['B','0 – 1','Chi','An','right'],
    ['B','1 – 1','Chi','An','left'],
    ['A','1 – 1','An','Chi','left'],
  ]){
    if(winner)rally(s,winner);
    const v=matchView(s);assert.equal(scoreCall(s),call);assert.equal(v.server,server);
    assert.equal(v.receiver,receiver);assert.equal(serverSide(s),lane);assertRendered(s,call);
  }
});

test('singles and doubles: transition matrix with handicap, ends, multiple rallies, games and persisted Undo/Redo',()=>{
  let visited=0;
  for(const type of ['single','double'])for(const start of [{A:0,B:0},{A:1,B:0},{A:0,B:2}])
  for(const serving of ['A','B'])for(const courtLeft of ['A','B'])for(const right of type==='double'?[{A:0,B:0},{A:1,B:0},{A:0,B:1},{A:1,B:1}]:[{A:0,B:0}]){
    const c=config(type,start),s=createMatch(c,final(c,serving,courtLeft,right));
    assertRendered(s,'opening');visited++;
    for(const winners of ['ABBAABABBA','BAABBABAAB','AAAAAAAAAA','BBBBBBBBBB']){
      const running=structuredClone(s);
      for(const winner of winners){if(running.status!=='playing')break;
        rally(running,winner);assertRendered(running,'after '+winner);visited++;
      }
      if(running.undo.length){const current=matchView(running);undo(running);assertRendered(running,'undo');redo(running);assertRendered(running,'redo');assert.deepEqual(matchView(running),current)}
      if(running.status==='gameEnd'){
        nextGame(running,final(c,serving==='A'?'B':'A',courtLeft==='A'?'B':'A',right));
        assertRendered(running,'next game');visited++;
      }
      setCourtLeft(running,running.courtLeft==='A'?'B':'A');assertRendered(running,'change ends');
      const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
      createMatchRepository(storage).saveSession(running);
      assertRendered(createMatchRepository(storage).active(),'reload');
    }
  }
  assert.ok(visited>1500);
});

test('correction keeps server identity, service lane and receiver consistent for normal and opening second server',()=>{
  const c=config('double');const s=createMatch(c,final(c));
  correct(s,{A:4,B:2,serving:'A',number:2,player:0});
  assert.equal(matchView(s).server,'An');assertRendered(s,'opening correction');
  rally(s,'B'); // side out
  correct(s,{A:4,B:2,serving:'B',number:1,player:1});assertRendered(s,'first server correction');
  correct(s,{A:4,B:2,serving:'B',number:2,player:0});assert.equal(serverSide(s),'left');assertRendered(s,'second server correction');
  const legacy=createMatch(c,final(c));delete legacy.initialService;
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  createMatchRepository(storage).saveSession(legacy);
  const recovered=createMatchRepository(storage).active();
  correct(recovered,{A:1,B:0,serving:'A',number:2,player:0});
  assert.equal(serverSide(recovered),'left');assertRendered(recovered,'legacy opening correction after reload');
});
