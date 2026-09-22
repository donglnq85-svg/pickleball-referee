import {createMatchRepository} from './match-persistence.js';
import {createTournamentRepository} from './tournament-persistence.js';
import {assignmentMatches} from './tournament-domain.js';

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

  const tournaments=createTournamentRepository(storage),pointer=tournaments.load().activeWorkSession;
  if(pointer){
    const tournament=tournaments.get(pointer.tournamentId);
    const workSession=tournament?.workSessions.find(item=>item.id===pointer.workSessionId&&item.status==='active');
    if(tournament&&workSession){
      const assignment=tournament.assignments.find(item=>item.id===workSession.assignmentId);
      const candidates=assignment?assignmentMatches(tournament,assignment.id).filter(match=>!match.matchSessionId):[];
      candidates.sort((a,b)=>lastOperationalAt(tournament,b.id).localeCompare(lastOperationalAt(tournament,a.id)));
      const preMatch=candidates.find(preMatchStarted);
      if(preMatch)return {kind:'tournament',screen:'prematch',tournamentId:tournament.id,workSessionId:workSession.id,matchId:preMatch.id};
      const operations=candidates.find(operationsStarted);
      if(operations)return {kind:'tournament',screen:'operations',tournamentId:tournament.id,workSessionId:workSession.id,matchId:operations.id};
      return {kind:'tournament',screen:'court',tournamentId:tournament.id,workSessionId:workSession.id,matchId:null};
    }
  }

  if(matches.load().draft)return {kind:'draft'};
  return {kind:'normal'};
}
