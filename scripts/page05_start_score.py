from pathlib import Path
p=Path("index.html")
s=p.read_text()
needle="function draw(){"
insert="""function startScore(){var d=document.createElement('div');d.innerHTML=saved;var oa=d.querySelector('[aria-label="Điểm bắt đầu Đội A"]'),ob=d.querySelector('[aria-label="Điểm bắt đầu Đội B"]'),a=oa?oa.textContent.trim():'0',b=ob?ob.textContent.trim():'0';return (a!=='0'||b!=='0')?'<div class="p5result">Điểm bắt đầu · Đội A '+a+' – '+b+' Đội B</div>':''}
function draw(){"""
if needle not in s: raise SystemExit("draw anchor missing")
s=s.replace(needle,insert,1)
old="""if(step==='method')return shell('<section class="p5card"><h3>Xác định quyền trước trận</h3>"""
new="""if(step==='method')return shell(startScore()+'<section class="p5card"><h3>Xác định quyền trước trận</h3>"""
if old not in s: raise SystemExit("method anchor missing")
s=s.replace(old,new,1)
p.write_text(s)
