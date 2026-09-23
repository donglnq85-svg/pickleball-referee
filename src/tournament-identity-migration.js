const clone=value=>structuredClone(value);
const legacyId=(kind,...parts)=>`legacy-${kind}:${parts.map(value=>encodeURIComponent(String(value))).join(':')}`;
const metrics={
  matchWins:row=>row.matchWins,matchLosses:row=>row.matchLosses,gameWins:row=>row.gameWins,gameLosses:row=>row.gameLosses,
  pointsFor:row=>row.pointsFor,pointsAgainst:row=>row.pointsAgainst,gameDifferential:row=>row.gameWins-row.gameLosses,pointDifferential:row=>row.pointsFor-row.pointsAgainst
};

function rebuildSnapshot(t,snapshot,resultsById){
  const rules=t.rankingRulesVersions?.find(item=>item.id===snapshot.rankingRulesVersionId)||null;
  const table=new Map(),row=entrant=>{
    if(!table.has(entrant.id))table.set(entrant.id,{entrantId:entrant.id,players:clone(entrant.players),played:0,matchWins:0,matchLosses:0,gameWins:0,gameLosses:0,gameDifferential:0,pointsFor:0,pointsAgainst:0,pointDifferential:0,rank:null,qualification:'UNKNOWN'});
    return table.get(entrant.id);
  };
  for(const resultId of snapshot.resultVersionIds||[]){
    const result=resultsById.get(resultId);if(!result)continue;
    for(const team of ['A','B']){
      const own=row(result.entrants[team]),opponent=team==='A'?'B':'A';own.played++;own.matchWins+=result.winner===team?1:0;own.matchLosses+=result.winner===team?0:1;
      const matchGamesWon=result.matchGamesWon??result.gamesWon,completedGames=result.completedGames??result.games;
      own.gameWins+=matchGamesWon[team];own.gameLosses+=matchGamesWon[opponent];for(const game of completedGames){const points=game.points??game.score;own.pointsFor+=points[team];own.pointsAgainst+=points[opponent]}
    }
  }
  for(const item of table.values()){item.gameDifferential=item.gameWins-item.gameLosses;item.pointDifferential=item.pointsFor-item.pointsAgainst}
  let status='RANKED',reason=null,ordered=[...table.values()];
  if(!rules||!rules.criteria?.length){status='NEEDS_CONFIRMATION';reason='RANKING_RULES_INCOMPLETE'}
  else if(rules.criteria.some(rule=>!metrics[rule.metric])){status='NEEDS_CONFIRMATION';reason='RANKING_METRIC_UNSUPPORTED'}
  else{
    ordered.sort((a,b)=>{for(const rule of rules.criteria){const delta=metrics[rule.metric](a)-metrics[rule.metric](b);if(delta)return rule.direction==='asc'?delta:-delta}return a.entrantId.localeCompare(b.entrantId)});
    for(let index=0;index<ordered.length;index++){
      const tied=index>0&&rules.criteria.every(rule=>metrics[rule.metric](ordered[index])===metrics[rule.metric](ordered[index-1]));
      const tiedNext=index<ordered.length-1&&rules.criteria.every(rule=>metrics[rule.metric](ordered[index])===metrics[rule.metric](ordered[index+1]));
      ordered[index].rank=tied||tiedNext?null:index+1;if(tied||tiedNext){status='NEEDS_CONFIRMATION';reason='UNRESOLVED_TIE'}
    }
  }
  let qualificationStatus='UNKNOWN',qualified=[];
  if(rules?.qualification?.kind==='top'&&status==='RANKED'){
    qualificationStatus='KNOWN';qualified=ordered.slice(0,rules.qualification.count).map(item=>item.entrantId);for(const item of ordered)item.qualification=qualified.includes(item.entrantId)?'QUALIFIED':'NOT_QUALIFIED';
  }else if(rules?.qualification?.kind==='top')qualificationStatus='NEEDS_CONFIRMATION';
  snapshot.rows=ordered;snapshot.status=status;snapshot.reason=reason;snapshot.qualification={status:qualificationStatus,qualified};
}

export function migrateTournamentIdentity(input){
  if(input?.schemaVersion===2)return {tournament:clone(input),migrated:false};
  if(input?.schemaVersion!==1)throw Error('Phiên bản dữ liệu giải chưa được hỗ trợ.');
  const t=clone(input);t.structure??={};t.structure.players??=[];t.structure.entries??=[];t.structure.teams??=[];
  const players=new Map(t.structure.players.map(item=>[item.id,item])),entries=new Map(t.structure.entries.map(item=>[item.id,item]));
  for(const match of t.schedule||[]){
    const refs={A:match.entrantIds?.A||null,B:match.entrantIds?.B||null};
    for(const team of ['A','B']){
      const names=Array.isArray(match.players?.[team])?match.players[team]:[];
      if(!['single','double'].includes(match.type)){refs[team]=null;continue}
      const expected=match.type==='single'?1:2;
      if(!refs[team]&&names.filter(name=>typeof name==='string'&&name.trim()).length!==expected){refs[team]=null;continue}
      const entryId=refs[team]||legacyId('entry',match.id,team);refs[team]=entryId;
      if(!entries.has(entryId)){
        const playerIds=names.map((name,index)=>{
          if(typeof name!=='string'||!name.trim())return null;
          const playerId=legacyId('player',match.id,team,index);if(!players.has(playerId)){const player={id:playerId,displayName:name.trim(),createdAt:match.createdAt||t.createdAt};players.set(playerId,player);t.structure.players.push(player)}return playerId;
        }).filter(Boolean);
        if(playerIds.length!==expected){refs[team]=null;continue}
        const entry={id:entryId,type:match.type,playerIds,teamId:null,label:null,createdAt:match.createdAt||t.createdAt};entries.set(entryId,entry);t.structure.entries.push(entry);
      }
    }
    match.entrantIds=refs;
    match.players=refs.A&&refs.B?{A:entries.get(refs.A).playerIds.map(pid=>players.get(pid).displayName),B:entries.get(refs.B).playerIds.map(pid=>players.get(pid).displayName)}:null;
    const participantIdentity={};for(const team of ['A','B']){const entry=entries.get(refs[team]);entry?.playerIds.forEach((playerId,index)=>participantIdentity[`${team}${index+1}`]={playerId,entryId:entry.id})}
    for(const participant of match.operations?.preMatch?.participants||[])Object.assign(participant,participantIdentity[participant.id]||{playerId:null,entryId:null});
    for(const participant of match.matchStartSnapshot?.participants||[])Object.assign(participant,participantIdentity[participant.id]||{playerId:null,entryId:null});
    for(const result of t.resultLedger?.byMatch?.[match.id]?.versions||[]){
      for(const team of ['A','B']){result.entrants??={};result.entrants[team]??={players:clone(result.players?.[team]||match.players?.[team]||[])};result.entrants[team].id=refs[team]}
    }
  }
  const resultsById=new Map(Object.values(t.resultLedger?.byMatch||{}).flatMap(entry=>entry.versions||[]).map(result=>[result.id,result]));
  for(const snapshot of t.groupSnapshots||[])rebuildSnapshot(t,snapshot,resultsById);
  t.schemaVersion=2;
  if(!(t.events||[]).some(event=>event.type==='identitySchemaMigrated'))(t.events??=[]).push({id:legacyId('event',t.id,'identity-v2'),at:t.updatedAt||t.createdAt,type:'identitySchemaMigrated',fromSchemaVersion:1,toSchemaVersion:2});
  return {tournament:t,migrated:true};
}

export function migrateTournamentScoreSemantics(input){
  const t=clone(input);let migrated=false;
  for(const rules of t.rankingRulesVersions||[])for(const criterion of rules.criteria||[]){
    if(criterion.metric==='pointsWon'){criterion.metric='pointsFor';migrated=true}
    if(criterion.metric==='pointsLost'){criterion.metric='pointsAgainst';migrated=true}
  }
  for(const entry of Object.values(t.resultLedger?.byMatch||{}))for(const result of entry.versions||[]){
    if(!result.completedGames&&Array.isArray(result.games)){
      result.completedGames=result.games.map((game,index)=>({gameNumber:game.game??index+1,points:clone(game.points??game.score),winner:game.winner}));delete result.games;migrated=true;
    }
    if(!result.matchGamesWon&&result.gamesWon){result.matchGamesWon=clone(result.gamesWon);delete result.gamesWon;migrated=true}
    if(!result.format){
      const rules=t.rulesVersions?.find(item=>item.id===result.rulesVersionId),sets=rules?.format?.sets??Math.max(result.completedGames?.length||1,(result.matchGamesWon?.A||0)+(result.matchGamesWon?.B||0));
      result.format={sets,requiredWins:Math.floor(sets/2)+1};migrated=true;
    }
  }
  if(migrated){
    const resultsById=new Map(Object.values(t.resultLedger?.byMatch||{}).flatMap(entry=>entry.versions||[]).map(result=>[result.id,result]));
    for(const snapshot of t.groupSnapshots||[])rebuildSnapshot(t,snapshot,resultsById);
    if(!(t.events||[]).some(event=>event.type==='scoreSemanticsMigrated'))(t.events??=[]).push({id:legacyId('event',t.id,'score-semantics-v1'),at:t.updatedAt||t.createdAt,type:'scoreSemanticsMigrated'});
  }
  return {tournament:t,migrated};
}
