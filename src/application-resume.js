import {createMatchRepository} from './match-persistence.js';
import {createTournamentRepository} from './tournament-persistence.js';
import {assignmentMatches} from './tournament-domain.js';
import {currentResult} from './tournament-results.js';
import {mandatoryUnfinishedWork} from './tournament-shift.js';

const unfinishedMatch=match=>match&&match.status!=='finished';
const preMatchStarted=match=>{
  if(match.matchSessionId)return false;
  if(match.matchStartSnapshot)return true;
  const pre=match.operations?.preMatch;
  return Boolean(pre&&(pre.rulesVersionId||pre.equipment?.policy!=='unknown'||pre.finalSetup||
    pre.warmup?.status!=='pending'||Object.values(pre.confirmations||{}).some(value=>value==='confirmed')||
    Object.values(pre.equipment?.checks||{}).some(Boolean)));
};
const operationsStarted=match=>!match.matchSessionId&&Boolean(match.operations&&(
  match.operations.call?.calls?.length||match.operations.call?.loudspeakerRequests?.length||
  match.operations.waiting?.status!=='idle'));
const lastOperationalAt=(tournament,matchId)=>{
  const event=[...tournament.events].reverse().find(item=>item.matchId===matchId);
  return event?.at||tournament.schedule.find(item=>item.id===matchId)?.createdAt||'';
};

// Bootstrap routing is a projection only. Match/Tournament repositories remain
// the sole durable sources of truth; resolving a target performs no writes.
export function resolveApplicationResume(storage){
  const matches=createMatchRepository(storage),activeMatch=matches.active();
  if(unfinishedMatch(activeMatch))return {kind:'match',matchId:activeMatch.id};

  const tournaments=createTournamentRepository(storage),document=tournaments.load(),pointer=document.activeWorkSession;
  if(pointer){
    const tournament=tournaments.get(pointer.tournamentId);
    const workSession=tournament?.workSessions.find(item=>item.id===pointer.workSessionId&&item.status==='active');
    if(tournament&&workSession){
      const assignment=tournament.assignments.find(item=>item.id===workSession.assignmentId);
      const scoped=assignment?assignmentMatches(tournament,assignment.id):[];
      const pendingResult=scoped.find(match=>{const session=match.matchSessionId&&matches.get(match.matchSessionId),result=currentResult(tournament,match.id);return session?.status==='finished'&&result?.status!=='CONFIRMED'});
      if(pendingResult)return {kind:'tournament',screen:'result',tournamentId:tournament.id,workSessionId:workSession.id,matchId:pendingResult.id};
      const critical=mandatoryUnfinishedWork(tournament,workSession.id,matches).critical;
      const waiting=critical.find(item=>item.kind==='UNRESOLVED_WAITING');
      if(waiting)return {kind:'tournament',screen:'operations',tournamentId:tournament.id,workSessionId:workSession.id,matchId:waiting.matchId};
      if(critical.some(item=>!['ACTIVE_MATCH','UNCONFIRMED_RESULT','UNRESOLVED_WAITING'].includes(item.kind)))return {kind:'tournament',screen:'shiftAttention',tournamentId:tournament.id,workSessionId:workSession.id,matchId:null};
      const candidates=scoped.filter(match=>!match.matchSessionId);
      candidates.sort((a,b)=>lastOperationalAt(tournament,b.id).localeCompare(lastOperationalAt(tournament,a.id)));
      const preMatch=candidates.find(preMatchStarted);
      if(preMatch)return {kind:'tournament',screen:'prematch',tournamentId:tournament.id,workSessionId:workSession.id,matchId:preMatch.id};
      const operations=candidates.find(operationsStarted);
      if(operations)return {kind:'tournament',screen:'operations',tournamentId:tournament.id,workSessionId:workSession.id,matchId:operations.id};
      return {kind:'tournament',screen:'court',tournamentId:tournament.id,workSessionId:workSession.id,matchId:null};
    }
  }

  // A completed shift does not erase later correction/reporting attention.
  // This remains a pure projection over the current Tournament and Match stores.
  const all=Object.values(document.tournaments).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  for(const tournament of all){
    for(const workSession of [...tournament.workSessions].reverse().filter(item=>item.status==='completed')){
      if(mandatoryUnfinishedWork(tournament,workSession.id,matches).critical.length)return {kind:'tournament',screen:'shiftAttention',tournamentId:tournament.id,workSessionId:workSession.id,matchId:null};
    }
  }

  for(const tournament of all){
    const assignment=tournament.assignments.find(item=>item.status==='assigned');
    if(assignment)return {kind:'tournament',screen:'assignment',tournamentId:tournament.id,workSessionId:null,matchId:null};
  }

  if(matches.load().draft)return {kind:'draft'};
  return {kind:'normal'};
}
