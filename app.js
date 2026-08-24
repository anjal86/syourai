const slides=[...document.querySelectorAll('.slide')];
const dots=document.getElementById('dots');
let current=0;

slides.forEach((_,i)=>{
  const b=document.createElement('button');
  b.className='dot'+(!i?' active':'');
  b.setAttribute('aria-label',`Go to slide ${i+1}`);
  b.onclick=()=>go(i);
  dots.appendChild(b);
});

function go(n){
  n=(n+slides.length)%slides.length;
  slides.forEach((slide,i)=>{
    slide.classList.remove('active','prev','export-slide');
    if(i===n) slide.classList.add('active');
    else if(i<n) slide.classList.add('prev');
  });
  [...dots.children].forEach((dot,i)=>dot.classList.toggle('active',i===n));
  current=n;
  location.hash=n+1;
}

prev.onclick=()=>go(current-1);
next.onclick=()=>go(current+1);
addEventListener('keydown',e=>{
  if(['ArrowRight','PageDown',' '].includes(e.key)) go(current+1);
  if(['ArrowLeft','PageUp'].includes(e.key)) go(current-1);
});

go(Math.max(0,Math.min(slides.length-1,(parseInt(location.hash.slice(1))||1)-1)));

/* Direct PDF download ---------------------------------------------------- */
const pdfStyle=document.createElement('style');
pdfStyle.textContent=`
  .pdf-download{
    position:fixed;right:22px;top:22px;z-index:120;border:1px solid rgba(255,255,255,.18);
    background:rgba(9,25,40,.92);color:#fff;border-radius:999px;padding:11px 16px;
    font:800 12px/1 Inter,"Noto Sans JP",Arial,sans-serif;letter-spacing:.02em;
    box-shadow:0 10px 30px rgba(0,0,0,.24);backdrop-filter:blur(12px);cursor:pointer;
    display:flex;align-items:center;gap:8px;transition:.2s ease;
  }
  .pdf-download:hover{transform:translateY(-1px);background:#123a5b}
  .pdf-download:disabled{cursor:wait;opacity:.76;transform:none}
  .pdf-download .pdf-icon{font-size:15px;line-height:1}
  .pdf-download .pdf-progress{font-variant-numeric:tabular-nums;color:#c9d7e2;font-size:10px}
  body.pdf-exporting .slide{transition:none!important}
  body.pdf-exporting .slide:not(.export-slide){opacity:0!important;pointer-events:none!important}
  body.pdf-exporting .slide.export-slide{opacity:1!important;transform:none!important;pointer-events:auto!important;z-index:999!important}
  body.pdf-exporting .controls,body.pdf-exporting .hint,body.pdf-exporting .pdf-download{visibility:hidden!important}
  @media print{.pdf-download{display:none!important}}
`;
document.head.appendChild(pdfStyle);

const pdfButton=document.createElement('button');
pdfButton.className='pdf-download';
pdfButton.type='button';
pdfButton.innerHTML='<span class="pdf-icon">⇩</span><span class="pdf-label">Download PDF / PDF保存</span>';
document.body.appendChild(pdfButton);

function loadScript(src,test){
  if(test()) return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(s=>s.src===src);
    if(existing){
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=src;
    script.async=true;
    script.onload=resolve;
    script.onerror=()=>reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function waitForImages(root){
  const images=[...root.querySelectorAll('img')];
  return Promise.all(images.map(img=>{
    if(img.complete) return Promise.resolve();
    return new Promise(resolve=>{
      const done=()=>resolve();
      img.addEventListener('load',done,{once:true});
      img.addEventListener('error',done,{once:true});
      setTimeout(done,3500);
    });
  }));
}

async function downloadDeckPDF(){
  if(pdfButton.disabled) return;
  const original=current;
  pdfButton.disabled=true;
  pdfButton.innerHTML='<span class="pdf-icon">◌</span><span class="pdf-label">Preparing PDF</span><span class="pdf-progress">0/'+slides.length+'</span>';

  try{
    await Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',()=>!!window.html2canvas),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',()=>!!window.jspdf)
    ]);

    if(document.fonts?.ready) await document.fonts.ready;

    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:'landscape',unit:'px',format:[1600,900],compress:true,hotfixes:['px_scaling']});
    document.body.classList.add('pdf-exporting');

    for(let i=0;i<slides.length;i++){
      slides.forEach(s=>s.classList.remove('active','prev','export-slide'));
      const slide=slides[i];
      slide.classList.add('export-slide');
      await waitForImages(slide);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

      const canvas=await window.html2canvas(slide,{
        scale:1.35,
        useCORS:true,
        allowTaint:false,
        backgroundColor:'#f7f8fa',
        width:1600,
        height:900,
        windowWidth:1600,
        windowHeight:900,
        scrollX:0,
        scrollY:0,
        logging:false,
        imageTimeout:7000
      });

      if(i>0) pdf.addPage([1600,900],'landscape');
      const image=canvas.toDataURL('image/jpeg',0.93);
      pdf.addImage(image,'JPEG',0,0,1600,900,undefined,'FAST');
      const progress=pdfButton.querySelector('.pdf-progress');
      if(progress) progress.textContent=`${i+1}/${slides.length}`;
    }

    const stamp=new Date().toISOString().slice(0,10);
    pdf.save(`Syourai-Grand-Suite-Japan-Workforce-Proposal-${stamp}.pdf`);
  }catch(error){
    console.error('PDF export failed:',error);
    alert('Direct PDF export could not be completed in this browser. Please check your internet connection and try again.');
  }finally{
    document.body.classList.remove('pdf-exporting');
    slides.forEach(s=>s.classList.remove('active','prev','export-slide'));
    go(original);
    pdfButton.disabled=false;
    pdfButton.innerHTML='<span class="pdf-icon">⇩</span><span class="pdf-label">Download PDF / PDF保存</span>';
  }
}

pdfButton.addEventListener('click',downloadDeckPDF);
