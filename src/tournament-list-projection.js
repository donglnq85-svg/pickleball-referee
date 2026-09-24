// Calendar grouping is distinct from a referee starting a Work Session early.
export function tournamentListState(t,now=new Date()){
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(now);
  const start=String(t.startsAt||'').slice(0,10),end=String(t.endsAt||t.startsAt||'').slice(0,10);
  if(t.status==='completed')return 'done';
  if(/^\d{4}-\d{2}-\d{2}$/.test(start)){
    if(day<start)return 'upcoming';
    if(end&&day>end)return 'done';
    return 'live';
  }
  return t.status==='active'?'live':'upcoming';
}

export function tournamentWorkBadge(t,state){
  if(state==='done')return {label:'Đã kết thúc',tone:'done'};
  if(state==='live')return {label:'Đang diễn ra',tone:'live'};
  const scheduled=(t.assignments||[]).some(a=>a.status!=='cancelled');
  return {label:scheduled?'Đã có lịch làm việc':'Chưa có lịch làm việc',tone:scheduled?'live':'waiting'};
}
