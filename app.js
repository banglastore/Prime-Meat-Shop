(() => {
  'use strict';
  const DATA = window.APP_DATA;
  const W = DATA.pageWidth, H = DATA.pageHeight;
  const $ = (id) => document.getElementById(id);

  const els = {
    shopSelect: $('shopSelect'), addShopBtn: $('addShopBtn'), deleteShopBtn: $('deleteShopBtn'),
    templateSelect: $('templateSelect'), liveStamp: $('liveStamp'), pageImage: $('pageImage'), hotspots: $('hotspots'),
    pdfShopHeader: $('pdfShopHeader'), pdfDate: $('pdfDate'), pdfTime: $('pdfTime'), pageIndicator: $('pageIndicator'),
    prevBtn: $('prevBtn'), nextBtn: $('nextBtn'), newOrderBtn: $('newOrderBtn'), previewBtn: $('previewBtn'), saveBtn: $('saveBtn'),
    entryModal: $('entryModal'), entryTitle: $('entryTitle'), qtyInput: $('qtyInput'), unitGrid: $('unitGrid'), saveItemBtn: $('saveItemBtn'), clearItemBtn: $('clearItemBtn'),
    shopModal: $('shopModal'), shopNameInput: $('shopNameInput'), saveShopBtn: $('saveShopBtn'),
    previewModal: $('previewModal'), previewFrame: $('previewFrame'), previewShareBtn: $('previewShareBtn'),
    historyBtn: $('historyBtn'), historyModal: $('historyModal'), historyList: $('historyList'), toast: $('toast'),
    customItemModal: $('customItemModal'), customItemName: $('customItemName'), saveCustomItemBtn: $('saveCustomItemBtn'), deleteCustomItemBtn: $('deleteCustomItemBtn'), orderDate: $('orderDate'), otherItemsPanel: $('otherItemsPanel'), addOtherMeatBtn: $('addOtherMeatBtn'), otherItemsList: $('otherItemsList')
  };

  let shops = loadJSON('pms_shops_v1', []);
  let templateKey = localStorage.getItem('pms_template_v1') || 'product';
  if (!DATA.templates[templateKey]) templateKey = Object.keys(DATA.templates)[0];
  let pageIndex = 0;
  let orderValues = loadJSON('pms_draft_v1', {});
  let activeItem = null;
  let selectedUnit = 'KG';
  let previewUrl = null;
  let lastPdfBlob = null;
  let lastPdfName = null;
  let activeCustomSlot = 0;
  let customItems = loadJSON('pms_custom_items_v2', {});
  function customBucket(){
    if(!Array.isArray(customItems[templateKey])) customItems[templateKey]=[];
    while(customItems[templateKey].length<6) customItems[templateKey].push(null);
    return customItems[templateKey];
  }

  function loadJSON(key, fallback){ try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
  function saveJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function toast(msg){ els.toast.textContent = msg; els.toast.classList.remove('hidden'); clearTimeout(toast.t); toast.t=setTimeout(()=>els.toast.classList.add('hidden'),1800); }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
  function formatDate(d=new Date()){ return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d); }
  function formatDay(d){ return new Intl.DateTimeFormat('en-US',{weekday:'long'}).format(d); }
  function selectedDateObj(){ const v=els.orderDate?.value; if(v){ const [y,m,d]=v.split('-').map(Number); return new Date(y,m-1,d,12,0,0); } return new Date(); }
  function stampNow(){ const d=selectedDateObj(); return {date:formatDate(d),day:formatDay(d),iso:d.toISOString()}; }
  function selectedShop(){ return els.shopSelect.value || ''; }
  function draftBucket(){ if(!orderValues[templateKey]) orderValues[templateKey]={}; return orderValues[templateKey]; }

  function renderTemplateOptions(){
    els.templateSelect.innerHTML = Object.entries(DATA.templates).map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join('');
    els.templateSelect.value = templateKey;
  }
  function renderShops(){
    const prev = localStorage.getItem('pms_shop_v1') || shops[0] || '';
    els.shopSelect.innerHTML = shops.length ? shops.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('') : '<option value="">Add shop name…</option>';
    if(shops.includes(prev)) els.shopSelect.value=prev;
    else if(shops.length) els.shopSelect.value=shops[0];
    els.deleteShopBtn.disabled = !shops.length;
    updateHeader();
  }
  function updateClock(){ const s=stampNow(); els.liveStamp.textContent=`${s.date} • ${s.day}`; els.pdfDate.textContent=`DATE: ${s.date}`; els.pdfTime.textContent=`DAY: ${s.day.toUpperCase()}`; }
  function updateHeader(){ els.pdfShopHeader.textContent = selectedShop() ? `PRIME MEAT SHOP : ${selectedShop().toUpperCase()}` : 'PRIME MEAT SHOP'; }

  function renderPage(){
    const tpl=DATA.templates[templateKey]; const p=tpl.pages[pageIndex];
    els.pageImage.src=p.image; els.pageIndicator.textContent=`Page ${pageIndex+1} / ${tpl.pages.length}`;
    els.prevBtn.disabled=pageIndex===0; els.nextBtn.disabled=pageIndex===tpl.pages.length-1;
    els.nextBtn.textContent=pageIndex===tpl.pages.length-1?'Page 2 ✓':'Next →';
    els.hotspots.innerHTML='';
    const vals=draftBucket();
    p.items.forEach(item=>{
      const b=document.createElement('button'); b.type='button'; b.className='hotspot'; b.dataset.id=item.id; b.title=item.label;
      b.style.left=(item.x0/W*100)+'%'; b.style.width=((item.x1-item.x0)/W*100)+'%';
      b.style.top=(item.y0/H*100)+'%'; b.style.height=((item.y1-item.y0)/H*100)+'%';
      const v=vals[item.id]; if(v && v.qty){ b.classList.add('filled'); b.textContent=`${v.qty} ${v.unit}`; }
      b.addEventListener('click',()=>openEntry(item)); els.hotspots.appendChild(b);
    });
    if(pageIndex===tpl.pages.length-1){ renderCustomOtherItems(); renderOtherItemsPanel(); } else { els.otherItemsPanel.classList.add('hidden'); }
    updateHeader(); updateClock();
  }


  function renderCustomOtherItems(){
    // Six editable rows directly under the OTHER ITEMS heading on page 2.
    // Coordinates match the original A4 PDF, so the buttons stay aligned on mobile.
    const slots=customBucket();
    const rowTop=665.5620, rowH=16.6858;
    const nameX0=322.20, nameX1=445.039, qX0=445.039, qX1=504.567;
    for(let i=0;i<6;i++){
      const y0=rowTop+(i*rowH), y1=y0+rowH, item=slots[i];
      const n=document.createElement('button');
      n.type='button'; n.className='customName'+(item?.name?'':' empty');
      n.style.left=(nameX0/W*100)+'%'; n.style.width=((nameX1-nameX0)/W*100)+'%';
      n.style.top=(y0/H*100)+'%'; n.style.height=((y1-y0)/H*100)+'%';
      n.textContent=item?.name||'+ ADD ITEM';
      n.setAttribute('aria-label', item?.name ? `Edit ${item.name}` : `Add other item ${i+1}`);
      n.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();openCustomItem(i);});
      els.hotspots.appendChild(n);
      if(item?.name){
        const q=document.createElement('button'); q.type='button'; q.className='hotspot customQty';
        q.style.left=(qX0/W*100)+'%'; q.style.width=((qX1-qX0)/W*100)+'%';
        q.style.top=(y0/H*100)+'%'; q.style.height=((y1-y0)/H*100)+'%';
        if(item.qty){q.classList.add('filled');q.textContent=`${item.qty} ${item.unit||'KG'}`;}
        q.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();openCustomQty(i);});
        els.hotspots.appendChild(q);
      }
    }
  }

  function renderOtherItemsPanel(){
    els.otherItemsPanel.classList.remove('hidden');
    const items=customBucket();
    els.otherItemsList.innerHTML=items.map((it,i)=>it?.name ? `<div class="otherRow"><button type="button" data-edit-other="${i}">${esc(it.name)}</button><button type="button" data-qty-other="${i}">${esc(it.qty||'Qty')} ${esc(it.qty?it.unit||'KG':'')}</button><button class="dangerText" type="button" data-del-other="${i}">Delete</button></div>` : '').join('');
  }
  function addOtherMeat(){ const slots=customBucket(); let i=slots.findIndex(x=>!x?.name); if(i<0){ toast('OTHER ITEMS full'); return; } openCustomItem(i); }

  function openCustomItem(i){ activeCustomSlot=i; const item=customBucket()[i]; els.customItemName.value=item?.name||''; els.deleteCustomItemBtn.style.visibility=item?.name?'visible':'hidden'; openModal(els.customItemModal); setTimeout(()=>els.customItemName.focus(),100); }
  function saveCustomItem(){ const name=els.customItemName.value.trim().replace(/\s+/g,' '); if(!name)return toast('Item name লিখুন'); const old=customBucket()[activeCustomSlot]||{}; customBucket()[activeCustomSlot]={name,qty:old.qty||'',unit:old.unit||'KG'}; saveJSON('pms_custom_items_v2',customItems); closeModal(els.customItemModal); renderPage(); toast('Other meat saved'); }
  function deleteCustomItem(){ customBucket()[activeCustomSlot]=null; saveJSON('pms_custom_items_v2',customItems); closeModal(els.customItemModal); renderPage(); }
  function openCustomQty(i){ const item=customBucket()[i]; if(!item?.name)return openCustomItem(i); activeItem={id:`__custom_${i}`,label:item.name,customSlot:i}; selectedUnit=item.unit||'KG'; els.entryTitle.textContent=item.name; els.qtyInput.value=item.qty||''; renderUnits(); openModal(els.entryModal); setTimeout(()=>{els.qtyInput.focus();els.qtyInput.select();},120); }

  function openEntry(item){
    activeItem=item; const v=draftBucket()[item.id] || {qty:'',unit:'KG'}; selectedUnit=v.unit||'KG';
    els.entryTitle.textContent=item.label; els.qtyInput.value=v.qty||''; renderUnits(); openModal(els.entryModal);
    setTimeout(()=>{els.qtyInput.focus();els.qtyInput.select();},120);
  }
  function renderUnits(){ [...els.unitGrid.querySelectorAll('button')].forEach(b=>b.classList.toggle('active',b.dataset.unit===selectedUnit)); }
  function normalizeQty(v){ return String(v).trim().replace(',','.').replace(/[^0-9.]/g,'').replace(/(\..*)\./g,'$1'); }
  function saveItem(){ if(!activeItem)return; const qty=normalizeQty(els.qtyInput.value); if(activeItem.customSlot!==undefined){ const i=activeItem.customSlot, it=customBucket()[i]; if(it){it.qty=qty;it.unit=selectedUnit;saveJSON('pms_custom_items_v2',customItems);} } else { const vals=draftBucket(); if(qty) vals[activeItem.id]={qty,unit:selectedUnit}; else delete vals[activeItem.id]; saveJSON('pms_draft_v1',orderValues); } closeModal(els.entryModal); renderPage(); }
  function clearItem(){ if(activeItem){ if(activeItem.customSlot!==undefined){const it=customBucket()[activeItem.customSlot];if(it){it.qty='';saveJSON('pms_custom_items_v2',customItems);}} else {delete draftBucket()[activeItem.id];saveJSON('pms_draft_v1',orderValues);} } closeModal(els.entryModal); renderPage(); }

  function openModal(el){ el.classList.remove('hidden'); document.body.style.overflow='hidden'; }
  function closeModal(el){ el.classList.add('hidden'); if(!document.querySelector('.modal:not(.hidden)')) document.body.style.overflow=''; }

  function addShop(){ els.shopNameInput.value=''; openModal(els.shopModal); setTimeout(()=>els.shopNameInput.focus(),100); }
  function saveShop(){ const n=els.shopNameInput.value.trim().replace(/\s+/g,' '); if(!n)return toast('Shop name লিখুন'); if(!shops.some(s=>s.toLowerCase()===n.toLowerCase())) shops.push(n); saveJSON('pms_shops_v1',shops); localStorage.setItem('pms_shop_v1',n); closeModal(els.shopModal); renderShops(); els.shopSelect.value=n; updateHeader(); }
  function deleteShop(){ const s=selectedShop(); if(!s)return; if(!confirm(`Delete shop “${s}”?`))return; shops=shops.filter(x=>x!==s); saveJSON('pms_shops_v1',shops); localStorage.removeItem('pms_shop_v1'); renderShops(); }

  function cleanPdfText(s){ return String(s).replace(/[\\()]/g,m=>({"\\":"\\\\","(":"\\(",")":"\\)"}[m])).replace(/[^\x20-\x7E]/g,' '); }
  function approxTextWidth(text,size,bold=false){ let n=0; for(const ch of text){ if('MW@#'.includes(ch))n+=.86; else if('ilI1 .,:'.includes(ch))n+=.32; else n+=.54; } return n*size*(bold?1.03:1); }
  function fitText(text,maxWidth,startSize,minSize=4.6){ let s=startSize; while(s>minSize && approxTextWidth(text,s,true)>maxWidth)s-=.2; return s; }
  function latin1Bytes(str){ const a=new Uint8Array(str.length); for(let i=0;i<str.length;i++)a[i]=str.charCodeAt(i)&255; return a; }
  function concatBytes(parts){ let len=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(len),o=0; for(const p of parts){out.set(p,o);o+=p.length;} return out; }
  async function fetchBytes(url){ const r=await fetch(url,{cache:'force-cache'}); if(!r.ok)throw new Error('Could not load '+url); return new Uint8Array(await r.arrayBuffer()); }

  async function makePdf(saveHistory=true){
    if(!selectedShop()){ addShop(); throw new Error('SHOP_REQUIRED'); }
    const tpl=DATA.templates[templateKey]; const stamp=stampNow(); const shop=selectedShop();
    const images=await Promise.all(tpl.pages.map(p=>fetchBytes(p.image)));
    const obj=[]; const pageObjNums=[], imageObjNums=[], contentObjNums=[];
    const fontReg=3,fontBold=4; let next=5;
    for(let i=0;i<tpl.pages.length;i++){ pageObjNums[i]=next++; imageObjNums[i]=next++; contentObjNums[i]=next++; }
    obj[1]=`<< /Type /Catalog /Pages 2 0 R >>`;
    obj[2]=`<< /Type /Pages /Count ${tpl.pages.length} /Kids [${pageObjNums.map(n=>`${n} 0 R`).join(' ')}] >>`;
    obj[3]=`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
    obj[4]=`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
    const vals=draftBucket();
    for(let i=0;i<tpl.pages.length;i++){
      const p=tpl.pages[i], im=images[i], pageNo=pageObjNums[i], imNo=imageObjNums[i], cNo=contentObjNums[i];
      obj[pageNo]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(3)} ${H.toFixed(3)}] /Resources << /XObject << /Im1 ${imNo} 0 R >> /Font << /F1 ${fontReg} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${cNo} 0 R >>`;
      obj[imNo]={dict:`<< /Type /XObject /Subtype /Image /Width ${p.imageWidth} /Height ${p.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.length} >>`,stream:im};
      let c=[];
      c.push(`q ${W.toFixed(3)} 0 0 ${H.toFixed(3)} 0 0 cm /Im1 Do Q\n`);
      // clean header and add bold shop/date/time
      c.push(`1 1 1 rg 0 ${(H-48.35).toFixed(2)} ${W.toFixed(2)} 48.35 re f\n0 0 0 rg\n`);
      let header=`PRIME MEAT SHOP${shop?` : ${shop.toUpperCase()}`:''}`; let hs=fitText(header,220,7.2,5.2); let hx=Math.max(160,(W-approxTextWidth(header,hs,true))/2-18);
      c.push(`BT /F2 ${hs.toFixed(1)} Tf 1 0 0 1 ${hx.toFixed(2)} ${(H-34.0).toFixed(2)} Tm (${cleanPdfText(header)}) Tj ET\n`);
      c.push(`BT /F2 6.0 Tf 1 0 0 1 349.0 ${(H-29.0).toFixed(2)} Tm (DATE: ${cleanPdfText(stamp.date)}) Tj ET\n`);
      c.push(`BT /F2 6.0 Tf 1 0 0 1 349.0 ${(H-40.0).toFixed(2)} Tm (DAY: ${cleanPdfText(stamp.day.toUpperCase())}) Tj ET\n`);
      for(const item of p.items){ const v=vals[item.id]; if(!v?.qty)continue; const text=`${v.qty} ${v.unit}`; const size=fitText(text,item.x1-item.x0-6,7.4,5.0); const tx=item.x0+3.2; const yCenter=(item.y0+item.y1)/2; const ty=H-yCenter-size*0.34; c.push(`BT /F2 ${size.toFixed(1)} Tf 1 0 0 1 ${tx.toFixed(2)} ${ty.toFixed(2)} Tm (${cleanPdfText(text)}) Tj ET\n`); }
      if(i===tpl.pages.length-1){ const rowTop=665.5620,rowH=16.6858; customBucket().slice(0,6).forEach((it,j)=>{ if(!it?.name)return; const yCenter=rowTop+j*rowH+rowH/2, y=H-yCenter-2.0; const ns=fitText(it.name,140,6.4,4.5); c.push(`BT /F2 ${ns.toFixed(1)} Tf 1 0 0 1 325.0 ${y.toFixed(2)} Tm (${cleanPdfText(it.name)}) Tj ET\n`); if(it.qty){const qt=`${it.qty} ${it.unit||'KG'}`, qs=fitText(qt,53,6.8,4.6);c.push(`BT /F2 ${qs.toFixed(1)} Tf 1 0 0 1 448.0 ${y.toFixed(2)} Tm (${cleanPdfText(qt)}) Tj ET\n`);} }); }
      const cb=latin1Bytes(c.join('')); obj[cNo]={dict:`<< /Length ${cb.length} >>`,stream:cb};
    }
    const header=latin1Bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'); const parts=[header]; const offsets=[0]; let total=header.length;
    for(let n=1;n<obj.length;n++){
      offsets[n]=total; const start=latin1Bytes(`${n} 0 obj\n`); parts.push(start); total+=start.length;
      const o=obj[n]; if(typeof o==='string'){ const b=latin1Bytes(o+'\nendobj\n');parts.push(b);total+=b.length; }
      else { const a=latin1Bytes(o.dict+'\nstream\n'), z=latin1Bytes('\nendstream\nendobj\n'); parts.push(a,o.stream,z); total+=a.length+o.stream.length+z.length; }
    }
    const xrefPos=total; let x=`xref\n0 ${obj.length}\n0000000000 65535 f \n`; for(let n=1;n<obj.length;n++)x+=String(offsets[n]).padStart(10,'0')+' 00000 n \n'; x+=`trailer\n<< /Size ${obj.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`; const xb=latin1Bytes(x); parts.push(xb);
    const pdf=concatBytes(parts); const blob=new Blob([pdf],{type:'application/pdf'});
    const safeShop=shop.replace(/[^a-z0-9_-]+/gi,'_'); const name=`Prime_Meat_Order_${safeShop}_${stamp.date.replaceAll('/','-')}_${stamp.day}.pdf`;
    if(saveHistory){ saveHistoryEntry({templateKey,shop,stamp,values:JSON.parse(JSON.stringify(vals))}); }
    return {blob,name,stamp};
  }

  function saveHistoryEntry(entry){
    const h=loadJSON('pms_history_v1',[]); h.unshift({id:Date.now(),...entry}); if(h.length>30)h.length=30; saveJSON('pms_history_v1',h);
  }
  function renderHistory(){
    const h=loadJSON('pms_history_v1',[]); if(!h.length){els.historyList.innerHTML='<div class="emptyState">No saved orders yet.</div>';return;}
    els.historyList.innerHTML=h.map(x=>`<div class="historyItem"><div><div class="title">${esc(x.shop)} — ${esc(DATA.templates[x.templateKey]?.label||x.templateKey)}</div><div class="meta">${esc(x.stamp?.date||'')} • ${esc(x.stamp?.day||'')}</div></div><div class="historyActions"><button data-open="${x.id}">Open</button><button class="del" data-del="${x.id}">Delete</button></div></div>`).join('');
    els.historyList.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openHistory(Number(b.dataset.open))));
    els.historyList.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>deleteHistory(Number(b.dataset.del))));
  }
  function openHistory(id){ const h=loadJSON('pms_history_v1',[]),x=h.find(a=>a.id===id); if(!x)return; templateKey=x.templateKey; localStorage.setItem('pms_template_v1',templateKey); renderTemplateOptions(); if(!shops.includes(x.shop)){shops.push(x.shop);saveJSON('pms_shops_v1',shops);} localStorage.setItem('pms_shop_v1',x.shop); renderShops(); els.shopSelect.value=x.shop; orderValues[templateKey]=JSON.parse(JSON.stringify(x.values||{})); saveJSON('pms_draft_v1',orderValues); pageIndex=0; closeModal(els.historyModal); renderPage(); toast('Order loaded'); }
  function deleteHistory(id){ let h=loadJSON('pms_history_v1',[]); h=h.filter(x=>x.id!==id); saveJSON('pms_history_v1',h); renderHistory(); }

  async function previewPdf(){
    try{ toast('Generating PDF…'); const out=await makePdf(false); lastPdfBlob=out.blob; lastPdfName=out.name; if(previewUrl)URL.revokeObjectURL(previewUrl); previewUrl=URL.createObjectURL(out.blob); els.previewFrame.src=previewUrl; openModal(els.previewModal); }
    catch(e){ if(e.message!=='SHOP_REQUIRED'){console.error(e);toast('PDF generate হয়নি');} }
  }
  async function sharePdf(blob=null,name=null){
    try{ if(!blob){toast('Generating PDF…');const out=await makePdf(true);blob=out.blob;name=out.name;} else saveHistoryEntry({templateKey,shop:selectedShop(),stamp:stampNow(),values:JSON.parse(JSON.stringify(draftBucket()))}); const file=new File([blob],name||'Prime_Meat_Order.pdf',{type:'application/pdf'}); if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:'Prime Meat Shop Order'}); }
      else { const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name||file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);toast('PDF saved'); }
    }catch(e){ if(e.name==='AbortError'||e.message==='SHOP_REQUIRED')return; console.error(e);toast('Save/Share failed'); }
  }
  function newOrder(){ if(!confirm('Start a new order? Current boxes will be cleared for this form.'))return; orderValues[templateKey]={}; saveJSON('pms_draft_v1',orderValues); pageIndex=0; renderPage(); toast('New order ready'); }

  els.prevBtn.addEventListener('click',()=>{if(pageIndex>0){pageIndex--;renderPage();window.scrollTo({top:0,behavior:'smooth'});}});
  els.nextBtn.addEventListener('click',()=>{const n=DATA.templates[templateKey].pages.length;if(pageIndex<n-1){pageIndex++;renderPage();window.scrollTo({top:0,behavior:'smooth'});}});
  els.templateSelect.addEventListener('change',()=>{templateKey=els.templateSelect.value;localStorage.setItem('pms_template_v1',templateKey);pageIndex=0;renderPage();});
  els.shopSelect.addEventListener('change',()=>{localStorage.setItem('pms_shop_v1',els.shopSelect.value);updateHeader();});
  els.addShopBtn.addEventListener('click',addShop); els.deleteShopBtn.addEventListener('click',deleteShop); els.saveShopBtn.addEventListener('click',saveShop);
  els.saveCustomItemBtn.addEventListener('click',saveCustomItem); els.deleteCustomItemBtn.addEventListener('click',deleteCustomItem);
  els.orderDate.addEventListener('change',()=>{localStorage.setItem('pms_order_date_v1',els.orderDate.value);updateClock();});
  els.addOtherMeatBtn.addEventListener('click',addOtherMeat);
  els.otherItemsList.addEventListener('click',e=>{const ed=e.target.closest('[data-edit-other]'),q=e.target.closest('[data-qty-other]'),d=e.target.closest('[data-del-other]'); if(ed)openCustomItem(+ed.dataset.editOther); else if(q)openCustomQty(+q.dataset.qtyOther); else if(d){activeCustomSlot=+d.dataset.delOther;deleteCustomItem();}}); els.customItemName.addEventListener('keydown',e=>{if(e.key==='Enter')saveCustomItem();});
  els.shopNameInput.addEventListener('keydown',e=>{if(e.key==='Enter')saveShop();});
  els.unitGrid.addEventListener('click',e=>{const b=e.target.closest('[data-unit]');if(b){selectedUnit=b.dataset.unit;renderUnits();}});
  els.qtyInput.addEventListener('input',()=>{els.qtyInput.value=normalizeQty(els.qtyInput.value);}); els.qtyInput.addEventListener('keydown',e=>{if(e.key==='Enter')saveItem();});
  els.saveItemBtn.addEventListener('click',saveItem); els.clearItemBtn.addEventListener('click',clearItem);
  els.previewBtn.addEventListener('click',previewPdf); els.saveBtn.addEventListener('click',()=>sharePdf()); els.previewShareBtn.addEventListener('click',()=>sharePdf(lastPdfBlob,lastPdfName));
  els.newOrderBtn.addEventListener('click',newOrder); els.historyBtn.addEventListener('click',()=>{renderHistory();openModal(els.historyModal);});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal($(b.dataset.close))));
  document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m);}));

  const savedDate=localStorage.getItem('pms_order_date_v1'); const today=new Date(); els.orderDate.value=savedDate||`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`; renderTemplateOptions(); renderShops(); renderPage(); updateClock();
  if(!shops.length) setTimeout(addShop,350);
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
