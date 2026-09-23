import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateTournament} from '../src/tournament-domain.js';

const applicationSourceSha='af0c9c5d6169e240a1e401ffe9406066accc681f';
const fixtureVersion='autumn-bidv-2026-v1.0.0';
const createdAt='2026-09-23T12:00:00.000Z';
const tournamentId='tournament:autumn-bidv-tu-liem-open-2026';
const categoryLabels={mens:'Đôi Nam',mixed:'Đôi Nam Nữ'};
const groups=['A','B','C','D'];
const roundRobin=[
  {round:1,pairs:[[1,4],[2,3]]},
  {round:2,pairs:[[1,3],[4,2]]},
  {round:3,pairs:[[1,2],[3,4]]}
];

const roster={
  mens:{
    A:[['Nguyễn Hải Nam','Bùi Thái Anh'],['Trần Lê Huy','Trần Đức Khoa'],['Phạm Quang Hòa','Nguyễn Anh Quân'],['Lục Thế Vinh','Lê Tuấn Anh']],
    B:[['Nguyễn Quang Huy','Nguyễn Tiến Đạt'],['Nguyễn Bình Quý','Nguyễn Văn Toàn'],['Mr Hùng','Mr Hải'],['Mr Tuấn','Mr Kiều Sơn']],
    C:[['Nguyễn Quang Long','Phạm Ngọc Hưng'],['Vũ Văn Khoa','Nguyễn Hoàng Tùng'],['Nguyễn Hữu Bài','Lương Trường Anh'],['Mr Bình','Mr Tuấn']],
    D:[['Hoàng Văn Sơn','Nguyễn Ngọc Lâm'],['Nguyễn Đức Kiên','Nguyễn Đình Thi'],['Mr Nguyễn Sơn','Mr Hạnh'],['Vũ Xuân Tùng','Nguyễn Văn Lương']]
  },
  mixed:{
    A:[['Nguyễn Văn Song','Nguyễn Thị Thu Hằng'],['Nguyễn Công Sơn','Nguyễn Thị Thanh'],['Nguyễn Sơn Dương','Nguyễn Yến Vy'],['Mr Đại','Ms Yến']],
    B:[['Lê Quang Hiếu','Nguyễn Thị Hoài Phương'],['Ngô Minh Thắng','Bùi Thị Thu Hương'],['Tống Thanh Lê','Nguyễn Thị Thu Nga'],['Lê Duy Chính','Trương Thị Thanh Huyền']],
    C:[['Trần Quang Tuấn Đan','Cao Thu Trang'],['Nguyễn Trung Định','Lê Thị Hoàng Anh'],['Phạm Ngọc Minh','Nguyễn Thị Băng An'],['Mr Việt','Ms Mai']],
    D:[['Nguyễn Sỹ Trung Kiên','Nguyễn Thị Bảo Dung'],['Trần Vương Nguyên','Nguyễn Thị Huyền'],['Nguyễn Khắc Việt','Nguyễn Thị Thu Huyền'],['Mr Đức','Ms Chi']]
  }
};

const courtByGroup={
  mixed:{A:'court:1',B:'court:2',C:'court:3',D:'court:4'},
  mens:{A:'court:5',B:'court:6',C:null,D:null}
};

const structure={
  courts:Array.from({length:6},(_,index)=>({id:`court:${index+1}`,label:`Sân ${index+1}`})),
  groups:[],players:[],entries:[],teams:[]
};
const schedule=[];
const assignments=[];
const events=[];

for(const category of ['mens','mixed'])for(const group of groups){
  const groupId=`group:${category}:${group}`;
  structure.groups.push({id:groupId,label:`${categoryLabels[category]} · Bảng ${group}`,categoryId:`category:${category}`,poolCode:group});
  const entries=[];
  roster[category][group].forEach((names,index)=>{
    const slot=index+1;
    const playerIds=names.map((displayName,playerIndex)=>{
      const playerId=`player:${category}:${group.toLowerCase()}${slot}:${playerIndex+1}`;
      structure.players.push({id:playerId,displayName,createdAt,source:{document:'IMG_1433.jpeg',category:categoryLabels[category],group,slot,playerOrder:playerIndex+1}});
      return playerId;
    });
    const entryId=`entry:${category}:${group.toLowerCase()}${slot}`;
    structure.entries.push({id:entryId,type:'double',playerIds,teamId:null,label:`${group}${slot} · ${names.join(' / ')}`,createdAt,categoryId:`category:${category}`,groupId,sourceSlot:`${group}${slot}`});
    entries.push(entryId);
  });
  let matchNumber=0;
  for(const round of roundRobin)for(const [left,right] of round.pairs){
    matchNumber++;
    const entrantA=entries[left-1],entrantB=entries[right-1];
    schedule.push({
      id:`match:${category}:${group.toLowerCase()}:${matchNumber}`,
      label:`${categoryLabels[category]} · Bảng ${group} · Trận ${matchNumber}`,
      groupId,courtId:courtByGroup[category][group],type:'double',entrantIds:{A:entrantA,B:entrantB},
      players:{A:structure.entries.find(item=>item.id===entrantA).playerIds.map(id=>structure.players.find(player=>player.id===id).displayName),B:structure.entries.find(item=>item.id===entrantB).playerIds.map(id=>structure.players.find(player=>player.id===id).displayName)},
      readiness:'unknown',blockedReason:null,matchSessionId:null,operations:null,matchStartSnapshot:null,createdAt,
      categoryId:`category:${category}`,stage:'group',round:round.round,sourceIdentity:{entrantIds:[entrantA,entrantB].sort(),sourceOrder:[entrantA,entrantB],discrepancy:null}
    });
  }
  assignments.push({id:`assignment:${category}:${group.toLowerCase()}`,version:1,label:`${categoryLabels[category]} · Bảng ${group}`,scope:{kind:'group',ids:[groupId]},status:'assigned',createdAt});
}

const ordinaryRules={
  id:'rules:group-stage:v1',label:'Vòng bảng · 1 game chạm 11',authority:'Điều lệ BTC cung cấp cho Product Owner Acceptance',scoring:'side-out',
  format:{sets:1,points:11,rule:'touch'},
  procedures:{equipmentCheck:'unknown',reporting:{match:'optional',group:'optional'},shiftCompletion:{activeMatch:'blocker',unconfirmedResult:'blocker',unresolvedWaiting:'blocker',incompleteGroup:'reminder',requiredReport:'blocker',unresolvedIssue:'blocker',handoverObligation:'reminder',allowHandover:true,requireGroupCompletion:false},timeout:{perGame:1,durationSeconds:60},medical:{durationSeconds:300},noShow:{lateAfterSeconds:900,resolution:'REFEREE_OR_BTC_CONFIRMATION_REQUIRED',autoAdjudicate:false},sideChange:{atPoints:[6]}},
  createdAt
};
const finalRules={
  id:'rules:final:v1',label:'Chung kết · 1 game chạm 15, cách 2, cap 21',authority:'Điều lệ BTC cung cấp cho Product Owner Acceptance',scoring:'side-out',
  format:{sets:1,points:15,rule:'maximum',cap:21},
  procedures:{...ordinaryRules.procedures,sideChange:{atPoints:[8]}},createdAt
};
const rankingRules={
  id:'ranking:group-stage:v1',label:'Vòng bảng · thắng, đối kháng, hiệu số điểm',authority:'Điều lệ BTC cung cấp cho Product Owner Acceptance',
  criteria:[{metric:'matchWins',direction:'desc'},{metric:'headToHead',direction:'desc'},{metric:'pointDifferential',direction:'desc'}],
  qualification:{kind:'top',count:2},points:{win:1,loss:0},createdAt
};

const tournament={
  schemaVersion:2,id:tournamentId,name:'THE AUTUMN – BIDV TỪ LIÊM OPEN 2026',status:'draft',createdAt,updatedAt:createdAt,
  rulesVersions:[ordinaryRules,finalRules],activeRulesVersionId:ordinaryRules.id,
  rankingRulesVersions:[rankingRules],activeRankingRulesVersionId:rankingRules.id,
  resultLedger:{byMatch:{}},groupSnapshots:[],groupCompletions:[],reporting:{match:{},group:{},events:[]},structure,schedule,assignments,workSessions:[],launches:{},operationalIssues:[],handovers:[],shiftCompletions:[],events,
  acceptanceFixture:{
    version:fixtureVersion,applicationSourceSha,eventDate:'2026-09-27',venue:'Sân vận động Quốc Gia Mỹ Đình',
    categories:[{id:'category:mens',label:'Đôi Nam',entryCount:16},{id:'category:mixed',label:'Đôi Nam Nữ',entryCount:16}],
    rules:{groupStageRulesVersionId:ordinaryRules.id,finalRulesVersionId:finalRules.id,rankingRulesVersionId:rankingRules.id},
    knockout:{
      quarterfinals:['1A – 2B','1B – 2A','1C – 2D','1D – 2C'],
      templates:['mens','mixed'].flatMap(category=>[['A',1,'B',2],['B',1,'A',2],['C',1,'D',2],['D',1,'C',2]].map((slot,index)=>({id:`bracket:${category}:qf:${index+1}`,categoryId:`category:${category}`,stage:'quarterfinal',left:{groupId:`group:${category}:${slot[0]}`,rank:slot[1]},right:{groupId:`group:${category}:${slot[2]}`,rank:slot[3]},rulesVersionId:ordinaryRules.id,status:'PENDING_GROUP_RESULTS'}))),
      semifinal:{status:'NEEDS_CONFIRMATION',reason:'Nguồn BTC có mapping bán kết mâu thuẫn; fixture không chọn hoặc sửa bất kỳ phương án nào.'},
      final:{rulesVersionId:finalRules.id,status:'PENDING_BRACKET_CONFIRMATION'}
    },
    sourceReview:{
      documents:['IMG_1432.jpeg','IMG_1433.jpeg'],
      conflicts:[{code:'SEMIFINAL_BRACKET_CONFLICT',status:'NEEDS_CONFIRMATION',detail:'Mapping bán kết từ nguồn BTC mâu thuẫn; không seed cặp bán kết.'}],
      unknowns:[
        {code:'MENS_GROUP_C_COURT',status:'UNKNOWN',detail:'Chưa có phân sân cho Đôi Nam bảng C.'},
        {code:'MENS_GROUP_D_COURT',status:'UNKNOWN',detail:'Chưa có phân sân cho Đôi Nam bảng D.'},
        {code:'POOL_MATCH_SOURCE_SCHEDULE',status:'NEEDS_CONFIRMATION',detail:'Không có lịch match-level BTC trong hai ảnh nguồn khả dụng; 48 trận được sinh theo round robin một lượt từ stable Entry IDs.'},
        {code:'ROSTER_TRANSCRIPTION_REVIEW',status:'NEEDS_CONFIRMATION',detail:'Tên hiển thị được phiên âm từ ảnh danh sách BTC; identity dùng stable Player/Entry IDs và không phụ thuộc display name.'}
      ],
      orderDiscrepancies:[]
    }
  }
};

validateTournament(tournament);
const unordered=new Set();
for(const match of schedule){
  const key=match.sourceIdentity.entrantIds.join('|');
  if(unordered.has(key))throw Error(`Duplicate match identity: ${key}`);
  unordered.add(key);
}
if(structure.players.length!==64||structure.entries.length!==32||structure.groups.length!==8||schedule.length!==48)throw Error('Fixture cardinality mismatch.');
for(const group of structure.groups)if(schedule.filter(match=>match.groupId===group.id).length!==6)throw Error(`Group schedule mismatch: ${group.id}`);

const payload={
  fixtureVersion,applicationSourceSha,generatedAt:createdAt,
  storage:{tournamentKey:'pickleball-referee:tournaments:v1',matchKey:'pickleball-referee:matches:v2',manifestKey:'pickleball-referee:acceptance-fixture:v1'},
  tournamentDocument:{version:2,tournaments:{[tournament.id]:tournament},activeWorkSession:null},
  matchDocument:{version:2,activeId:null,draft:null,matches:{}},
  summary:{players:64,entries:32,groups:8,poolMatches:48,assignments:8,quarterfinalTemplates:8}
};

const here=dirname(fileURLToPath(import.meta.url));
const output=resolve(here,'../public/acceptance/autumn-bidv-2026/fixture.json');
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,`${JSON.stringify(payload,null,2)}\n`,'utf8');
console.log(JSON.stringify({output,fixtureVersion,applicationSourceSha,...payload.summary}));
