from pathlib import Path
p=Path("index.html")
s=p.read_text()
# Remove every prior Page 05 extension after the approved base app.
base_end=s.find("</body></html>")
if base_end<0: raise SystemExit("base app end not found")
s=s[:base_end+14]
css=r'''<style>
/* PAGE05_RULES_2026_REBUILD */
.p5r{position:fixed;inset:0;z-index:90;background:#0b1f3a;padding:calc(10px + env(safe-area-inset-top)) 16px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;color:#101828}
.p5rh{height:62px;display:grid;grid-template-columns:38px 1fr 38px;align-items:center;color:#fff}.p5rh button{border:0;background:none;color:#fff;font-size:32px}.p5rh div{text-align:center}.p5rh h2{margin:0;font-size:20px}.p5rh p{margin:2px 0 0;font-size:10px;color:#b8c6d9}
.p5rb{flex:1;min-height:0;overflow:auto;background:#f5f7fa;border-radius:20px;padding:14px}.p5teams{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.p5team{background:#fff;border:1px solid #e4e7ec;border-radius:14px;padding:12px}.p5team b{display:block;color:#155eef;font-size:14px;margin-bottom:6px}.p5team strong{display:block;font-size:15px;line-height:21px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p5card{background:#fff;border-radius:16px;padding:15px;margin-top:10px}.p5card h3{margin:0 0 5px;font-size:17px}.p5card p{margin:0 0 12px;color:#667085;font-size:11px;line-height:1.45}.p5grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.p5btn{min-height:52px;border:1px solid #e1e6ee;border-radius:11px;background:#f8fafc;color:#344054;font-weight:800}.p5btn.on{border:2px solid #155eef;background:#eef4ff;color:#155eef}.p5primary{width:100%;height:52px;margin-top:12px;border:0;border-radius:12px;background:#155eef;color:#fff;font-size:15px;font-weight:850}.p5primary:disabled{background:#cbd5e1}.p5result{padding:11px;border-radius:11px;background:#eef4ff;color:#1849a9;text-align:center;font-weight:850;margin:10px 0}
.coinStage{height:132px;display:grid;place-items:center;perspective:700px}.coin{width:88px;height:88px;border-radius:50%;position:relative;display:grid;place-items:center;background:radial-gradient(circle at 32% 25%,#fff 0 5%,#f0f1f2 12%,#c9cdd1 52%,#8e949a 78%,#dfe2e5 100%);border:4px solid #8b9197;box-shadow:inset 0 0 0 3px #e9ebed,inset 0 0 0 7px #aeb3b8,0 8px 16px #10182828;color:#555b61;font-size:13px;font-weight:950;text-shadow:0 1px #fff}.coin:after{content:"";position:absolute;inset:14px;border:2px dashed #8d9399;border-radius:50%}.coin.flip{animation:coinflip .85s ease-out}@keyframes coinflip{0%{transform:rotateY(0) translateY(0)}45%{transform:rotateY(900deg) translateY(-32px) rotateX(18deg)}100%{transform:rotateY(1800deg) translateY(0)}}.coin span{z-index:2}
.p5court{position:relative;width:100%;aspect-ratio:2.2/1;margin:10px 0;background:#159297;border:3px solid #f3ffff;border-radius:10px;overflow:hidden}.p5net{position:absolute;left:50%;top:0;bottom:0;width:4px;background:#071725;transform:translateX(-50%)}.p5nv{position:absolute;top:0;bottom:0;width:15.91%;background:#0d737777}.p5nv.l{right:50%;border-left:2px solid white}.p5nv.r{left:50%;border-right:2px solid white}.p5mid{position:absolute;top:50%;height:2px;width:34.09%;background:white}.p5mid.l{left:0}.p5mid.r{right:0}.p5player{position:absolute;transform:translate(-50%,-50%);min-width:76px;max-width:105px;padding:6px;border-radius:9px;background:#fff;text-align:center;font-size:10px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.p5player.server{background:#155eef;color:#fff}.p5player.receiver{outline:3px solid #fdb022}.p5legend{display:flex;justify-content:center;gap:12px;color:#667085;font-size:10px}.p5dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}.p5dot.s{background:#155eef}.p5dot.r{background:#fdb022}
</style>'''
s=s.replace("</head>",css+"</head>",1)
js=r'''<script>
(function(){
var app=document.getElementById('app'),saved='',step='method',picked='',face='',winner='',chooser='',serveTeam='',endTeam='',endSide='left',order={A:[0,1],B:[0,1]},deferredBy='';
function esc(x){return String(x||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function P(){var d=document.createElement('div');d.innerHTML=saved;function v(id,f){var e=d.querySelector('#'+id);return esc(e&&e.value?e.value:f)}return{A:[v('a1','VĐV A1'),v('a2','VĐV A2')],B:[v('b1','VĐV B1'),v('b2','VĐV B2')]}}
function other(t){return t==='A'?'B':'A'}
function teams(){var p=P();return '<div class="p5teams"><div class="p5team"><b>ĐỘI A</b><strong>'+p.A[0]+'</strong><strong>'+p.A[1]+'</strong></div><div class="p5team"><b>ĐỘI B</b><strong>'+p.B[0]+'</strong><strong>'+p.B[1]+'</strong></div></div>'}
function shell(body){app.innerHTML='<main class="p5r"><header class="p5rh"><button data-r5="back">‹</button><div><h2>Chuẩn bị trận</h2><p>Theo luật USA Pickleball 2026</p></div><span></span></header><div class="p5rb">'+teams()+body+'</div></main>'}
function choices(team,canDefer){return '<section class="p5card"><h3>Đội '+team+' chọn quyền</h3><p>Chọn một quyền theo thủ tục trước trận.</p><div class="p5grid"><button class="p5btn" data-r5="serve">Giao bóng</button><button class="p5btn" data-r5="receive">Nhận bóng</button><button class="p5btn" data-r5="end">Chọn bên sân</button>'+(canDefer?'<button class="p5btn" data-r5="defer">Nhường quyền chọn</button>':'')+'</div></section>'}
function draw(){
 if(step==='method')return shell('<section class="p5card"><h3>Xác định quyền trước trận</h3><p>Luật 17.C.4 yêu cầu một phương pháp công bằng. Có thể dùng tung đồng xu hoặc xác nhận kết quả đã được xác định bằng phương pháp công bằng khác.</p><div class="p5grid"><button class="p5btn" data-r5="toss">Tung đồng xu</button><button class="p5btn" data-r5="known">Đã xác định</button></div></section>');
 if(step==='pick')return shell('<section class="p5card"><h3>Tung đồng xu</h3><p>Chọn đội gọi mặt đồng xu.</p><div class="coinStage"><div class="coin"><span>SẤP / NGỬA</span></div></div><div class="p5grid"><button class="p5btn '+(picked==='A'?'on':'')+'" data-r5="pickA">Đội A gọi NGỬA</button><button class="p5btn '+(picked==='B'?'on':'')+'" data-r5="pickB">Đội B gọi NGỬA</button></div><button class="p5primary" data-r5="flip" '+(!picked?'disabled':'')+'>Tung đồng xu</button></section>');
 if(step==='result')return shell('<section class="p5card"><h3>Kết quả</h3><div class="coinStage"><div class="coin flip"><span>'+face+'</span></div></div><div class="p5result">Đội '+winner+' thắng quyền chọn đầu tiên</div></section>'+choices(winner,true));
 if(step==='known')return shell('<section class="p5card"><h3>Đội có quyền chọn đầu tiên</h3><p>Xác nhận kết quả của phương pháp công bằng đã thực hiện.</p><div class="p5grid"><button class="p5btn" data-r5="knownA">Đội A</button><button class="p5btn" data-r5="knownB">Đội B</button></div></section>');
 if(step==='deferred')return shell('<div class="p5result">Đội '+deferredBy+' nhường quyền chọn</div>'+choices(chooser,false));
 if(step==='secondService')return shell('<div class="p5result">Đội '+endTeam+' chọn bên sân</div><section class="p5card"><h3>Đội '+chooser+' chọn giao hay nhận</h3><p>Quyền chọn bên sân đã thuộc Đội '+endTeam+'.</p><div class="p5grid"><button class="p5btn" data-r5="serve">Giao bóng</button><button class="p5btn" data-r5="receive">Nhận bóng</button></div></section>');
 if(step==='end')return shell('<div class="p5result">Đội '+serveTeam+' giao bóng đầu tiên · Đội '+endTeam+' chọn bên sân</div><section class="p5card"><h3>Đội '+endTeam+' chọn bên sân</h3><p>Theo góc nhìn của trọng tài.</p><div class="p5grid"><button class="p5btn '+(endSide==='left'?'on':'')+'" data-r5="left">Bên trái</button><button class="p5btn '+(endSide==='right'?'on':'')+'" data-r5="right">Bên phải</button></div><button class="p5primary" data-r5="positions">Tiếp tục</button></section>');
 if(step==='positions')return positions();
}
function resolveChoice(kind){
 var t=chooser;
 if(kind==='defer'){deferredBy=t;chooser=other(t);step='deferred';return draw()}
 if(kind==='serve'||kind==='receive'){
   serveTeam=kind==='serve'?t:other(t);
   endTeam=other(t);
   step='end';return draw()
 }
 if(kind==='end'){endTeam=t;chooser=other(t);step='secondService';return draw()}
}
function positions(){
 var p=P(),leftTeam=endSide==='left'?endTeam:other(endTeam),rightTeam=other(leftTeam);
 // At 0-0, the starting server and starting receiver are the players in each team's right/even court (Rule 5.B.3).
 // Facing the net: left-end team's right court is bottom; right-end team's right court is top.
 var serverSlot=serveTeam===leftTeam?1:0,recvTeam=other(serveTeam),recvSlot=recvTeam===leftTeam?1:0;
 function n(t,slot){return p[t][order[t][slot]]}
 function pos(t,slot){var l=t===leftTeam;return 'left:'+(l?'16':'84')+'%;top:'+(slot===0?'28':'72')+'%'}
 function cls(t,slot){return t===serveTeam&&slot===serverSlot?' server':(t===recvTeam&&slot===recvSlot?' receiver':'')}
 var court='<div class="p5court"><div class="p5nv l"></div><div class="p5nv r"></div><div class="p5mid l"></div><div class="p5mid r"></div><div class="p5net"></div>'+['A','B'].map(function(t){return [0,1].map(function(k){return '<div class="p5player'+cls(t,k)+'" style="'+pos(t,k)+'">'+n(t,k)+'</div>'}).join('')}).join('')+'</div>';
 return shell('<div class="p5result">Đội '+serveTeam+' giao trước · 0–0–2</div><section class="p5card"><h3>Xếp vị trí VĐV</h3><p>Đặt hai VĐV của mỗi đội đúng vị trí thực tế. App tự xác định người giao và người đỡ theo vị trí đúng luật; không có bước chọn người giao.</p>'+court+'<div class="p5legend"><span><i class="p5dot s"></i>Giao bóng</span><span><i class="p5dot r"></i>Đỡ bóng</span></div><div class="p5grid" style="margin-top:12px"><button class="p5btn" data-r5="swapA">⇅ Đổi VĐV Đội A</button><button class="p5btn" data-r5="swapB">⇅ Đổi VĐV Đội B</button></div></section><section class="p5card"><h3>Tự động theo luật</h3><p><b>'+n(serveTeam,serverSlot)+'</b> giao từ ô phải/even. <b>'+n(recvTeam,recvSlot)+'</b> đỡ ở ô phải/even của đội nhận, là ô chéo đối diện đường giao bóng.</p></section><button class="p5primary" data-r5="ready">Sẵn sàng bắt đầu</button>');
}
document.addEventListener('click',function(e){var b=e.target.closest('[data-r5]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();var a=b.dataset.r5;
 if(a==='back'){app.innerHTML=saved;return}
 if(a==='toss'){step='pick';return draw()} if(a==='known'){step='known';return draw()}
 if(a==='pickA'||a==='pickB'){picked=a.slice(-1);return draw()}
 if(a==='flip'){face=Math.random()<.5?'NGỬA':'SẤP';winner=face==='NGỬA'?picked:other(picked);chooser=winner;step='result';return draw()}
 if(a==='knownA'||a==='knownB'){winner=a.slice(-1);chooser=winner;step='result';face='ĐÃ XÁC ĐỊNH';return draw()}
 if(['serve','receive','end','defer'].includes(a))return resolveChoice(a)
 if(a==='left'||a==='right'){endSide=a;return draw()} if(a==='positions'){step='positions';return draw()}
 if(a==='swapA'||a==='swapB'){order[a.slice(-1)].reverse();return draw()}
 if(a==='ready'){var x=app.querySelector('.p5card:last-of-type p');if(x)x.innerHTML='Thiết lập hợp lệ. Người giao và người đỡ đã được xác định tự động theo vị trí.';return}
},true);
document.addEventListener('click',function(e){var b=e.target.closest('[data-a="saveInfo"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();Array.from(app.querySelectorAll('[data-player]')).forEach(function(x){x.setAttribute('value',x.value)});saved=app.innerHTML;step='method';picked='';face='';winner='';chooser='';serveTeam='';endTeam='';endSide='left';order={A:[0,1],B:[0,1]};deferredBy='';draw()},true);
})();
</script>'''
p.write_text(s+js)
