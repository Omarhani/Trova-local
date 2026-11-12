package utils;

import static utils.MethodHandlesWeb.test;

    /**
     * One shared script drives every recording player in the report. Extent writes each test's log
     * twice (the hidden list and the visible details view), so a player can't find itself by id: all
     * state lives on the {@code .aqp} element's data attributes, and the handlers are delegated from
     * {@code document}. The script guards itself, so the copy that every attachment carries runs once.
     */
final class ReportPlayerScript {

    private ReportPlayerScript() {
    }

    static final String TEXT = "<script>(function(){if(window.__aqp)return;window.__aqp=1;"
            + "function q(f,c){return f.querySelector(c);}"
            + "function dur(f){return f.dataset.d.split(',');}"
            + "function show(f,k){var n=dur(f).length,i=(k%n+n)%n;f.dataset.i=i;f.dataset.t=Date.now();"
            + "q(f,'.aqp-i').src=f.dataset.base+('00'+i).slice(-3)+'.jpg';q(f,'.aqp-r').value=i;"
            + "q(f,'.aqp-c').textContent=(i+1)+' / '+n;}"
            + "function setOn(f,on){f.dataset.on=on?'1':'0';f.dataset.t=Date.now();"
            + "q(f,'[data-act=play]').innerHTML=on?'&#10074;&#10074;':'&#9654;';}"
            + "function step(f,by){setOn(f,false);show(f,+f.dataset.i+by);}"
            // only playing players that are on screen advance - a hidden test's player waits
            + "setInterval(function(){var now=Date.now();document.querySelectorAll('.aqp').forEach(function(f){"
            + "if(f.dataset.on!=='1'||f.offsetParent===null)return;"
            + "if(now-(+f.dataset.t||0)>=+dur(f)[+f.dataset.i])show(f,+f.dataset.i+1);});},50);"
            + "var st=document.createElement('style');st.textContent="
            + "'.aqp-tabs{display:flex;gap:2px;border-bottom:1px solid rgba(128,128,128,.25);margin:6px 0 14px}"
            + ".aqp-tab{background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;color:inherit;opacity:.6;"
            + "padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px}"
            + ".aqp-tab:hover{opacity:.9}.aqp-tab:focus{outline:none}"
            + ".aqp-tab.on{opacity:1;color:#4f8cff;border-bottom-color:#4f8cff}"
            + ".aqp-n{min-width:18px;padding:0 6px;border-radius:9px;background:rgba(79,140,255,.16);color:#4f8cff;font-size:11px;line-height:18px;text-align:center}"
            + ".aqp-media{display:flex;flex-wrap:wrap;gap:16px;align-items:stretch}"
            + ".aqp-card{flex:1 1 360px;min-width:0;margin:0;padding:12px;border-radius:8px;"
            + "background:rgba(128,128,128,.07);border:1px solid rgba(128,128,128,.2)}"
            + ".aqp-card-h{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:11px;font-weight:700;"
            + "letter-spacing:.06em;text-transform:uppercase;opacity:.85}"
            + ".aqp-card-h small{margin-left:auto;font-weight:500;letter-spacing:0;text-transform:none;opacity:.7}"
            + ".aqp-dot{width:8px;height:8px;border-radius:50%;background:#4f8cff}.aqp-dot.rec{background:#ff2d55}"
            + ".aqp-ov .aqp-card{flex:none;background:none;border:0;padding:0}"
            // phone screens are tall: cap their height in the report (full screen is not inside .aqp-portrait)
            + ".aqp-portrait .aqp-i,.aqp-portrait .aqp-png{width:auto!important;max-width:100%;max-height:640px;margin:0 auto}"
            // full screen: the picture never pushes the control bar off the screen
            + ".aqp-ov .aqp-i{max-height:calc(100vh - 120px);object-fit:contain;background:#000}';"
            + "document.head.appendChild(st);"
            // Tabs: each media row leaves the log table for the panel of its tab - Timeline (data-tab="tl") or
            // Attachments (the default) - next to a Steps tab that shows the table. Tab bar, table and panels stay
            // adjacent siblings, so a redraw that copies the html keeps working.
            // Re-checked on the timer, because Extent redraws the details view (test click, Esc)
            + "function panels(table){var a=[],p=table.nextElementSibling;while(p&&p.classList.contains('aqp-panel')){a.push(p);p=p.nextElementSibling;}return a;}"
            + "function setTab(bar,t){var table=bar.nextElementSibling;if(!table)return;var ps=panels(table);if(!ps.length)return;"
            // an entry without the remembered tab (an API test has no Timeline) shows Steps
            + "if(t!=='steps'&&!ps.some(function(p){return p.dataset.tab===t;}))t='steps';"
            + "table.style.display=t==='steps'?'':'none';ps.forEach(function(p){p.style.display=p.dataset.tab===t?'':'none';});"
            + "bar.querySelectorAll('.aqp-tab').forEach(function(b){b.classList.toggle('on',b.dataset.tab===t);});}"
            + "function build(){document.querySelectorAll('.aqp-media').forEach(function(m){"
            + "if(m.dataset.built)return;var tr=m.closest('tr'),table=m.closest('table');if(!tr||!table)return;m.dataset.built='1';"
            + "var tab=m.dataset.tab||'att',bar=table.previousElementSibling;"
            + "if(!bar||!bar.classList.contains('aqp-tabs')){bar=document.createElement('div');bar.className='aqp-tabs';"
            + "bar.innerHTML='<button type=\"button\" class=\"aqp-tab\" data-tab=\"steps\">Steps</button>';table.parentNode.insertBefore(bar,table);}"
            // a second attachment row (e.g. the registration email next to the screenshot) joins the same panel
            + "var ps=panels(table),panel=ps.filter(function(p){return p.dataset.tab===tab;})[0];"
            + "if(!panel){panel=document.createElement('div');panel.className='aqp-panel';panel.dataset.tab=tab;"
            + "var last=ps.length?ps[ps.length-1]:table;last.parentNode.insertBefore(panel,last.nextSibling);"
            + "var b=document.createElement('button');b.type='button';b.className='aqp-tab';b.dataset.tab=tab;"
            + "b.innerHTML=(tab==='tl'?'Timeline':'Attachments')+'<span class=\"aqp-n\"></span>';"
            // Timeline comes right after Steps
            + "if(tab==='tl')bar.insertBefore(b,bar.children[1]||null);else bar.appendChild(b);}"
            + "panel.appendChild(m);tr.style.display='none';"
            + "var nb=bar.querySelector('.aqp-tab[data-tab=\"'+tab+'\"] .aqp-n');"
            + "if(nb)nb.textContent=tab==='tl'?(m.dataset.n||''):panel.querySelectorAll('.aqp-card').length;"
            + "setTab(bar,window.__aqpTab||'steps');});}"
            + "build();setInterval(build,300);"
            // full screen: an overlay on <body> - a copy of the player, or the screenshot; closing hands the frame back
            + "var ov=null,orig=null;"
            + "function overlay(){closeFull();ov=document.createElement('div');ov.className='aqp-ov';"
            + "ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,.92);"
            + "display:flex;align-items:center;justify-content:center;color:#fff';document.body.appendChild(ov);return ov;}"
            + "function openFull(f){var i=+f.dataset.i,on=f.dataset.on==='1';setOn(f,false);"
            + "var img=q(f,'.aqp-i'),r=(img.naturalWidth/img.naturalHeight)||(16/9),c=f.cloneNode(true);"
            + "c.classList.add('aqp-big');c.style.cssText='flex:none;margin:0;outline:none;width:'+Math.min(innerWidth*.96,(innerHeight-120)*r)+'px';"
            + "q(c,'.aqp-i').style.cursor='pointer';var x=q(c,'[data-act=full]');x.dataset.act='close';x.title='Close (Esc)';x.innerHTML='&#10005;';"
            + "overlay().appendChild(c);orig=f;show(c,i);setOn(c,on);c.focus({preventScroll:true});}"
            // width / height auto + contain: Extent's own img styles stretched a phone screenshot to the window's width
            + "function openPng(src){var o=overlay();"
            + "o.innerHTML='<img src=\"'+src+'\" style=\"width:auto!important;height:auto!important;max-width:96vw;max-height:94vh;"
            + "object-fit:contain;display:block;border-radius:4px\">'"
            + "+'<button type=\"button\" data-act=\"close\" title=\"Close (Esc)\" style=\"position:absolute;top:14px;right:18px;"
            + "background:#374151;color:#fff;border:0;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:16px\">&#10005;</button>';}"
            + "function closeFull(){if(!ov)return;var c=q(ov,'.aqp');ov.remove();ov=null;"
            + "if(c&&orig){show(orig,+c.dataset.i);setOn(orig,c.dataset.on==='1');}orig=null;}"
            + "document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;"
            + "if(ov&&t===ov){closeFull();return;}"
            // the chosen tab is remembered, so moving to another test opens the same tab
            + "var tb=t.closest('.aqp-tab');if(tb){window.__aqpTab=tb.dataset.tab;"
            + "document.querySelectorAll('.aqp-tabs').forEach(function(x){setTab(x,tb.dataset.tab);});return;}"
            + "var pg=t.closest('.aqp-png');if(pg){openPng(pg.getAttribute('src'));return;}"
            + "var b=t.closest('.aqp [data-act], .aqp-ov [data-act]'),im=t.closest('.aqp .aqp-i');"
            // the small picture opens full screen; the big one toggles play / pause like a video
            + "if(im){var g=im.closest('.aqp');if(g.classList.contains('aqp-big'))setOn(g,g.dataset.on!=='1');else openFull(g);return;}"
            + "if(!b)return;var a=b.dataset.act;if(a==='close'){closeFull();return;}var f=b.closest('.aqp');"
            + "if(a==='play')setOn(f,f.dataset.on!=='1');else if(a==='full')openFull(f);"
            + "else step(f,a==='back'?-1:1);});"
            + "document.addEventListener('input',function(e){if(!e.target.classList.contains('aqp-r'))return;"
            + "var f=e.target.closest('.aqp');setOn(f,false);show(f,+e.target.value);});"
            + "document.addEventListener('mouseover',function(e){var f=e.target.closest&&e.target.closest('.aqp');"
            + "if(f&&!f.contains(document.activeElement))f.focus({preventScroll:true});});"
            // Esc for full screen is caught first (capture on window): Extent's own Esc redraws the details view
            + "window.addEventListener('keydown',function(e){if(e.key==='Escape'&&ov){e.preventDefault();e.stopImmediatePropagation();closeFull();}},true);"
            + "document.addEventListener('keydown',function(e){"
            + "var a=document.activeElement,f=a&&a.closest&&a.closest('.aqp');"
            + "if(!f||a.classList.contains('aqp-r'))return;"
            + "if(e.key===' '){e.preventDefault();setOn(f,f.dataset.on!=='1');}"
            + "else if(e.key==='ArrowLeft'){e.preventDefault();step(f,-1);}"
            + "else if(e.key==='ArrowRight'){e.preventDefault();step(f,1);}});"
            + TestTimeline.SCRIPT
            + "})();</script>";
}
