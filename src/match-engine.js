// Side-out scoring. USA Pickleball Official Rulebook 2026, sections 4.A, 5.A–B, 6.B.
export const other = team => team === 'A' ? 'B' : 'A';
const copy = value => structuredClone(value);
export function rightPlayer(state, team) {
  if (state.config.type === 'single') return 0;
  return state.score[team] % 2 === 0 ? state.anchor[team] : 1 - state.anchor[team];
}
export function serverSide(state) { return state.score[state.serving] % 2 === 0 ? 'right' : 'left'; }
export function serverIndex(state) {
  if (state.config.type === 'single') return 0;
  const first = state.firstServer;
  return state.serverNumber === 1 ? first : 1 - first;
}
export function receiverIndex(state) {
  if (state.config.type === 'single') return 0;
  const receiving = other(state.serving);
  return serverSide(state) === 'right' ? rightPlayer(state, receiving) : 1 - rightPlayer(state, receiving);
}
export function scoreCall(state) {
  const points = [state.score[state.serving], state.score[other(state.serving)]];
  if (state.config.type === 'double') points.push(state.serverNumber);
  return points.join(' – ');
}
// Read model for the referee-facing screen. Court slots use the referee's viewpoint:
// the left end's right service court is below, the right end's is above.
export function matchView(state) {
  const receiving=other(state.serving);
  const server=serverIndex(state),receiver=receiverIndex(state);
  const participants=[];
  for(const team of ['A','B']){
    const left=team===state.courtLeft;
    const right=rightPlayer(state,team);
    if(state.config.type==='single'){
      const rightCourt=state.score[state.serving]%2===0;
      participants.push({team,index:0,name:state.players[team][0],end:left?'left':'right',lane:rightCourt?'right':'left',top:left?!rightCourt:rightCourt,server:team===state.serving,receiver:team===receiving,ball:team===state.serving});
    }else for(let index=0;index<2;index++){
      const rightCourt=index===right;
      participants.push({team,index,name:state.players[team][index],end:left?'left':'right',lane:rightCourt?'right':'left',top:left?!rightCourt:rightCourt,server:team===state.serving&&index===server,receiver:team===receiving&&index===receiver,ball:team===state.serving&&index===server});
    }
  }
  return {scoreCall:scoreCall(state),serving:state.serving,receiving,serverNumber:state.serverNumber,serverIndex:server,receiverIndex:receiver,server:state.players[state.serving][server],receiver:state.players[receiving][receiver],courtLeft:state.courtLeft,courtRight:other(state.courtLeft),participants};
}
export function prepareNextGame(state){
  const serving=other(state.initialServing||state.serving),courtLeft=other(state.courtLeft),right={A:0,B:0};
  if(state.config.type==='double')for(const team of ['A','B'])right[team]=state.config.start[team]%2===0?state.anchor[team]:1-state.anchor[team];
  return {serving,courtLeft,right,serverIndex:0,receiverIndex:0};
}
export function resolveFinal(config,final){
  const f=copy(final);
  f.serverIndex=config.type==='single'?0:(config.start[f.serving]%2===0?f.right[f.serving]:1-f.right[f.serving]);
  f.receiverIndex=config.type==='single'?0:(config.start[f.serving]%2===0?f.right[other(f.serving)]:1-f.right[other(f.serving)]);
  return f;
}
export function gameWinner(state) {
  const {points, rule, cap} = state.config;
  for (const team of ['A','B']) {
    const own=state.score[team], opposition=state.score[other(team)];
    if (rule === 'touch' && own >= points) return team;
    if (rule !== 'touch' && ((own >= points && own-opposition >= 2) || (rule === 'maximum' && own >= cap))) return team;
  }
  return null;
}
function settleGame(s) {
  const won=gameWinner(s);if(!won)return;
  s.games.push({game:s.game,score:copy(s.score),winner:won});
  s.gamesWon[won]++;
  s.status=s.gamesWon[won]>=Math.floor(s.config.sets/2)+1?'finished':'gameEnd';
  s.notice='Đội '+won+' thắng game '+s.game;
  if(s.status==='finished')s.finishedAt=new Date().toISOString();
}
export function createMatch(config, final) {
  const now=new Date().toISOString(), serving=final.serving;
  const score={A:config.start.A,B:config.start.B};
  const anchor=config.type === 'double' ? {
    A: score.A % 2 === 0 ? final.right.A : 1-final.right.A,
    B: score.B % 2 === 0 ? final.right.B : 1-final.right.B
  } : {A:0,B:0};
  const state={version:1,id:globalThis.crypto?.randomUUID?.() || String(Date.now()),createdAt:now,updatedAt:now,status:'playing',phase:'match',config:copy(config),players:copy(config.players),score,game:1,gamesWon:{A:0,B:0},games:[],serving,initialServing:serving,serverNumber:config.type==='double'?2:null,firstServer:config.type==='double'?1-(final.serverIndex||0):0,anchor,courtLeft:final.courtLeft,notice:'',events:[],undo:[],redo:[],timeout:{A:0,B:0},timeoutTotal:{A:0,B:0},medical:{A:[0,0],B:[0,0]},pause:null};
  return state;
}
export function snapshot(s) {
  const {events,undo,redo,formHtml,...rest}=s;
  return copy(rest);
}
function restore(s, snap) {
  for(const key of Object.keys(s)) if(!['events','undo','redo','formHtml'].includes(key)) delete s[key];
  Object.assign(s,copy(snap));
}
export function transact(s, type, action, extra={}) {
  const before=snapshot(s);
  action();
  s.updatedAt=new Date().toISOString();
  const after=snapshot(s);
  s.undo.push({before,after,type});
  s.redo=[];
  s.events.push({at:s.updatedAt,type,...extra,before,after});
  return s;
}
export function rally(s, winner) {
  if(s.status!=='playing'||s.pause) return s;
  const serving=s.serving;
  return transact(s,'rally',()=>{
    if(winner===serving) {
      s.score[winner]++;
      s.notice='';
      settleGame(s);
    } else if(s.config.type==='double' && s.serverNumber===1) {
      s.serverNumber=2;
      s.notice='Đổi người giao · Đội '+serving+' giao lượt 2';
    } else {
      s.serving=winner;
      if(s.config.type==='double') {
        s.serverNumber=1;
        s.firstServer=rightPlayer(s,winner);
      }
      s.notice='SIDE OUT · Đội '+winner+' chuyển sang giao · '+s.players[winner][serverIndex(s)]+' → '+s.players[other(winner)][receiverIndex(s)]+' · '+scoreCall(s);
    }
  },{winner});
}
export function undo(s) {
  const transition=s.undo.pop(); if(!transition) return s;
  s.redo.push(transition); restore(s,transition.before);
  s.events.push({at:new Date().toISOString(),type:'undo',reverses:transition.type});return s;
}
export function redo(s) {
  const transition=s.redo.pop();if(!transition)return s;
  s.undo.push(transition);restore(s,transition.after);
  s.events.push({at:new Date().toISOString(),type:'redo',reapplies:transition.type});return s;
}
export function nextGame(s, final) {
  if(s.status!=='gameEnd') return s;
  return transact(s,'nextGame',()=>{
    s.game++;s.score={A:s.config.start.A,B:s.config.start.B};
    s.serving=final.serving;s.initialServing=final.serving;s.serverNumber=s.config.type==='double'?2:null;
    s.firstServer=s.config.type==='double'?1-(final.serverIndex||0):0;s.courtLeft=final.courtLeft;
    if(s.config.type==='double') for(const team of ['A','B'])s.anchor[team]=s.score[team]%2===0?final.right[team]:1-final.right[team];
    s.status='playing';s.phase='match';s.pause=null;s.timeout={A:0,B:0};s.notice='Game '+s.game+' · xướng '+scoreCall(s);
  });
}
export function setCourtLeft(s, team) {return transact(s,'courtEnd',()=>{s.courtLeft=team;s.notice='Đổi bên sân';});}
export function startPause(s,type,team,playerIndex=0) {
  if(s.status!=='playing'||s.pause) return s;
  return transact(s,type,()=>{if(type==='medical')s.medical[team][playerIndex]++;else{s.timeout[team]++;s.timeoutTotal[team]++}s.pause={type,team,playerIndex,startedAt:Date.now(),duration:type==='timeout'?60000:900000};s.notice=type==='timeout'?'Time-out Đội '+team:'Hỗ trợ y tế · '+s.players[team][playerIndex];});
}
export function endPause(s) {if(!s.pause)return s;return transact(s,'resume',()=>{s.pause=null;s.notice='Trở lại trận · xướng '+scoreCall(s);});}
export function correct(s, input) {
  if(s.status!=='playing'||s.pause)return s;
  const A=Number(input.A),B=Number(input.B);
  if(!Number.isInteger(A)||!Number.isInteger(B)||A<0||B<0||A>99||B>99)throw Error('Điểm phải là số nguyên từ 0 đến 99.');
  if(!['A','B'].includes(input.serving))throw Error('Chọn đội giao.');
  if(s.config.type==='double'&&![1,2].includes(Number(input.number)))throw Error('Chọn lượt giao.');
  const player=Number(input.player);
  if(s.config.type==='double'&&![0,1].includes(player))throw Error('Chọn người giao.');
  return transact(s,'correction',()=>{
    s.score={A,B};s.serving=input.serving;
    if(s.config.type==='double'){
      s.serverNumber=Number(input.number);
      s.firstServer=s.serverNumber===1?player:1-player;
      s.anchor[s.serving]=s.score[s.serving]%2===0?player:1-player;
    }
    s.notice='Đã sửa trạng thái · kiểm tra người giao, người đỡ và xướng '+scoreCall(s);
    settleGame(s);
  },{reason:'referee correction'});
}
