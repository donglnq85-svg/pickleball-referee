// Read-only UI projections. Match state and the result ledger remain authoritative.
const latestResult=(t,id)=>{const entry=t.resultLedger?.byMatch?.[id];return entry?.versions.find(v=>v.id===entry.currentVersionId)||null};
export const nextReadyMatchId=(t,groupId)=>t.schedule.find(m=>m.groupId===groupId&&m.readiness==='ready'&&!m.matchSessionId&&!latestResult(t,m.id))?.id||null;
export function projectMatch(t,match,sessions={},nextMatchId=null){
  const session=match.matchSessionId?sessions[match.matchSessionId]:null;
  const result=latestResult(t,match.id);
  const completed=!!result||session?.status==='finished';
  const live=!!session&&!completed;
  const status=completed?'COMPLETED':live?'LIVE':match.id===nextMatchId?'NEXT':'NOT_STARTED';
  const games=result?.completedGames||session?.completedGames||[];
  const multi=(result?.format?.sets||session?.config?.sets||1)>1;
  const points=result?(multi?result.matchGamesWon:games[0]?.points):session?(completed?(multi?session.gamesWon:games[0]?.points):session.currentGamePoints):null;
  return {id:match.id,status,points:points?{...points}:null,winner:completed?(result?.winner||(session?.gamesWon.A>session?.gamesWon.B?'A':session?.gamesWon.B>session?.gamesWon.A?'B':null)):null,
    scoreKind:completed&&multi?'MATCH_GAMES_WON':'GAME_POINTS',completedGames:structuredClone(games),
    resultVersionId:result?.id||null,resultConfirmed:result?.status==='CONFIRMED'};
}

export function projectStandings(t,g){
  const matches=t.schedule.filter(m=>m.groupId===g.id);
  const results=matches.map(m=>latestResult(t,m.id)).filter(r=>r?.status==='CONFIRMED');
  const ids=results.map(r=>r.id).sort();
  const snapshot=[...(t.groupSnapshots||[])].reverse().find(s=>s.groupId===g.id);
  const fresh=!!snapshot&&JSON.stringify([...snapshot.resultVersionIds].sort())===JSON.stringify(ids);
  const entryIds=[...new Set([...(g.entryIds||[]),...matches.flatMap(m=>Object.values(m.entrantIds||{})).filter(Boolean)])];
  const rows=new Map(entryIds.map(id=>[id,{entry:t.structure.entries.find(e=>e.id===id),played:0,wins:0,losses:0,pointsFor:0,pointsAgainst:0,rank:null}]).filter(([,r])=>r.entry));
  for(const result of results)for(const side of ['A','B']){
    const row=rows.get(result.entrants[side].id);if(!row)continue;
    row.played++;row.wins+=result.winner===side?1:0;row.losses+=result.winner===side?0:1;
    for(const game of result.completedGames){row.pointsFor+=game.points[side];row.pointsAgainst+=game.points[side==='A'?'B':'A']}
  }
  // Historical snapshots are never rewritten or displayed as a current ranking
  // when their exact result-version inputs no longer match.
  if(fresh)for(const item of snapshot.rows){const row=rows.get(item.entrantId);if(row)row.rank=item.rank}
  return {rows:[...rows.values()].sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)),snapshotId:fresh?snapshot.id:null,
    resultVersionIds:ids,needsConfirmation:!fresh||snapshot.status!=='RANKED'};
}
