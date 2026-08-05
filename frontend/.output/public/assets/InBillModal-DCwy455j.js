import{r as e}from"./rolldown-runtime-QTnfLwEv.js";import{l as t,t as n}from"./button-ZXrziPDy.js";import{t as r}from"./jsx-runtime-By8HlURe.js";import{n as i,t as a}from"./browser-DtZcc0fk.js";import{t as o}from"./x-KFw41sMv.js";import{E as s,F as c,L as l,P as u,R as d,o as f,u as p}from"./index-BHKaeR20.js";var m=e(t(),1),h=e(a(),1),g=r();function _(e,t){let n=e.items.map(e=>{let t=[e.size_label||null,e.toppings&&e.toppings.length>0?e.toppings.map(e=>e.name).join(`, `):null,e.note?`(${e.note})`:null].filter(Boolean).join(` · `);return`
        <tr>
          <td colspan="2"><strong>${e.qty}× ${e.product_name}</strong></td>
        </tr>
        ${t?`<tr><td class="dim" colspan="2">${t}</td></tr>`:``}
        <tr><td></td><td class="right">${s(e.line_total)}</td></tr>`}).join(``);return`<!DOCTYPE html>
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
    <tr><td>Tiền món</td><td class="right">${s(e.subtotal)}</td></tr>
    <tr><td>Giảm giá</td><td class="right">${e.discount_amount?`− `+s(e.discount_amount):`0₫`}</td></tr>
    <tr class="total"><td>TỔNG CỘNG</td><td class="right">${s(e.total)}</td></tr>
  </table>
  <div class="sep"></div>
  ${t?`<div class="qr"><img src="${t}" alt="QR đơn" /></div>`:``}
  <p class="center dim">Quét mã QR để theo dõi đơn hàng</p>
  <p class="center"><strong>Cảm ơn quý khách!</strong></p>
  <p class="center dim">Trà đậm vị – Trái cây tươi mỗi ngày</p>
</body>
</html>`}function v({order:e,open:t,onClose:r}){let[a,v]=(0,m.useState)(null),[y,b]=(0,m.useState)(!1);(0,m.useEffect)(()=>{if(!t||!e)return;let n=!1;return h.toDataURL(`${window.location.origin}/theo-doi-don?code=${e.order_code}`,{width:180,margin:1}).then(e=>{n||v(e)}).catch(()=>{n||v(null)}),()=>{n=!0}},[t,e]);async function x(){if(e){b(!0);try{await f(`/admin/orders/${e.id}/print`,{});let t=window.open(``,`_blank`,`width=420,height=640`);if(!t)return p.error(`Trình duyệt chặn cửa sổ in — hãy cho phép popup`);t.document.write(_(e,a)),t.document.close(),t.focus(),setTimeout(()=>t.print(),300),p.success(`Đã in hóa đơn`)}catch(e){p.error(e instanceof Error?e.message:`In hóa đơn thất bại`)}finally{b(!1)}}}return e?(0,g.jsx)(u,{open:t,onOpenChange:e=>!e&&r(),children:(0,g.jsxs)(c,{className:`sm:max-w-md`,children:[(0,g.jsx)(l,{children:(0,g.jsxs)(d,{className:`flex items-center gap-2`,children:[(0,g.jsx)(i,{className:`size-4`}),` Hóa đơn `,e.order_code]})}),(0,g.jsx)(`div`,{className:`bg-black/90 mx-auto w-[80mm] max-w-full rounded-lg p-4`,children:(0,g.jsxs)(`div`,{className:`bg-white p-3 text-[11px] leading-relaxed text-black`,children:[(0,g.jsx)(`p`,{className:`text-center text-sm font-bold`,children:`TRÀ TRÁI CÂY TÔ`}),(0,g.jsx)(`p`,{className:`text-center text-[10px] text-neutral-500`,children:e.store_name||`Hệ thống cửa hàng trà trái cây`}),(0,g.jsx)(`p`,{className:`text-center text-[10px] text-neutral-500`,children:`Hotline 1900 8386`}),(0,g.jsx)(`div`,{className:`my-2 border-t border-dashed border-black`}),(0,g.jsxs)(`p`,{className:`font-bold`,children:[`Mã đơn: `,e.order_code]}),(0,g.jsx)(`p`,{children:e.location_name?`Bàn: ${e.location_name}`:`Loại: ${e.payment_method||`Take-away`}`}),(0,g.jsxs)(`p`,{children:[`Giờ: `,new Date(e.created_at).toLocaleString(`vi-VN`)]}),e.customer_name&&(0,g.jsxs)(`p`,{children:[`Khách: `,e.customer_name,e.customer_phone?` · ${e.customer_phone}`:``]}),(0,g.jsx)(`div`,{className:`my-2 border-t border-dashed border-black`}),e.items.map((e,t)=>(0,g.jsxs)(`div`,{children:[(0,g.jsxs)(`p`,{className:`font-semibold`,children:[e.qty,`× `,e.product_name]}),(0,g.jsxs)(`div`,{className:`flex justify-between gap-2`,children:[(0,g.jsx)(`span`,{className:`text-[10px] text-neutral-500`,children:[e.size_label||null,e.toppings&&e.toppings.length>0?e.toppings.map(e=>e.name).join(`, `):null,e.note?`(${e.note})`:null].filter(Boolean).join(` · `)}),(0,g.jsx)(`span`,{className:`font-medium`,children:s(e.line_total)})]})]},t)),(0,g.jsx)(`div`,{className:`my-2 border-t border-dashed border-black`}),(0,g.jsxs)(`div`,{className:`flex justify-between`,children:[(0,g.jsx)(`span`,{children:`Tiền món`}),(0,g.jsx)(`span`,{children:s(e.subtotal)})]}),(0,g.jsxs)(`div`,{className:`flex justify-between`,children:[(0,g.jsx)(`span`,{children:`Giảm giá`}),(0,g.jsx)(`span`,{children:e.discount_amount?`− ${s(e.discount_amount)}`:`0₫`})]}),(0,g.jsxs)(`div`,{className:`mt-1 flex justify-between text-sm font-bold`,children:[(0,g.jsx)(`span`,{children:`TỔNG CỘNG`}),(0,g.jsx)(`span`,{children:s(e.total)})]}),(0,g.jsx)(`div`,{className:`my-2 border-t border-dashed border-black`}),a&&(0,g.jsx)(`div`,{className:`flex justify-center py-1`,children:(0,g.jsx)(`img`,{src:a,alt:`QR theo dõi đơn`,className:`size-28`})}),(0,g.jsx)(`p`,{className:`text-center text-[10px] text-neutral-500`,children:`Quét mã QR để theo dõi đơn hàng`}),(0,g.jsx)(`p`,{className:`mt-1 text-center font-bold`,children:`Cảm ơn quý khách!`})]})}),(0,g.jsxs)(`div`,{className:`flex gap-2`,children:[(0,g.jsxs)(n,{variant:`ghost`,className:`flex-1`,onClick:r,children:[(0,g.jsx)(o,{className:`size-4`}),` Đóng`]}),(0,g.jsxs)(n,{variant:`hero`,className:`flex-1`,onClick:x,disabled:y,children:[(0,g.jsx)(i,{className:`size-4`}),` `,y?`Đang in…`:`In hóa đơn`]})]})]})}):null}export{v as t};