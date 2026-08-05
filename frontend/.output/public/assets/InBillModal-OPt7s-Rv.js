import{i as e,t}from"./jsx-runtime-DUAcabCT.js";import{E as n,_ as r,v as i}from"./data-B50EgDTh.js";import{n as a,t as o}from"./browser-45kE1EfX.js";import{J as s,g as c,h as l,i as u,s as d,v as f,y as p}from"./index-BgTwecpi.js";var m=e(n(),1),h=e(o(),1),g=t();function _(e,t){let n=e.items.map(e=>{let t=[e.size_label||null,e.toppings&&e.toppings.length>0?e.toppings.map(e=>e.name).join(`, `):null,e.note?`(${e.note})`:null].filter(Boolean).join(` · `);return`
        <tr>
          <td colspan="2"><strong>${e.qty}× ${e.product_name}</strong></td>
        </tr>
        ${t?`<tr><td class="dim" colspan="2">${t}</td></tr>`:``}
        <tr><td></td><td class="right">${r(e.line_total)}</td></tr>`}).join(``);return`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>Hóa đơn ${e.order_code}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; color: #000; font-size: 12px; line-height: 1.45; }
  h1 { font-size: 15px; text-align: center; }
  .center { text-align: center; }
  .dim { color: #444; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  .right { text-align: right; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .total { font-size: 14px; font-weight: bold; }
  .qr { text-align: center; margin: 8px 0; }
  .qr img { width: 42mm; height: 42mm; }
  @media print { body { width: 72mm; } @page { size: 80mm auto; margin: 4mm; } }
</style>
</head>
<body>
  <h1>TRÀ TRÁI CÂY TÔ</h1>
  <p class="center dim">${e.store_name||`Hệ thống cửa hàng trà trái cây`}</p>
  <p class="center dim">Hotline 1900 8386</p>
  <div class="sep"></div>
  <p><strong>Mã đơn:</strong> ${e.order_code}</p>
  <p>${e.location_name?`<strong>Bàn:</strong> ${e.location_name}`:`<strong>Loại:</strong> ${e.payment_method||`Take-away`}`}</p>
  <p><strong>Giờ:</strong> ${new Date(e.created_at).toLocaleString(`vi-VN`)}</p>
  ${e.customer_name?`<p><strong>Khách:</strong> ${e.customer_name}${e.customer_phone?` · `+e.customer_phone:``}</p>`:``}
  <div class="sep"></div>
  <table>${n}</table>
  <div class="sep"></div>
  <table>
    <tr><td>Tiền món</td><td class="right">${r(e.subtotal)}</td></tr>
    <tr><td>Giảm giá</td><td class="right">${e.discount_amount?`− `+r(e.discount_amount):`0₫`}</td></tr>
    <tr class="total"><td>TỔNG CỘNG</td><td class="right">${r(e.total)}</td></tr>
  </table>
  <div class="sep"></div>
  ${t?`<div class="qr"><img src="${t}" alt="QR đơn" /></div>`:``}
  <p class="center dim">Quét mã QR để theo dõi đơn hàng</p>
  <p class="center"><strong>Cảm ơn quý khách!</strong></p>
  <p class="center dim">Trà đậm vị – Trái cây tươi mỗi ngày</p>
</body>
</html>`}function v({order:e,open:t,onClose:n}){let[o,v]=(0,m.useState)(null),[y,b]=(0,m.useState)(!1);(0,m.useEffect)(()=>{if(!t||!e)return;let n=!1;return h.toDataURL(`${window.location.origin}/theo-doi-don?code=${e.order_code}`,{width:180,margin:1}).then(e=>{n||v(e)}).catch(()=>{n||v(null)}),()=>{n=!0}},[t,e]);async function x(){if(e){b(!0);try{await u(`/admin/orders/${e.id}/print`,{});let t=window.open(``,`_blank`,`width=420,height=640`);if(!t)return d.error(`Trình duyệt chặn cửa sổ in — hãy cho phép popup`);t.document.write(_(e,o)),t.document.close(),t.focus(),setTimeout(()=>t.print(),300),d.success(`Đã in hóa đơn`)}catch(e){d.error(e instanceof Error?e.message:`In hóa đơn thất bại`)}finally{b(!1)}}}return e?(0,g.jsx)(l,{open:t,onOpenChange:e=>!e&&n(),children:(0,g.jsxs)(c,{className:`sm:max-w-md`,children:[(0,g.jsx)(f,{children:(0,g.jsxs)(p,{className:`flex items-center gap-2`,children:[(0,g.jsx)(a,{className:`size-4`}),` Hóa đơn `,e.order_code]})}),(0,g.jsx)(`div`,{className:`bg-black/90 mx-auto w-[80mm] max-w-full rounded-lg p-4`,children:(0,g.jsxs)(`div`,{className:`bg-white p-3 text-[11px] leading-relaxed text-black`,children:[(0,g.jsx)(`p`,{className:`text-center text-sm font-bold`,children:`TRÀ TRÁI CÂY TÔ`}),(0,g.jsx)(`p`,{className:`text-center text-[10px] text-neutral-500`,children:e.store_name||`Hệ thống cửa hàng trà trái cây`}),(0,g.jsx)(`p`,{className:`text-center text-[10px] text-neutral-500`,children:`Hotline 1900 8386`}),(0,g.jsx)(`div`,{className:`my-2 border-t border-dashed border-black`}),(0,g.jsxs)(`p`,{className:`font-bold`,children:[`Mã đơn: `,e.order_code]}),(0,g.jsx)(`p`,{children:e.location_name?`Bàn: ${e.location_name}`:`Loại: ${e.payment_method||`Take-away`}`}),(0,g.jsxs)(`p`,{children:[`Giờ: `,new Date(e.created_at).toLocaleString(`vi-VN`)]}),e.customer_name&&(0,g.jsxs)(`p`,{children:[`Khách: `,e.customer_name,e.customer_phone?` · ${e.customer_phone}`:``]}),(0,g.jsx)(`div`,{className:`my-2 border-t border-dashed border-black`}),e.items.map((e,t)=>(0,g.jsxs)(`div`,{children:[(0,g.jsxs)(`p`,{className:`font-semibold`,children:[e.qty,`× `,e.product_name]}),(0,g.jsxs)(`div`,{className:`flex justify-between gap-2`,children:[(0,g.jsx)(`span`,{className:`text-[10px] text-neutral-500`,children:[e.size_label||null,e.toppings&&e.toppings.length>0?e.toppings.map(e=>e.name).join(`, `):null,e.note?`(${e.note})`:null].filter(Boolean).join(` · `)}),(0,g.jsx)(`span`,{className:`font-medium`,children:r(e.line_total)})]})]},t)),(0,g.jsx)(`div`,{className:`my-2 border-t border-dashed border-black`}),(0,g.jsxs)(`div`,{className:`flex justify-between`,children:[(0,g.jsx)(`span`,{children:`Tiền món`}),(0,g.jsx)(`span`,{children:r(e.subtotal)})]}),(0,g.jsxs)(`div`,{className:`flex justify-between`,children:[(0,g.jsx)(`span`,{children:`Giảm giá`}),(0,g.jsx)(`span`,{children:e.discount_amount?`− ${r(e.discount_amount)}`:`0₫`})]}),(0,g.jsxs)(`div`,{className:`mt-1 flex justify-between text-sm font-bold`,children:[(0,g.jsx)(`span`,{children:`TỔNG CỘNG`}),(0,g.jsx)(`span`,{children:r(e.total)})]}),(0,g.jsx)(`div`,{className:`my-2 border-t border-dashed border-black`}),o&&(0,g.jsx)(`div`,{className:`flex justify-center py-1`,children:(0,g.jsx)(`img`,{src:o,alt:`QR theo dõi đơn`,className:`size-28`})}),(0,g.jsx)(`p`,{className:`text-center text-[10px] text-neutral-500`,children:`Quét mã QR để theo dõi đơn hàng`}),(0,g.jsx)(`p`,{className:`mt-1 text-center font-bold`,children:`Cảm ơn quý khách!`})]})}),(0,g.jsxs)(`div`,{className:`flex gap-2`,children:[(0,g.jsxs)(i,{variant:`ghost`,className:`flex-1`,onClick:n,children:[(0,g.jsx)(s,{className:`size-4`}),` Đóng`]}),(0,g.jsxs)(i,{variant:`hero`,className:`flex-1`,onClick:x,disabled:y,children:[(0,g.jsx)(a,{className:`size-4`}),` `,y?`Đang in…`:`In hóa đơn`]})]})]})}):null}export{v as t};