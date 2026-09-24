// @ts-check
export const TODAY_TIME_ZONE='Asia/Ho_Chi_Minh';

const clone=value=>structuredClone(value);
const timestamp=value=>value?Date.parse(value):NaN;
const newest=(a,b)=>(timestamp(b)-timestamp(a));

function dayKey(value,timeZone=TODAY_TIME_ZONE){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const read=type=>parts.find(part=>part.type===type)?.value;
  return `${read('year')}-${read('month')}-${read('day')}`;
}

const planFor=(tournament,assignment)=>{
  const source=assignment?.workPlan||tournament?.workPlan||{};
  return {
    startsAt:source.startsAt||assignment?.startsAt||tournament?.startsAt||tournament?.scheduledAt||null,
    endsAt:source.endsAt||assignment?.endsAt||tournament?.endsAt||null,
    location:source.location||tournament?.location||null,
    city:source.city||tournament?.city||null
  };
};

const resourceLabel=(items,id,fallback)=>items?.find(item=>item.id===id)?.label||fallback;
const matchSession=(matchDocument,scheduled)=>scheduled?.matchSessionId?matchDocument.matches?.[scheduled.matchSessionId]||null:null;
const isFinished=(matchDocument,scheduled)=>matchSession(matchDocument,scheduled)?.status==='finished';

function matchCard(tournament,scheduled,matchDocument){
  if(!scheduled)return null;
  const session=matchSession(matchDocument,scheduled);
  const people=scheduled.players||session?.players||session?.config?.players||{A:[],B:[]};
  return {
    id:scheduled.id,
    sessionId:scheduled.matchSessionId||null,
    label:scheduled.label||'Trận đấu',
    type:scheduled.type,
    court:resourceLabel(tournament.structure?.courts,scheduled.courtId,'Chưa xác định sân'),
    group:resourceLabel(tournament.structure?.groups,scheduled.groupId,'Chưa xác định bảng'),
    players:clone(people),
    readiness:scheduled.readiness,
    operations:clone(scheduled.operations),
    progress:session?.status||'not_started',
    createdAt:scheduled.createdAt||null
  };
}

function workContext(tournament,assignment,workSession=null){
  return {
    tournamentId:tournament.id,
    tournamentName:tournament.name,
    assignmentId:assignment?.id||null,
    assignmentLabel:assignment?.label||null,
    workSessionId:workSession?.id||null,
    plan:planFor(tournament,assignment)
  };
}

function scopedProgress(tournament,assignment,matchDocument){
  const scope=assignment?.scope;
  const scoped=!scope?[]:(tournament.schedule||[]).filter(match=>scope.kind==='match'?scope.ids.includes(match.id):scope.kind==='court'?scope.ids.includes(match.courtId):scope.ids.includes(match.groupId));
  const finished=scoped.filter(match=>isFinished(matchDocument,match));
  return {total:scoped.length,finished:finished.length,percent:scoped.length?Math.round(finished.length/scoped.length*100):0,scoped};
}

function activeMatchProjection(matchDocument,tournamentDocument){
  const active=matchDocument.activeId&&matchDocument.matches?.[matchDocument.activeId];
  if(!active||active.status==='finished')return null;
  const context=active.tournamentContext;
  const tournament=context&&tournamentDocument.tournaments?.[context.tournamentId];
  const scheduled=tournament?.schedule?.find(item=>item.id===context.scheduledMatchId);
  const pointer=tournamentDocument.activeWorkSession;
  const workSession=tournament?.workSessions?.find(item=>item.id===(pointer?.tournamentId===tournament?.id?pointer.workSessionId:null));
  const assignment=tournament?.assignments?.find(item=>item.id===workSession?.assignmentId);
  const progress=tournament&&assignment?scopedProgress(tournament,assignment,matchDocument):{total:1,finished:0,percent:0,scoped:[]};
  const next=tournament&&assignment?progress.scoped.find(item=>item.id!==scheduled?.id&&!isFinished(matchDocument,item)):null;
  return {
    kind:'active-match',statusLabel:'ĐANG ĐIỀU HÀNH',
    activeMatch:{id:active.id,label:scheduled?.label||active.config?.note||'Trận đang diễn ra',game:active.game,points:clone(active.currentGamePoints),gamesWon:clone(active.gamesWon),players:clone(active.players||active.config?.players||{A:[],B:[]}),court:tournament?resourceLabel(tournament.structure?.courts,scheduled?.courtId,'Chưa xác định sân'):null,group:tournament?resourceLabel(tournament.structure?.groups,scheduled?.groupId,'Chưa xác định bảng'):null},
    work:tournament?workContext(tournament,assignment,workSession):null,
    progress:{total:progress.total,finished:progress.finished,percent:progress.percent},
    nextMatch:tournament?matchCard(tournament,next,matchDocument):null
  };
}

export function resolveTodayProjection({matchDocument,tournamentDocument,now=new Date(),timeZone=TODAY_TIME_ZONE}){
  const active=activeMatchProjection(matchDocument,tournamentDocument);
  if(active)return active;
  const today=dayKey(now,timeZone);
  const tournaments=Object.values(tournamentDocument.tournaments||{});
  const pointer=tournamentDocument.activeWorkSession;
  if(pointer){
    const tournament=tournamentDocument.tournaments?.[pointer.tournamentId];
    const workSession=tournament?.workSessions?.find(item=>item.id===pointer.workSessionId&&item.status==='active');
    const assignment=tournament?.assignments?.find(item=>item.id===workSession?.assignmentId);
    if(tournament&&workSession&&assignment){
      const progress=scopedProgress(tournament,assignment,matchDocument);
      const pending=progress.scoped.filter(item=>!isFinished(matchDocument,item));
      const next=pending[0]||null;
      return {kind:next?'working':'waiting',statusLabel:next?'ĐANG LÀM VIỆC':'CHỜ TRẬN',work:workContext(tournament,assignment,workSession),progress:{total:progress.total,finished:progress.finished,percent:progress.percent},nextMatch:matchCard(tournament,next,matchDocument),upcomingMatches:pending.slice(0,3).map(item=>matchCard(tournament,item,matchDocument))};
    }
  }
  const completed=[];
  const planned=[];
  for(const tournament of tournaments){
    for(const assignment of tournament.assignments||[]){const plan=planFor(tournament,assignment);if(assignment.status==='assigned'&&plan.startsAt)planned.push({tournament,assignment,plan})}
    for(const workSession of tournament.workSessions||[]){
      if(workSession.status!=='completed'||dayKey(workSession.endedAt,timeZone)!==today)continue;
      const assignment=tournament.assignments?.find(item=>item.id===workSession.assignmentId);if(assignment)completed.push({tournament,assignment,workSession});
    }
  }
  if(completed.length){
    completed.sort((a,b)=>newest(a.workSession.endedAt,b.workSession.endedAt));
    const {tournament,assignment,workSession}=completed[0],progress=scopedProgress(tournament,assignment,matchDocument);
    const durationMinutes=Math.max(0,Math.round((timestamp(workSession.endedAt)-timestamp(workSession.startedAt))/60000));
    return {kind:'completed',statusLabel:'HOÀN THÀNH HÔM NAY',work:workContext(tournament,assignment,workSession),summary:{matches:progress.finished,durationMinutes}};
  }
  planned.sort((a,b)=>timestamp(a.plan.startsAt)-timestamp(b.plan.startsAt));
  const todayWork=planned.find(item=>dayKey(item.plan.startsAt,timeZone)===today);
  if(todayWork){
    const progress=scopedProgress(todayWork.tournament,todayWork.assignment,matchDocument);
    return {kind:'work-today',statusLabel:'CÓ VIỆC HÔM NAY',work:workContext(todayWork.tournament,todayWork.assignment),readiness:{accepted:true,hasTournamentInfo:Boolean(todayWork.tournament.name),hasSchedule:progress.total>0,ready:Boolean(todayWork.plan.startsAt)},progress:{total:progress.total,finished:progress.finished,percent:progress.percent}};
  }
  const upcoming=planned.filter(item=>timestamp(item.plan.startsAt)>now.getTime()).slice(0,3).map(item=>workContext(item.tournament,item.assignment));
  return {kind:'no-work',statusLabel:'KHÔNG CÓ VIỆC HÔM NAY',upcoming};
}

export function resolveTodayFromStorage(storage,now=new Date(),timeZone=TODAY_TIME_ZONE){
  const parse=(key,fallback)=>{const value=storage.getItem(key);if(value===null)return fallback;return JSON.parse(value)};
  return resolveTodayProjection({matchDocument:parse('pickleball-referee:matches:v2',{version:2,activeId:null,draft:null,matches:{}}),tournamentDocument:parse('pickleball-referee:tournaments:v1',{version:2,tournaments:{},activeWorkSession:null}),now,timeZone});
}
